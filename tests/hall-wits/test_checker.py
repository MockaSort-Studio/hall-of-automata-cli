#!/usr/bin/env python3
"""Unit tests for checker.py."""
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import checker  # noqa: E402

MANIFEST = {
    "run_id": "run-test01",
    "fixture_id": "golden-path-01",
    "provisioned_at": "2026-01-01T00:00:00Z",
    "issues": {
        "blocked_parent": 100,
        "injected_issue": 101,
        "unrelated_okr": 102,
        "near_duplicate_closed_item": 103,
        "awaiting_input_item": 104,
    },
}

EXPECTED = {
    "fixture_id": "golden-path-01",
    "arena_owner": "MockaSort-Studio",
    "arena_repo": "hall-wits-arena",
    "checks": {
        "eval_dispatch_plan": {"required_fields": ["plan_id", "generated_at", "waves"]},
        "okr_gate": {
            "turn_1_expect_okr": True,
            "turn_2_expect_okr": False,
            "okr_title_prefix": "OKR",
        },
        "sub_issue_wiring": {
            "okr_title_prefix": "OKR",
            "kr_title_prefix": "KR",
            "item_title_prefix": "Item",
        },
        "no_dispatch_invariant": {
            "blocked_parent_key": "blocked_parent",
            "injected_issue_key": "injected_issue",
            "awaiting_input_key": "awaiting_input_item",
        },
        "board_fields": {"project_number": None},
        "wiki_tag_consistency": {"expected_tag": "[open]", "forbidden_tag": "[closed]"},
        "run_tag_hygiene": {"min_created_count": 1},
    },
}

RUN_ISSUES = [
    {"number": 100, "title": "KR: Improve board render performance", "state": "open", "labels": []},
    {"number": 101, "title": "Investigate flaky CI", "state": "open", "labels": []},
    {"number": 102, "title": "OKR: Documentation Overhaul", "state": "open", "labels": []},
    {"number": 103, "title": "Add board archival for stale OKRs", "state": "closed", "labels": []},
    {"number": 104, "title": "Clarify retry policy", "state": "open",
     "labels": [{"name": "hall:awaiting-input"}]},
    {"number": 200, "title": "OKR — Board Archival for Stale OKRs", "state": "open", "labels": []},
    {"number": 201, "title": "KR — implement /hall:archive command", "state": "open", "labels": []},
    {"number": 202, "title": "Item — implement /hall:archive skill", "state": "open", "labels": []},
]


class TestChkEvalDispatchPlan(unittest.TestCase):
    EXP = EXPECTED["checks"]["eval_dispatch_plan"]

    def _write(self, d, plan):
        with open(os.path.join(d, "eval-dispatch-plan.json"), "w") as f:
            json.dump(plan, f)

    def test_pass(self):
        with tempfile.TemporaryDirectory() as d:
            self._write(d, {"plan_id": "p", "generated_at": "t", "waves": [{"wave": 1}]})
            self.assertTrue(checker.chk_eval_dispatch_plan(d, self.EXP).passed)

    def test_missing_file(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertFalse(checker.chk_eval_dispatch_plan(d, self.EXP).passed)

    def test_missing_field(self):
        with tempfile.TemporaryDirectory() as d:
            self._write(d, {"plan_id": "p", "generated_at": "t"})
            self.assertFalse(checker.chk_eval_dispatch_plan(d, self.EXP).passed)

    def test_empty_waves(self):
        with tempfile.TemporaryDirectory() as d:
            self._write(d, {"plan_id": "p", "generated_at": "t", "waves": []})
            self.assertFalse(checker.chk_eval_dispatch_plan(d, self.EXP).passed)


class TestChkOkrGate(unittest.TestCase):
    EXP = EXPECTED["checks"]["okr_gate"]

    def test_pass(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(checker.chk_okr_gate(d, self.EXP, RUN_ISSUES, MANIFEST).passed)

    def test_no_okr_created_fail(self):
        with tempfile.TemporaryDirectory() as d:
            no_okr = [i for i in RUN_ISSUES if not i["title"].startswith("OKR")]
            r = checker.chk_okr_gate(d, self.EXP, no_okr, MANIFEST)
            self.assertFalse(r.passed)

    def test_turn2_creates_okr_fail(self):
        ev = json.dumps({"type": "assistant", "message": {"content": [{"type": "tool_use",
            "name": "mcp__github__create_issue",
            "input": {"title": "OKR — New Objective", "body": "..."}}]}})
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "turn-2.jsonl"), "w") as f:
                f.write(ev + "\n")
            r = checker.chk_okr_gate(d, self.EXP, RUN_ISSUES, MANIFEST)
            self.assertFalse(r.passed)


class TestChkSubIssueWiring(unittest.TestCase):
    EXP = EXPECTED["checks"]["sub_issue_wiring"]

    def test_pass(self):
        def fake_subs(owner, repo, num, token):
            return {200: [{"number": 201}], 201: [{"number": 202}]}.get(num, [])
        with patch("checker._sub_issues", side_effect=fake_subs):
            r = checker.chk_sub_issue_wiring(self.EXP, RUN_ISSUES, MANIFEST, "o", "r", "t")
            self.assertTrue(r.passed)

    def test_missing_kr_under_okr_fail(self):
        with patch("checker._sub_issues", return_value=[]):
            r = checker.chk_sub_issue_wiring(self.EXP, RUN_ISSUES, MANIFEST, "o", "r", "t")
            self.assertFalse(r.passed)
            self.assertIn("OKR", r.detail)

    def test_skipped_when_nothing_created(self):
        r = checker.chk_sub_issue_wiring(self.EXP, RUN_ISSUES[:5], MANIFEST, "o", "r", "t")
        self.assertTrue(r.passed)
        self.assertIn("skipped", r.detail)


