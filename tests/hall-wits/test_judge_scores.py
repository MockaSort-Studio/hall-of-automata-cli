#!/usr/bin/env python3
"""Unit tests for judge-scores.py."""
import importlib.util
import json
import os
import tempfile
import unittest
from unittest.mock import patch

_spec = importlib.util.spec_from_file_location(
    "judge_scores",
    os.path.join(os.path.dirname(__file__), "judge-scores.py"),
)
judge_scores = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(judge_scores)

CALIBRATION = {
    "dimensions": [
        {"id": "adaptability", "direction": "high", "expected_score_min": 4},
        {"id": "okr_gate",     "direction": "high", "expected_score_min": 4},
    ]
}


class TestCheckCalibrationAgreement(unittest.TestCase):
    def test_all_agree(self):
        dims = [
            {"id": "adaptability", "score": 4},
            {"id": "okr_gate",     "score": 5},
        ]
        self.assertEqual(judge_scores.check_calibration_agreement(dims, CALIBRATION), [])

    def test_below_minimum_flags(self):
        dims = [
            {"id": "adaptability", "score": 2},
            {"id": "okr_gate",     "score": 5},
        ]
        mismatches = judge_scores.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 1)
        self.assertIn("adaptability", mismatches[0])

    def test_unknown_dimension_skipped(self):
        dims = [{"id": "nonexistent", "score": 1}]
        mismatches = judge_scores.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 2)
        ids = " ".join(mismatches)
        self.assertIn("adaptability", ids)
        self.assertIn("okr_gate", ids)

    def test_missing_calibration_dimension_flags(self):
        dims = [{"id": "adaptability", "score": 4}]
        mismatches = judge_scores.check_calibration_agreement(dims, CALIBRATION)
        self.assertEqual(len(mismatches), 1)
        self.assertIn("okr_gate", mismatches[0])

    def test_low_direction_inverts_check(self):
        cal = {"dimensions": [{"id": "foo", "direction": "low", "expected_score_min": 3}]}
        self.assertEqual(judge_scores.check_calibration_agreement([{"id": "foo", "score": 1}], cal), [])
        self.assertNotEqual(judge_scores.check_calibration_agreement([{"id": "foo", "score": 4}], cal), [])

    def test_all_dimensions_below_flags_all(self):
        dims = [
            {"id": "adaptability", "score": 1},
            {"id": "okr_gate",     "score": 2},
        ]
        self.assertEqual(len(judge_scores.check_calibration_agreement(dims, CALIBRATION)), 2)


class TestWriteJudgeScores(unittest.TestCase):
    def _setup_run_dir(self, tmpdir, calibration):
        run_dir = os.path.join(tmpdir, "run")
        os.makedirs(run_dir)
        with open(os.path.join(run_dir, "manifest.json"), "w") as f:
            json.dump({"run_id": "r1", "fixture_id": "f1"}, f)
        with open(os.path.join(run_dir, "calibration.json"), "w") as f:
            json.dump(calibration, f)
        return run_dir

    def test_writes_judge_scores(self):
        structured = json.dumps({
            "assessment": "Clean run, one minor gap on scope discipline.",
            "dimensions": [
                {"id": "adaptability", "score": 4, "justification": "Good"},
                {"id": "okr_gate",     "score": 5, "justification": "Excellent"},
            ],
        })
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = self._setup_run_dir(tmpdir, CALIBRATION)
            with patch.dict(os.environ, {"JUDGE_STRUCTURED_OUTPUT": structured}):
                judge_scores.collect(run_dir, "claude-opus-5", "claude-sonnet-4-6")
            scores = json.loads(open(os.path.join(run_dir, "judge-scores.json")).read())
            self.assertTrue(scores["calibration_agreement"])
            self.assertAlmostEqual(scores["overall"], 4.5)
            self.assertEqual(len(scores["dimensions"]), 2)
            self.assertEqual(scores["assessment"], "Clean run, one minor gap on scope discipline.")

    def test_missing_assessment_defaults_empty(self):
        structured = json.dumps({"dimensions": [
            {"id": "adaptability", "score": 4, "justification": "Good"},
            {"id": "okr_gate",     "score": 5, "justification": "Excellent"},
        ]})
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = self._setup_run_dir(tmpdir, CALIBRATION)
            with patch.dict(os.environ, {"JUDGE_STRUCTURED_OUTPUT": structured}):
                judge_scores.collect(run_dir, "claude-opus-5", "claude-sonnet-4-6")
            scores = json.loads(open(os.path.join(run_dir, "judge-scores.json")).read())
            self.assertEqual(scores["assessment"], "")

    def test_missing_env_var_exits(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            run_dir = self._setup_run_dir(tmpdir, {"dimensions": []})
            env = {k: v for k, v in os.environ.items() if k != "JUDGE_STRUCTURED_OUTPUT"}
            with patch.dict(os.environ, env, clear=True):
                with self.assertRaises(SystemExit):
                    judge_scores.collect(run_dir, "claude-opus-5", "claude-sonnet-4-6")


if __name__ == "__main__":
    unittest.main()
