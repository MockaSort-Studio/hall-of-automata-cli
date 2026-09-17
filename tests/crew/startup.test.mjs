import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { crewPaths, prepareCrew, queuedMessage } from "../../.pi/extensions/crew/lib/startup.mjs";

const source = readFileSync(new URL("../../.pi/extensions/crew/lib/startup.mjs", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../../.pi/extensions/crew/index.ts", import.meta.url), "utf8");

test("crew paths are relative to the install config directory", () =>
  assert.deepEqual(crewPaths(".pi", "run-1"), {
    roster: ".pi/runtime/crew-launch/run-1-roster.json",
    config: ".pi/runtime/crew-launch/run-1.json",
  }));
test("queued acknowledgment names the SDK runtime", () =>
  assert.match(queuedMessage({ runId: "run-1" }), /SDK runtime/));
test("prepareCrew writes Comm-only SDK Runtime launch config", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepareCrew(
      { getAllTools: () => [] },
      { task: "Measure safely", members: [{ name: "snowball", role: "developer" }], thinking: "off" },
      { cwd },
      ".pi",
    );
    const roster = JSON.parse(readFileSync(join(cwd, prepared.rosterFile), "utf8"));
    const config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    assert.equal(roster.runtime, "sdk");
    assert.equal(roster.status, "queued");
    assert.equal(roster.owner, undefined);
    assert.equal(config.agents.length, 2);
    assert.ok(config.agents.every((agent) => agent.resident));
    assert.match(config.agents[1].task, /comm_request/);
    assert.doesNotMatch(config.agents[1].task, /crew_kickoff|github_discussion/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test("base startup has no GitHub Discussion adapter", () => {
  assert.doesNotMatch(source, /gh repo|resolveRepository|discussionNumber|discussionUrl/);
  assert.doesNotMatch(indexSource, /registerCommunicationTools|registerHumanInboxTools|registerRosterTools/);
  assert.match(source, /runtimeFor\(cwd\)\.launchCrew/);
});
