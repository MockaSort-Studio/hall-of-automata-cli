#!/usr/bin/env python3
"""Unit tests for runner.py."""
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))
import runner  # noqa: E402

FAKE_JSONL = "\n".join([
    json.dumps({"type": "assistant", "message": {"content": [
        {"type": "tool_use", "id": "t1", "name": "Bash",
         "input": {"command": "ls"}},
        {"type": "tool_use", "id": "t2", "name": "Read",
         "input": {"file_path": "/tmp/x"}},
    ]}}),
    json.dumps({"type": "result",
                "usage": {"input_tokens": 100, "output_tokens": 50},
                "session_id": "sess-abc123"}),
])


class TestParseMetrics(unittest.TestCase):
    def test_counts_tokens_turns_tool_calls(self):
        m = runner.parse_metrics(FAKE_JSONL.splitlines())
        self.assertEqual(m["tokens"], 150)
        self.assertEqual(m["turns"], 1)
        self.assertEqual(m["tool_calls"], 2)

    def test_empty_input(self):
        m = runner.parse_metrics([])
        self.assertEqual(m, {"tokens": 0, "turns": 0, "tool_calls": 0})

    def test_invalid_json_skipped(self):
        m = runner.parse_metrics(["not-json", '{"type":"result","usage":{}}'])
        self.assertEqual(m["tokens"], 0)

    def test_multiple_result_events_summed(self):
        lines = [
            json.dumps({"type": "result",
                        "usage": {"input_tokens": 10, "output_tokens": 5}}),
            json.dumps({"type": "result",
                        "usage": {"input_tokens": 20, "output_tokens": 10}}),
        ]
        m = runner.parse_metrics(lines)
        self.assertEqual(m["tokens"], 45)


class TestExtractSessionId(unittest.TestCase):
    def test_finds_session_id_from_result(self):
        self.assertEqual(
            runner.extract_session_id(FAKE_JSONL.splitlines()), "sess-abc123"
        )

    def test_returns_none_when_absent(self):
        self.assertIsNone(runner.extract_session_id([]))

    def test_returns_none_on_invalid_json(self):
        self.assertIsNone(runner.extract_session_id(["bad-json"]))


class TestCheckNoSpecialistLabels(unittest.TestCase):
    def test_clean_transcript_passes(self):
        self.assertEqual(
            runner.check_no_specialist_labels(FAKE_JSONL.splitlines()), []
        )

    def test_bash_specialist_label_flagged(self):
        ev = json.dumps({"type": "tool_use", "name": "Bash",
                         "input": {"command": 'gh issue edit 42 --add-label "hall:snowball"'}})
        self.assertEqual(len(runner.check_no_specialist_labels([ev])), 1)

    def test_github_tool_specialist_label_flagged(self):
        ev = json.dumps({"type": "tool_use", "name": "mcp__github__update_issue",
                         "input": {"labels": ["hall:pyrate"]}})
        self.assertEqual(len(runner.check_no_specialist_labels([ev])), 1)

    def test_non_specialist_hall_label_not_flagged(self):
        ev = json.dumps({"type": "tool_use", "name": "Bash",
                         "input": {"command": 'gh issue edit 42 --add-label "hall:awaiting-input"'}})
        self.assertEqual(runner.check_no_specialist_labels([ev]), [])

    def test_unrelated_label_not_flagged(self):
        ev = json.dumps({"type": "tool_use", "name": "Bash",
                         "input": {"command": 'gh issue edit 42 --add-label "type/item"'}})
        self.assertEqual(runner.check_no_specialist_labels([ev]), [])

    def test_gh_api_labels_array_flagged(self):
        ev = json.dumps({"type": "tool_use", "name": "Bash",
                         "input": {"command": "gh api /repos/x/y/issues/1 -f 'labels[]=hall:snowball'"}})
        self.assertEqual(len(runner.check_no_specialist_labels([ev])), 1)


