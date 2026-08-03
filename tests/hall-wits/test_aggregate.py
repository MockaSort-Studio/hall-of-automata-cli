#!/usr/bin/env python3
"""Unit tests for aggregate.py."""
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import aggregate  # noqa: E402


def _write_iteration(base, name, checker_lines, scores):
    run_path = os.path.join(base, name)
    os.makedirs(os.path.join(run_path, "run-dir"), exist_ok=True)
    with open(os.path.join(run_path, "checker-output.txt"), "w") as f:
        f.write("\n".join(checker_lines) + "\n")
    with open(os.path.join(run_path, "run-dir", "judge-scores.json"), "w") as f:
        json.dump(scores, f)


class TestAggregate(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_load_runs_reads_all_iterations(self):
        _write_iteration(self.tmp, "hall-wits-run-a", ["✅ chk_one: ok"], {"overall": 4})
        _write_iteration(self.tmp, "hall-wits-run-b", ["❌ chk_one: bad"], {"overall": 2})
        runs = aggregate._load_runs(self.tmp)
        self.assertEqual(len(runs), 2)
        self.assertEqual(runs[0]["name"], "hall-wits-run-a")
        self.assertEqual(runs[1]["scores"]["overall"], 2)

    def test_load_runs_skips_non_directories(self):
        with open(os.path.join(self.tmp, "stray-file.txt"), "w") as f:
            f.write("noise")
        _write_iteration(self.tmp, "hall-wits-run-a", ["✅ chk_one: ok"], {"overall": 4})
        runs = aggregate._load_runs(self.tmp)
        self.assertEqual(len(runs), 1)

    def test_load_runs_tolerates_missing_files(self):
        os.makedirs(os.path.join(self.tmp, "hall-wits-run-empty"))
        runs = aggregate._load_runs(self.tmp)
        self.assertEqual(runs[0]["checker_out"], "")
        self.assertEqual(runs[0]["scores"], {})

    def test_load_runs_tolerates_malformed_json(self):
        run_path = os.path.join(self.tmp, "hall-wits-run-bad")
        os.makedirs(os.path.join(run_path, "run-dir"))
        with open(os.path.join(run_path, "run-dir", "judge-scores.json"), "w") as f:
            f.write("{not json")
        runs = aggregate._load_runs(self.tmp)
        self.assertEqual(runs[0]["scores"], {})

    def test_check_pass_rates_counts_across_runs(self):
        runs = [
            {"checker_out": "✅ chk_a: ok\n❌ chk_b: bad", "scores": {}},
            {"checker_out": "✅ chk_a: ok\n✅ chk_b: ok", "scores": {}},
        ]
        counts = aggregate.check_pass_rates(runs)
        self.assertEqual(counts["chk_a"], {"pass": 2, "fail": 0, "skip": 0})
        self.assertEqual(counts["chk_b"], {"pass": 1, "fail": 1, "skip": 0})

    def test_check_pass_rates_counts_skips(self):
        runs = [{"checker_out": "⏭️ chk_a: skipped", "scores": {}}]
        counts = aggregate.check_pass_rates(runs)
        self.assertEqual(counts["chk_a"]["skip"], 1)

    def test_dimension_stats_computes_mean_min_max(self):
        runs = [
            {"scores": {"dimensions": [{"id": "clarity", "score": 3}, {"id": "safety", "score": 5}]}},
            {"scores": {"dimensions": [{"id": "clarity", "score": 5}]}},
        ]
        stats = aggregate.dimension_stats(runs)
        self.assertEqual(stats["clarity"], {"mean": 4.0, "min": 3, "max": 5, "n": 2})
        self.assertEqual(stats["safety"], {"mean": 5.0, "min": 5, "max": 5, "n": 1})

    def test_format_report_handles_zero_iterations(self):
        report = aggregate.format_report([])
        self.assertIn("No iteration artifacts found", report)

    def test_format_report_marks_check_failed_if_any_iteration_fails(self):
        runs = [
            {"name": "run-a", "checker_out": "✅ chk_a: ok", "scores": {"overall": 4}},
            {"name": "run-b", "checker_out": "❌ chk_a: bad", "scores": {"overall": 2}},
        ]
        report = aggregate.format_report(runs)
        self.assertIn("❌ `chk_a`", report)

    def test_format_report_includes_overall_mean_and_calibration(self):
        runs = [
            {"name": "run-a", "checker_out": "", "scores": {"overall": 4, "calibration_agreement": True}},
            {"name": "run-b", "checker_out": "", "scores": {"overall": 2, "calibration_agreement": False}},
        ]
        report = aggregate.format_report(runs)
        self.assertIn("Overall mean:", report)
        self.assertIn("Calibration agreement:** 1/2", report)

    def test_format_report_per_iteration_summary_lists_each_run(self):
        runs = [
            {"name": "hall-wits-run-a", "checker_out": "✅ chk_a: ok", "scores": {"overall": 4}},
            {"name": "hall-wits-run-b", "checker_out": "❌ chk_a: bad", "scores": {"overall": 2}},
        ]
        report = aggregate.format_report(runs)
        self.assertIn("hall-wits-run-a", report)
        self.assertIn("hall-wits-run-b", report)


if __name__ == "__main__":
    unittest.main()
