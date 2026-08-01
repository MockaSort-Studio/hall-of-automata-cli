#!/usr/bin/env python3
"""Unit tests for judge.py."""
import json
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import judge

CALIBRATION = {
    "dimensions": [
        {"id": "adaptability", "direction": "high", "expected_score_min": 4},
        {"id": "okr_gate",     "direction": "high", "expected_score_min": 4},
    ]
}


class TestVerifyModelIntegrity(unittest.TestCase):
    def test_same_model_fails(self):
        ok, msg = judge.verify_model_integrity("claude-opus-5", "claude-opus-5")
        self.assertFalse(ok)
        self.assertIn("judge model == test model", msg)

    def test_more_capable_judge_passes(self):
        ok, msg = judge.verify_model_integrity("claude-opus-5", "claude-sonnet-4-6")
        self.assertTrue(ok)
        self.assertEqual(msg, "ok")

    def test_less_capable_judge_fails(self):
        ok, msg = judge.verify_model_integrity("claude-haiku-4-5", "claude-opus-5")
        self.assertFalse(ok)
        self.assertIn("less capable", msg)

    def test_unknown_model_passes_with_warning(self):
        ok, msg = judge.verify_model_integrity("unknown-model-x", "claude-opus-5")
        self.assertTrue(ok)
        self.assertIn("unknown", msg)

    def test_strictly_more_capable_passes(self):
        ok, msg = judge.verify_model_integrity("claude-fable-5", "claude-opus-5")
        self.assertTrue(ok)
        self.assertEqual(msg, "ok")


class TestCheckCalibrationAgreement(unittest.TestCase):
    def test_all_agree(self):
        dims = [
            {"id": "adaptability", "score": 4},
            {"id": "okr_gate",     "score": 5},
        ]
        self.assertEqual(judge.check_calibration_agreement(dims, CALIBRATION), [])

    def test_below_minimum_flags(self):
        dims = [
            {"id": "adaptability", "score": 2},
            {"id": "okr_gate",     "score": 5},
        ]
        mismatches = judge.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 1)
        self.assertIn("adaptability", mismatches[0])

    def test_unknown_dimension_skipped(self):
        dims = [{"id": "nonexistent", "score": 1}]
        mismatches = judge.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 2)
        ids = " ".join(mismatches)
        self.assertIn("adaptability", ids)
        self.assertIn("okr_gate", ids)

    def test_missing_calibration_dimension_flags(self):
        dims = [{"id": "adaptability", "score": 4}]
        mismatches = judge.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 1)
        self.assertIn("okr_gate", mismatches[0])

    def test_low_direction_inverts_check(self):
        cal = {"dimensions": [{"id": "foo", "direction": "low", "expected_score_min": 3}]}
        self.assertEqual(judge.check_calibration_agreement([{"id": "foo", "score": 1}], cal), [])
        self.assertNotEqual(judge.check_calibration_agreement([{"id": "foo", "score": 4}], cal), [])

    def test_all_dimensions_below_flags_all(self):
        dims = [
            {"id": "adaptability", "score": 1},
            {"id": "okr_gate",     "score": 2},
        ]
        self.assertEqual(len(judge.check_calibration_agreement(dims, CALIBRATION)), 2)


