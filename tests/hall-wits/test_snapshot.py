#!/usr/bin/env python3
"""Unit tests for snapshot.py."""
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))
import snapshot  # noqa: E402

ISSUES = [
    {"number": 1, "title": "seed one", "state": "open", "state_reason": None,
     "labels": [{"name": "run:x"}], "body": "body one", "created_at": "t1",
     "closed_at": None, "html_url": "https://x/1"},
    {"number": 2, "title": "seed two", "state": "closed", "state_reason": "completed",
     "labels": [{"name": "run:x"}], "body": "body two", "created_at": "t2",
     "closed_at": "t3", "html_url": "https://x/2"},
]


class TestSnapshot(unittest.TestCase):
    def test_captures_core_fields_and_sub_issues(self):
        with patch("cleanup.list_issues", return_value=ISSUES), \
             patch("cleanup.gh", return_value=[{"number": 3}]):
            entries = snapshot.snapshot("x", "/tmp/unused", None, "tok")
        self.assertEqual(len(entries), 2)
        self.assertEqual(entries[0]["number"], 1)
        self.assertEqual(entries[0]["sub_issues"], [3])
        self.assertEqual(entries[1]["state"], "closed")
        self.assertNotIn("board_fields", entries[0])

    def test_sorted_by_issue_number(self):
        unsorted = [ISSUES[1], ISSUES[0]]
        with patch("cleanup.list_issues", return_value=unsorted), \
             patch("cleanup.gh", return_value=[]):
            entries = snapshot.snapshot("x", "/tmp/unused", None, "tok")
        self.assertEqual([e["number"] for e in entries], [1, 2])

    def test_includes_board_fields_when_project_number_given(self):
        with patch("cleanup.list_issues", return_value=[ISSUES[0]]), \
             patch("cleanup.gh", return_value=[]), \
             patch("checker._project_item_fields", return_value={"Status": "Backlog"}):
            entries = snapshot.snapshot("x", "/tmp/unused", 9, "tok")
        self.assertEqual(entries[0]["board_fields"], {"Status": "Backlog"})


if __name__ == "__main__":
    unittest.main()
