#!/usr/bin/env python3
"""Unit tests for report.py."""
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import report  # noqa: E402


class TestDefuseIssueRefs(unittest.TestCase):
    def test_wraps_bare_ref(self):
        self.assertEqual(
            report.defuse_issue_refs("KR #75: no Item sub-issue"),
            "KR `hall-wits-arena#75`: no Item sub-issue",
        )

    def test_wraps_multiple_refs(self):
        out = report.defuse_issue_refs("#74 and #75 and #76")
        self.assertEqual(out, "`hall-wits-arena#74` and `hall-wits-arena#75` and `hall-wits-arena#76`")

    def test_skips_already_wrapped(self):
        already = "`hall-wits-arena#74`"
        self.assertEqual(report.defuse_issue_refs(already), already)

    def test_no_refs_unchanged(self):
        text = "no issue numbers here"
        self.assertEqual(report.defuse_issue_refs(text), text)


class TestFormatJudgeSection(unittest.TestCase):
    def _write_scores(self, d, data):
        path = os.path.join(d, "judge-scores.json")
        with open(path, "w") as f:
            json.dump(data, f)
        return path

    def test_missing_file_returns_unavailable(self):
        with tempfile.TemporaryDirectory() as d:
            table, summary = report.format_judge_section(os.path.join(d, "nope.json"))
        self.assertEqual(table, "(judge scores unavailable)")
        self.assertEqual(summary, "")

    def test_justification_issue_refs_defused(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_scores(d, {
                "dimensions": [
                    {"id": "scope_discipline", "score": 5,
                     "justification": "Verified #71 is untouched"},
                ],
                "overall": 5, "calibration_agreement": True, "calibration_mismatches": [],
            })
            table, _ = report.format_judge_section(path)
        self.assertIn("`hall-wits-arena#71`", table)
        self.assertNotIn("Verified #71 is untouched", table)  # bare form must not survive

    def test_derivation_rendered_in_details_block(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_scores(d, {
                "dimensions": [
                    {"id": "okr_gate", "score": 5, "justification": "ok",
                     "derivation": "quoted transcript line re #74"},
                ],
                "overall": 5, "calibration_agreement": True, "calibration_mismatches": [],
            })
            table, _ = report.format_judge_section(path)
        self.assertIn("<details>", table)
        self.assertIn("`hall-wits-arena#74`", table)

    def test_calibration_mismatch_listed(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_scores(d, {
                "dimensions": [],
                "overall": 2, "calibration_agreement": False,
                "calibration_mismatches": ["okr_gate: scored 1, expected high"],
            })
            _, summary = report.format_judge_section(path)
        self.assertIn("⚠️ mismatch", summary)
        self.assertIn("okr_gate: scored 1", summary)

    def test_assessment_rendered_and_defused(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_scores(d, {
                "assessment": "Solid run overall; see #74 for the one gap.",
                "dimensions": [],
                "overall": 4, "calibration_agreement": True, "calibration_mismatches": [],
            })
            _, summary = report.format_judge_section(path)
        self.assertIn("**Assessment:**", summary)
        self.assertIn("`hall-wits-arena#74`", summary)

    def test_missing_assessment_omits_block(self):
        with tempfile.TemporaryDirectory() as d:
            path = self._write_scores(d, {
                "dimensions": [],
                "overall": 4, "calibration_agreement": True, "calibration_mismatches": [],
            })
            _, summary = report.format_judge_section(path)
        self.assertNotIn("**Assessment:**", summary)


if __name__ == "__main__":
    unittest.main()
