#!/usr/bin/env python3
"""Unit tests for cleanup.py."""
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import cleanup  # noqa: E402

OPEN_ISSUES = [
    {"number": 1, "title": "seed one", "state": "open", "created_at": "2026-01-01T00:00:01Z",
     "node_id": "n1"},
    {"number": 2, "title": "seed two", "state": "open", "created_at": "2026-01-01T00:00:02Z",
     "node_id": "n2"},
]
MIXED_ISSUES = OPEN_ISSUES + [
    {"number": 3, "title": "already closed", "state": "closed", "created_at": "2026-01-01T00:00:03Z",
     "node_id": "n3"},
]


def _write_manifest(run_dir, provisioned_at):
    with open(os.path.join(run_dir, "manifest.json"), "w") as f:
        json.dump({"provisioned_at": provisioned_at}, f)


class TestListIssuesPagination(unittest.TestCase):
    def test_stops_on_empty_page(self):
        pages = [[{"number": i} for i in range(100)],
                 [{"number": i} for i in range(100, 200)], []]
        with patch("cleanup.gh", side_effect=lambda *a, **k: pages.pop(0)):
            result = cleanup.list_issues("run:x", None, "tok")
        self.assertEqual(len(result), 200)

    def test_single_partial_page(self):
        pages = [[{"number": 1}], []]
        with patch("cleanup.gh", side_effect=lambda *a, **k: pages.pop(0)):
            result = cleanup.list_issues("run:x", None, "tok")
        self.assertEqual(len(result), 1)


class TestListIssuesByTimestamp(unittest.TestCase):
    """Coverage for the gap that let real Old-Major-created issues (no
    run:<run_id> label — the real plugin skills don't apply one) go
    permanently orphaned: matching by created_at > provisioned_at too."""

    def test_no_run_dir_is_label_only(self):
        with patch("cleanup.gh", return_value=[]) as mock_gh:
            cleanup.list_issues("run:x", None, "tok")
        self.assertEqual(mock_gh.call_count, 1)
        self.assertIn("labels=", mock_gh.call_args.args[1])

    def test_unlabeled_issue_found_via_since(self):
        with tempfile.TemporaryDirectory() as d:
            _write_manifest(d, "2026-01-01T00:00:00Z")
            labeled = [{"number": 1, "title": "seeded", "state": "open",
                        "created_at": "2026-01-01T00:00:01Z"}]
            unlabeled = [{"number": 2, "title": "real OKR, no label", "state": "open",
                          "created_at": "2026-01-01T00:00:02Z"}]
            pages = {"labels=run%3Ax": [labeled, []],
                     "since=2026-01-01T00%3A00%3A00Z": [unlabeled, []]}

            def fake_gh(method, path, token):
                for key, batches in pages.items():
                    if key in path:
                        return batches.pop(0)
                return []

            with patch("cleanup.gh", side_effect=fake_gh):
                result = cleanup.list_issues("run:x", d, "tok")
        self.assertEqual({i["number"] for i in result}, {1, 2})

    def test_dedupes_issue_matched_by_both(self):
        with tempfile.TemporaryDirectory() as d:
            _write_manifest(d, "2026-01-01T00:00:00Z")
            same_issue = {"number": 1, "title": "seeded", "state": "open",
                          "created_at": "2026-01-01T00:00:01Z"}
            pages = {"labels=run%3Ax": [[same_issue], []],
                     "since=2026-01-01T00%3A00%3A00Z": [[same_issue], []]}

            def fake_gh(method, path, token):
                for key, batches in pages.items():
                    if key in path:
                        return batches.pop(0)
                return []

            with patch("cleanup.gh", side_effect=fake_gh):
                result = cleanup.list_issues("run:x", d, "tok")
        self.assertEqual(len(result), 1)

    def test_missing_manifest_falls_back_to_label_only(self):
        with tempfile.TemporaryDirectory() as d:
            with patch("cleanup.gh", return_value=[]) as mock_gh:
                cleanup.list_issues("run:x", d, "tok")
        self.assertEqual(mock_gh.call_count, 1)


class TestDeleteAll(unittest.TestCase):
    def test_deletes_every_matched_issue_regardless_of_state(self):
        """hall-wits-arena is disposable — delete_all removes everything found,
        including already-closed seed issues (e.g. near_duplicate_closed_item),
        not just open ones. Otherwise closed issues linger on the board
        forever across every future eval run."""
        with patch("cleanup.list_issues", return_value=MIXED_ISSUES), \
             patch("cleanup.gh_graphql") as mock_graphql:
            cleanup.delete_all("run:x", None, "tok")
        deleted_ids = [c.args[1]["id"] for c in mock_graphql.call_args_list]
        self.assertEqual(set(deleted_ids), {"n1", "n2", "n3"})
        self.assertEqual(mock_graphql.call_count, 3)


class TestVerifyClean(unittest.TestCase):
    def test_clean_returns_true(self):
        with patch("cleanup.list_issues", return_value=[]):
            self.assertTrue(cleanup.verify_clean("run:x", None, "tok"))

    def test_orphans_return_false(self):
        with patch("cleanup.list_issues", return_value=OPEN_ISSUES):
            self.assertFalse(cleanup.verify_clean("run:x", None, "tok"))

    def test_already_closed_orphan_still_flagged(self):
        """A failed delete leaves an already-closed issue behind — state=="open"
        alone can't be the signal for "cleanup succeeded" once cleanup means
        delete, not close."""
        with patch("cleanup.list_issues", return_value=[MIXED_ISSUES[-1]]):
            self.assertFalse(cleanup.verify_clean("run:x", None, "tok"))


class TestDeleteLabel(unittest.TestCase):
    def test_calls_delete(self):
        with patch("cleanup.gh") as mock_gh:
            cleanup.delete_label("run:x", "tok")
        mock_gh.assert_called_once()
        self.assertEqual(mock_gh.call_args.args[0], "DELETE")


if __name__ == "__main__":
    unittest.main()