class TestRunTurn(unittest.TestCase):
    def _mock_result(self, stdout, returncode=0, stderr=""):
        m = MagicMock()
        m.stdout, m.returncode, m.stderr = stdout, returncode, stderr
        return m

    def test_writes_transcript_returns_lines(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "turn-1.jsonl")
            with patch("subprocess.run", return_value=self._mock_result(FAKE_JSONL)):
                lines = runner.run_turn("prompt", "cc", None, out, d)
            self.assertTrue(os.path.exists(out))
            self.assertEqual(len(lines), 2)

    def test_resume_flag_appended_when_session_id_given(self):
        with tempfile.TemporaryDirectory() as d:
            with patch("subprocess.run", return_value=self._mock_result(FAKE_JSONL)) as m:
                runner.run_turn("p", "cc", None, os.path.join(d, "t.jsonl"), d,
                                session_id="ses-1")
            cmd = m.call_args[0][0]
            self.assertIn("--resume", cmd)
            self.assertIn("ses-1", cmd)

    def test_raises_on_failure_with_no_output(self):
        with tempfile.TemporaryDirectory() as d:
            with patch("subprocess.run",
                       return_value=self._mock_result("", returncode=1, stderr="err")):
                with self.assertRaises(RuntimeError):
                    runner.run_turn("p", "cc", None, os.path.join(d, "t.jsonl"), d)

    def test_isolated_home_created_and_seeded(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "t.jsonl")
            with patch("subprocess.run", return_value=self._mock_result(FAKE_JSONL)) as m:
                runner.run_turn("p", "cc", None, out, d)
            env = m.call_args[1]["env"]
            self.assertEqual(env["HOME"], os.path.join(d, "home"))
            slug = os.path.join(d, "home", ".hall", ".repo-slug")
            with open(slug) as f:
                self.assertIn(runner.ARENA_REPO, f.read())

    def test_gh_tokens_set_from_arena_token(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "t.jsonl")
            with patch.dict(os.environ, {"HALL_WITS_ARENA_TOKEN": "tok-123"}), \
                 patch("subprocess.run", return_value=self._mock_result(FAKE_JSONL)) as m:
                runner.run_turn("p", "cc", None, out, d)
            env = m.call_args[1]["env"]
            self.assertEqual(env["GH_TOKEN"], "tok-123")
            self.assertEqual(env["GITHUB_TOKEN"], "tok-123")
            self.assertEqual(env["GITHUB_PERSONAL_ACCESS_TOKEN"], "tok-123")

    def test_skip_permissions_flag_present(self):
        with tempfile.TemporaryDirectory() as d:
            out = os.path.join(d, "t.jsonl")
            with patch("subprocess.run", return_value=self._mock_result(FAKE_JSONL)) as m:
                runner.run_turn("p", "cc", None, out, d)
            cmd = m.call_args[0][0]
            self.assertIn("--dangerously-skip-permissions", cmd)


class TestSeedHallState(unittest.TestCase):
    def test_seeds_invoker_and_board_config(self):
        with tempfile.TemporaryDirectory() as home:
            runner._seed_hall_state(home)

            invoker_path = os.path.join(home, ".hall", runner.ARENA_OWNER, "invoker.json")
            with open(invoker_path) as f:
                invoker = json.load(f)
            self.assertEqual(invoker["mode"], "invoker")

            config_path = os.path.join(
                home, ".hall", runner.ARENA_OWNER, runner.ARENA_REPO, "config.json")
            with open(config_path) as f:
                config = json.load(f)
            self.assertEqual(config["board_project_number"], str(runner.ARENA_BOARD_NUMBER))
            self.assertEqual(config["automation_level"], 0)

    def test_idempotent_does_not_overwrite_existing(self):
        with tempfile.TemporaryDirectory() as home:
            runner._seed_hall_state(home)
            config_path = os.path.join(
                home, ".hall", runner.ARENA_OWNER, runner.ARENA_REPO, "config.json")
            with open(config_path, "w") as f:
                json.dump({"automation_level": 2}, f)

            runner._seed_hall_state(home)

            with open(config_path) as f:
                config = json.load(f)
            self.assertEqual(config["automation_level"], 2)


if __name__ == "__main__":
    unittest.main()
