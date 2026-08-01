#!/usr/bin/env python3
"""Unit tests for judge.py."""
import json
import os
import sys
import tempfile
import unittest

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
        # nonexistent is not in calibration, but calibration dims ARE missing -> 2 mismatches
        mismatches = judge.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 2)
        ids = " ".join(mismatches)
        self.assertIn("adaptability", ids)
        self.assertIn("okr_gate", ids)

    def test_missing_calibration_dimension_flags(self):
        dims = [{"id": "adaptability", "score": 4}]  # okr_gate absent from judge response
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


class TestExtractJsonBlock(unittest.TestCase):
    def test_plain_json(self):
        text = '{"dimensions": []}'
        self.assertEqual(json.loads(judge.extract_json_block(text)), {"dimensions": []})

    def test_fenced_json(self):
        text = '```json\n{"dimensions": []}\n```'
        self.assertEqual(json.loads(judge.extract_json_block(text)), {"dimensions": []})

    def test_fenced_without_language(self):
        text = '```\n{"dimensions": []}\n```'
        self.assertEqual(json.loads(judge.extract_json_block(text)), {"dimensions": []})

    def test_returns_empty_on_no_json(self):
        self.assertEqual(judge.extract_json_block("no json here"), "")

    def test_json_with_surrounding_text(self):
        text = 'Here is my assessment:\n{"dimensions": []}\nEnd.'
        self.assertEqual(json.loads(judge.extract_json_block(text)), {"dimensions": []})


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


if __name__ == "__main__":
    unittest.main()