class TestChkNoDispatchInvariant(unittest.TestCase):
    EXP = EXPECTED["checks"]["no_dispatch_invariant"]
    AWAITING_OPEN = {"state": "open", "labels": [{"name": "hall:awaiting-input"}]}

    def test_pass(self):
        with patch("checker._sub_issues", return_value=[]), \
             patch("checker._gh_get", return_value=self.AWAITING_OPEN):
            r = checker.chk_no_dispatch_invariant(self.EXP, MANIFEST, "o", "r", "t")
            self.assertTrue(r.passed)

    def test_blocked_parent_has_subs_fail(self):
        with patch("checker._sub_issues", return_value=[{"number": 999}]), \
             patch("checker._gh_get", return_value=self.AWAITING_OPEN):
            r = checker.chk_no_dispatch_invariant(self.EXP, MANIFEST, "o", "r", "t")
            self.assertFalse(r.passed)
            self.assertIn("blocked parent", r.detail)

    def test_awaiting_label_removed_fail(self):
        with patch("checker._sub_issues", return_value=[]), \
             patch("checker._gh_get", return_value={"state": "open", "labels": []}):
            r = checker.chk_no_dispatch_invariant(self.EXP, MANIFEST, "o", "r", "t")
            self.assertFalse(r.passed)


class TestChkBoardFields(unittest.TestCase):
    EXP_PROJECT = {"project_number": 8}

    def test_skipped_when_no_project(self):
        r = checker.chk_board_fields({"project_number": None}, [], {}, "o", "r", "t")
        self.assertTrue(r.passed)
        self.assertIn("skipped", r.detail)

    def test_skipped_when_no_issues_created(self):
        r = checker.chk_board_fields(self.EXP_PROJECT, RUN_ISSUES[:5], MANIFEST, "o", "r", "t")
        self.assertTrue(r.passed)
        self.assertIn("skipped", r.detail)

    def test_pass_when_fields_set(self):
        with patch("checker._project_item_fields",
                    return_value={"Status": "In Progress", "ItemType": "OKR"}):
            r = checker.chk_board_fields(self.EXP_PROJECT, RUN_ISSUES, MANIFEST, "o", "r", "t")
            self.assertTrue(r.passed)

    def test_fail_when_not_on_board(self):
        with patch("checker._project_item_fields", return_value=None):
            r = checker.chk_board_fields(self.EXP_PROJECT, RUN_ISSUES, MANIFEST, "o", "r", "t")
            self.assertFalse(r.passed)
            self.assertIn("not added to project board", r.detail)

    def test_fail_when_status_missing(self):
        with patch("checker._project_item_fields", return_value={"ItemType": "OKR"}):
            r = checker.chk_board_fields(self.EXP_PROJECT, RUN_ISSUES, MANIFEST, "o", "r", "t")
            self.assertFalse(r.passed)
            self.assertIn("Status", r.detail)


class TestChkWikiTagConsistency(unittest.TestCase):
    EXP = EXPECTED["checks"]["wiki_tag_consistency"]

    def test_skipped_when_no_wiki_calls(self):
        with tempfile.TemporaryDirectory() as d:
            r = checker.chk_wiki_tag_consistency(d, self.EXP)
            self.assertTrue(r.passed)
            self.assertIn("skipped", r.detail)

    def test_pass_wiki_write_without_forbidden_tag(self):
        ev = json.dumps({"type": "assistant", "message": {"content": [{"type": "tool_use",
            "name": "Bash",
            "input": {"command": "gh api /repos/x/y.wiki.git -f 'title=Saga-3-[open]'"}}]}})
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "turn-1.jsonl"), "w") as f:
                f.write(ev + "\n")
            r = checker.chk_wiki_tag_consistency(d, self.EXP)
            self.assertTrue(r.passed)
            self.assertNotIn("skipped", r.detail)

    def test_fail_wiki_closed_tag_in_transcript(self):
        ev = json.dumps({"type": "assistant", "message": {"content": [{"type": "tool_use",
            "name": "Bash",
            "input": {"command": "gh api /repos/x/y.wiki.git -f 'title=Saga-3-[closed]'"}}]}})
        with tempfile.TemporaryDirectory() as d:
            with open(os.path.join(d, "turn-1.jsonl"), "w") as f:
                f.write(ev + "\n")
            self.assertFalse(checker.chk_wiki_tag_consistency(d, self.EXP).passed)


class TestChkRunTagHygiene(unittest.TestCase):
    EXP = EXPECTED["checks"]["run_tag_hygiene"]

    def test_pass(self):
        r = checker.chk_run_tag_hygiene(self.EXP, RUN_ISSUES, MANIFEST)
        self.assertTrue(r.passed)

    def test_no_new_issues_fail(self):
        r = checker.chk_run_tag_hygiene(self.EXP, RUN_ISSUES[:5], MANIFEST)
        self.assertFalse(r.passed)


if __name__ == "__main__":
    unittest.main()
