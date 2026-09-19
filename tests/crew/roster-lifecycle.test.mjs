import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  advanceMemberLifecycle,
  applyWorkerStatusToRoster,
  applyWorkerStatusToRosterFiles,
  outcomeForWorkerStatus,
} from "../../.pi/extensions/crew/lib/roster-lifecycle.mjs";

test("outcomeForWorkerStatus maps completed/failed/removed to the durable contract's outcomes", () => {
  assert.equal(outcomeForWorkerStatus("completed"), "PASS");
  assert.equal(outcomeForWorkerStatus("failed"), "FAIL");
  assert.equal(outcomeForWorkerStatus("removed"), "BLOCKED");
  assert.equal(outcomeForWorkerStatus("stopping"), null);
});

test("advanceMemberLifecycle takes a running member straight to PASS or FAIL", () => {
  assert.equal(advanceMemberLifecycle("running", "completed"), "PASS");
  assert.equal(advanceMemberLifecycle("running", "failed"), "FAIL");
});

test("advanceMemberLifecycle routes an intentional removal through attention to BLOCKED", () => {
  assert.equal(advanceMemberLifecycle("running", "removed"), "BLOCKED");
  assert.equal(advanceMemberLifecycle("attention", "removed"), "BLOCKED");
});

test("advanceMemberLifecycle is a no-op once a member is already terminal", () => {
  assert.equal(advanceMemberLifecycle("PASS", "failed"), "PASS");
  assert.equal(advanceMemberLifecycle("FAIL", "removed"), "FAIL");
  assert.equal(advanceMemberLifecycle("BLOCKED", "completed"), "BLOCKED");
});

test("advanceMemberLifecycle rejects an unknown worker status by leaving state unchanged", () => {
  assert.equal(advanceMemberLifecycle("running", "stopping"), "running");
});

test("applyWorkerStatusToRoster defaults an unset member status to running before advancing", () => {
  const roster = { runId: "run-1", members: [{ name: "a", actorId: "actor-a" }] };
  const next = applyWorkerStatusToRoster(roster, "actor-a", "completed");
  assert.equal(next.members[0].status, "PASS");
  assert.notEqual(next, roster);
});

test("applyWorkerStatusToRoster returns the same reference when the actor is not a member", () => {
  const roster = { runId: "run-1", members: [{ name: "a", actorId: "actor-a" }] };
  assert.equal(applyWorkerStatusToRoster(roster, "actor-missing", "completed"), roster);
});

test("applyWorkerStatusToRoster returns the same reference once a member is already terminal", () => {
  const roster = { runId: "run-1", members: [{ name: "a", actorId: "actor-a", status: "PASS" }] };
  assert.equal(applyWorkerStatusToRoster(roster, "actor-a", "failed"), roster);
});

function tmpCrewLaunchDir(prefix) {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("applyWorkerStatusToRosterFiles updates only the roster listing the actor and reports the change", () => {
  const dir = tmpCrewLaunchDir("crew-lifecycle-");
  try {
    const activePath = join(dir, "run-active-roster.json");
    const otherPath = join(dir, "run-other-roster.json");
    writeFileSync(
      activePath,
      JSON.stringify({ runId: "run-active", status: "started", members: [{ name: "a", actorId: "actor-a" }] }),
    );
    writeFileSync(
      otherPath,
      JSON.stringify({ runId: "run-other", status: "started", members: [{ name: "b", actorId: "actor-b" }] }),
    );

    const updated = applyWorkerStatusToRosterFiles(dir, "actor-a", "failed");

    assert.deepEqual(updated, [{ runId: "run-active", actorId: "actor-a", status: "FAIL" }]);
    assert.equal(JSON.parse(readFileSync(activePath, "utf8")).members[0].status, "FAIL");
    assert.equal(JSON.parse(readFileSync(otherPath, "utf8")).members[0].status, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("applyWorkerStatusToRosterFiles is a no-op when no Crews were ever launched", () => {
  const dir = join(tmpdir(), `crew-lifecycle-missing-${process.pid}-${Date.now()}`);
  assert.deepEqual(applyWorkerStatusToRosterFiles(dir, "actor-a", "completed"), []);
});
