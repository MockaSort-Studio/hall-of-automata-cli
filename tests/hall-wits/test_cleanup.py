#!/usr/bin/env python3
"""Unit tests for cleanup.py."""
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import cleanup  # noqa: E402

OPEN_ISSUES = [
    {"number": 1, "title": "seed one", "state": "open"},
    {"number": 2, "title": "seed two", "state": "open"},
]
MIXED_ISSUES = OPEN_ISSUES + [{"number": 3, "title": "already closed", "state": "closed"}]


class TestListIssuesPagination(unittest.TestCase):
    def test_stops_on_empty_page(self):
        pages = [[{"number": 1}] * 100, [{"number": 2}] * 100, []]
        with patch("cleanup.gh", side_effect=lambda *a, **k: pages.pop(0)):
            result = cleanup.list_issues("run:x", "tok")
        self.assertEqual(len(result), 200)

    def test_single_partial_page(self):
        pages = [[{"number": 1}], []]
        with patch("cleanup.gh", side_effect=lambda *a, **k: pages.pop(0)):
            result = cleanup.list_issues("run:x", "tok")
        self.assertEqual(len(result), 1)


class TestCloseAll(unittest.TestCase):
    def test_closes_only_open_issues(self):
        with patch("cleanup.list_issues", return_value=MIXED_ISSUES), \
             patch("cleanup.gh") as mock_gh:
            cleanup.close_all("run:x", "tok")
        patched_numbers = [c.args[1] for c in mock_gh.call_args_list]
        self.assertTrue(all("/1" in p or "/2" in p for p in patched_numbers))
        self.assertEqual(mock_gh.call_count, 2)


class TestVerifyClean(unittest.TestCase):
    def test_clean_returns_true(self):
        with patch("cleanup.list_issues", return_value=[]):
            self.assertTrue(cleanup.verify_clean("run:x", "tok"))

    def test_orphans_return_false(self):
        with patch("cleanup.list_issues", return_value=OPEN_ISSUES):
            self.assertFalse(cleanup.verify_clean("run:x", "tok"))


class TestDeleteLabel(unittest.TestCase):
    def test_calls_delete(self):
        with patch("cleanup.gh") as mock_gh:
            cleanup.delete_label("run:x", "tok")
        mock_gh.assert_called_once()
        self.assertEqual(mock_gh.call_args.args[0], "DELETE")


if __name__ == "__main__":
    unittest.main()
