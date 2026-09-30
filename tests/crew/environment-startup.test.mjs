import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { launchPreparedCrew, prepareCrew } from "../../.pi/extensions/hall-crew/crew/lib/startup.mjs";

const pi = { getAllTools: () => [] };
const prepare = (cwd, environment) =>
  prepareCrew(
    pi,
    { members: [{ name: "snowball", role: "developer" }], ...(environment && { environment }) },
    { cwd },
    ".pi",
  );

test("prepareCrew records the requested environment in every launch artifact", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepare(cwd, { microvm: "none" });
    for (const path of [prepared.configFile, prepared.selectedCrewFile, prepared.rosterFile])
      assert.deepEqual(JSON.parse(readFileSync(join(cwd, path), "utf8")).environment, { microvm: "none" });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("auto resolves before Runtime creates workers and records its host fallback", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepare(cwd);
    let launched;
    let kickoff;
    const result = await launchPreparedCrew(cwd, prepared, {
      resolveEnvironment: async () => ({ microvm: "none", fallbackReason: "QEMU absent" }),
      runtimeFor: () => ({
        launchCrew: async (agents) => {
          launched = agents;
          return { comm: {}, agents: agents.map((agent) => ({ id: agent.actorId, name: agent.name })) };
        },
        broadcast: async (_namespace, payload) => {
          kickoff = payload;
        },
      }),
    });
    assert.equal(result.status, "started");
    assert.equal(launched[0].sandbox, undefined);
    assert.equal(kickoff.kind, "kickoff");
    assert.deepEqual(kickoff.assignments, [{ to: "developer-snowball-00", task: "", dependsOn: [] }]);
    for (const path of [prepared.configFile, prepared.rosterFile])
      assert.deepEqual(JSON.parse(readFileSync(join(cwd, path), "utf8")).environmentResolution, {
        microvm: "none",
        fallbackReason: "QEMU absent",
      });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("resolved Gondolin is threaded into every worker launch", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepare(cwd);
    let launched;
    await launchPreparedCrew(cwd, prepared, {
      resolveEnvironment: async () => ({ microvm: "gondolin", sandbox: { kind: "gondolin" } }),
      resolveArmoryToolSuites: async () => [],
      runtimeFor: () => ({
        launchCrew: async (agents) => {
          launched = agents;
          return { comm: {}, agents: agents.map((agent) => ({ id: agent.actorId, name: agent.name })) };
        },
        broadcast: async () => {},
      }),
    });
    assert.deepEqual(
      launched.map((agent) => agent.sandbox),
      [{ kind: "gondolin" }],
    );
    assert.deepEqual(launched[0].environmentProfile.suites, []);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("resolved Gondolin groups Crew-granted GitHub operations before worker launch", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepareCrew(
      { getAllTools: () => [] },
      { members: [{ name: "snowball", role: "reviewer" }] },
      { cwd },
      ".pi",
    );
    let launched;
    await launchPreparedCrew(cwd, prepared, {
      resolveEnvironment: async () => ({ microvm: "gondolin", sandbox: { kind: "gondolin" } }),
      resolveArmoryToolSuites: async (request) => [
        { suite: "collaboration/pi-github-tools", tools: request.tools.filter((tool) => tool.startsWith("github_")) },
      ],
      runtimeFor: () => ({
        launchCrew: async (agents) => {
          launched = agents;
          return { comm: {}, agents: agents.map((agent) => ({ id: agent.actorId, name: agent.name })) };
        },
        broadcast: async () => {},
      }),
    });
    assert.deepEqual(launched[0].environmentProfile.builtins, ["read", "grep", "find", "ls", "bash"]);
    assert.equal(launched[0].environmentProfile.suites[0].suite, "collaboration/pi-github-tools");
    assert.ok(launched[0].environmentProfile.suites[0].tools.length >= 8);
    assert.ok(launched[0].environmentProfile.suites[0].tools.includes("github_issue_view"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("explicit Gondolin rejects before Runtime can create a worker", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepare(cwd, { microvm: "gondolin" });
    let runtimeCalled = false;
    await assert.rejects(
      launchPreparedCrew(cwd, prepared, {
        resolveEnvironment: async () => Promise.reject(new Error("QEMU absent")),
        runtimeFor: () => {
          runtimeCalled = true;
          return {};
        },
      }),
      /QEMU absent/,
    );
    assert.equal(runtimeCalled, false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