class TestExtractAssistantText(unittest.TestCase):
    def test_extracts_text_blocks(self):
        lines = [
            json.dumps({"type": "assistant", "message": {"content": [
                {"type": "text", "text": "Hello world"},
                {"type": "tool_use", "name": "Bash", "input": {}},
            ]}}),
            json.dumps({"type": "result", "usage": {}}),
        ]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write("\n".join(lines))
            path = f.name
        try:
            result = judge.extract_assistant_text(path)
            self.assertIn("Hello world", result)
        finally:
            os.unlink(path)

    def test_missing_file_returns_empty(self):
        self.assertEqual(judge.extract_assistant_text("/nonexistent/path.jsonl"), "")

    def test_invalid_json_lines_skipped(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write("not-json\n")
            path = f.name
        try:
            self.assertEqual(judge.extract_assistant_text(path), "")
        finally:
            os.unlink(path)

    def test_non_text_blocks_excluded(self):
        lines = [json.dumps({"type": "assistant", "message": {"content": [
            {"type": "tool_use", "name": "Bash", "input": {"command": "ls"}},
        ]}})]
        with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonl", delete=False) as f:
            f.write("\n".join(lines))
            path = f.name
        try:
            self.assertEqual(judge.extract_assistant_text(path), "")
        finally:
            os.unlink(path)


class TestPreparePhase(unittest.TestCase):
    @patch("judge.fetch_arena_text")
    def test_writes_required_files(self, mock_fetch):
        mock_fetch.side_effect = lambda path, token: {
            "judge/popotron.md": "# Popotron persona",
            "fixtures/t/groundtruth/calibration.json": json.dumps(CALIBRATION),
            "fixtures/t/task.json": json.dumps({"fixture_id": "t", "turns": []}),
        }[path]
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = os.path.join(tmpdir, "run")
            os.makedirs(run_dir)
            with open(os.path.join(run_dir, "manifest.json"), "w") as f:
                json.dump({"run_id": "r", "fixture_id": "t"}, f)
            args = SimpleNamespace(
                judge_model="claude-opus-5",
                test_model="claude-sonnet-4-6",
                fixture_path="fixtures/t",
            )
            prev = os.getcwd()
            os.chdir(tmpdir)
            try:
                judge.prepare_phase(args, "tok", run_dir)
            finally:
                os.chdir(prev)
            self.assertTrue(os.path.exists(os.path.join(tmpdir, "CLAUDE.md")))
            self.assertTrue(os.path.exists(os.path.join(run_dir, "judge-prompt.txt")))
            ctx = json.loads(open(os.path.join(run_dir, "judge-context.json")).read())
            self.assertEqual(ctx["judge_model"], "claude-opus-5")
            self.assertEqual(ctx["calibration"], CALIBRATION)


class TestCollectPhase(unittest.TestCase):
    def _setup_run_dir(self, tmpdir, calibration):
        run_dir = os.path.join(tmpdir, "run")
        os.makedirs(run_dir)
        with open(os.path.join(run_dir, "manifest.json"), "w") as f:
            json.dump({"run_id": "r1", "fixture_id": "f1"}, f)
        ctx = {"judge_model": "claude-opus-5", "test_model": "claude-sonnet-4-6",
               "calibration": calibration}
        with open(os.path.join(run_dir, "judge-context.json"), "w") as f:
            json.dump(ctx, f)
        return run_dir

    def test_writes_judge_scores(self):
        structured = json.dumps({"dimensions": [
            {"id": "adaptability", "score": 4, "justification": "Good"},
            {"id": "okr_gate",     "score": 5, "justification": "Excellent"},
        ]})
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = self._setup_run_dir(tmpdir, CALIBRATION)
            args = SimpleNamespace(judge_model="", test_model="", fixture_path="")
            with patch.dict(os.environ, {"JUDGE_STRUCTURED_OUTPUT": structured}):
                judge.collect_phase(args, None, run_dir)
            scores = json.loads(open(os.path.join(run_dir, "judge-scores.json")).read())
            self.assertTrue(scores["calibration_agreement"])
            self.assertAlmostEqual(scores["overall"], 4.5)
            self.assertEqual(len(scores["dimensions"]), 2)

    def test_missing_env_var_exits(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = self._setup_run_dir(tmpdir, {"dimensions": []})
            args = SimpleNamespace(judge_model="", test_model="", fixture_path="")
            env = {k: v for k, v in os.environ.items() if k != "JUDGE_STRUCTURED_OUTPUT"}
            with patch.dict(os.environ, env, clear=True):
                with self.assertRaises(SystemExit):
                    judge.collect_phase(args, None, run_dir)


if __name__ == "__main__":
    unittest.main()
