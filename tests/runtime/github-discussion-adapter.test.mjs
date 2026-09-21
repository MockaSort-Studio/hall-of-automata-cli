import { strict as assert } from "node:assert";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { startGithubDiscussionAdapter } from "../../.pi/extensions/runtime/lib/github-discussion.mjs";

// A fake `gh` on PATH: enough GraphQL responses for discussion creation,
// commenting, and the empty-comment poll, with every call logged so posted
// bodies can be inspected.
function fakeGh(dir, log) {
  const script = join(dir, "gh");
  writeFileSync(
    script,
    `#!/bin/sh
printf '%s\\0' "$*" >> "${log}"
case "$*" in
  *"repo view"*) printf 'owner/repo' ;;
  *"discussionCategories"*) printf '{"data":{"repository":{"id":"REPO1","discussionCategories":{"nodes":[{"id":"CAT1","name":"General"}]}}}}' ;;
  *"createDiscussion"*) printf '{"data":{"createDiscussion":{"discussion":{"id":"DISC1","number":1,"url":"https://example.test/d/1"}}}}' ;;
  *"addDiscussionComment"*) printf '{"data":{"addDiscussionComment":{"comment":{"id":"C1","url":"https://example.test/c/1"}}}}' ;;
  *"comments(first:100)"*) printf '{"data":{"repository":{"discussion":{"comments":{"nodes":[]}}}}}' ;;
esac
`,
  );
  chmodSync(script, 0o755);
}

function fakeController() {
  let handler;
  return {
    subscribe(fn) {
      handler = fn;
      return () => {};
    },
    injectHuman() {
      return { accepted: true, id: "human-1" };
    },
    async emit(message) {
      return handler(message);
    },
  };
}

async function withAdapter(t, run) {
  const dir = mkdtempSync(join(tmpdir(), "gh-discussion-"));
  const log = join(dir, "gh.log");
  fakeGh(dir, log);
  const oldPath = process.env.PATH;
  process.env.PATH = `${dir}:${oldPath}`;
  const controller = fakeController();
  const stateFile = join(dir, "state.json");
  const adapter = await startGithubDiscussionAdapter(controller, {
    stateFile,
    runId: "run-1",
    startedAt: "2026-01-01T00:00:00Z",
    category: "General",
    recipients: { architect: "actor-architect" },
    lead: "actor-lead",
    pollIntervalMs: 60_000,
  });
  t.after(async () => {
    await adapter.stop();
    process.env.PATH = oldPath;
    rmSync(dir, { recursive: true, force: true });
  });
  return { controller, log };
}

const postedBodies = (log) =>
  readFileSync(log, "utf8")
    .split("\0")
    .filter((call) => call.includes("addDiscussionComment"))
    .map((call) => call.match(/body=([^\u0000]*?)(?: -f id=| -f discussion=|$)/)?.[1] ?? "");

test("a long report body is truncated with a pointer instead of posted in full", async (t) => {
  const { controller, log } = await withAdapter(t);
  const long = "y".repeat(5000);
  await controller.emit({ id: "m1", kind: "notify", from: "actor-architect", to: "actor-lead", message: long });
  const bodies = postedBodies(log);
  assert.equal(bodies.length, 1);
  assert.ok(bodies[0].length < long.length);
  assert.match(bodies[0], /truncated/);
});

test("an identical repost to the same recipient is not posted twice", async (t) => {
  const { controller, log } = await withAdapter(t);
  const message = { id: "m1", kind: "notify", from: "actor-architect", to: "actor-lead", message: "Same report." };
  await controller.emit(message);
  await controller.emit({ ...message, id: "m2" });
  const bodies = postedBodies(log);
  assert.equal(bodies.length, 1);
});

test("distinct content to the same recipient is posted separately", async (t) => {
  const { controller, log } = await withAdapter(t);
  await controller.emit({ id: "m1", kind: "notify", from: "actor-architect", to: "actor-lead", message: "First." });
  await controller.emit({ id: "m2", kind: "notify", from: "actor-architect", to: "actor-lead", message: "Second." });
  const bodies = postedBodies(log);
  assert.equal(bodies.length, 2);
});
