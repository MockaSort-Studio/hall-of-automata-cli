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
    assert.equal(kickoff.phase, "manifest");
    assert.deepEqual(kickoff.plan, [{ to: "developer-snowball-00", dependsOn: [] }]);
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
      resolveArmoryCatalog: async () => ({ release: "https://example.test/artifacts.json" }),
      realizeArmorySuites: async () => [],
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
      { members: [{ name: "snowball", role: "reviewer", tools: [{ suite: "collaboration/pi-github-tools", operations: ["github_issue_view"] }] }] },
      { cwd },
      ".pi",
    );
    let launched;
    await launchPreparedCrew(cwd, prepared, {
      resolveEnvironment: async () => ({ microvm: "gondolin", sandbox: { kind: "gondolin" } }),
      resolveArmoryCatalog: async () => ({ release: "https://example.test/artifacts.json" }),
      realizeArmorySuites: async () => [],
      resolveArmoryToolSuites: async ({ requests }) => requests,
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
    assert.equal(launched[0].environmentProfile.suites[0].tools.length, 1);
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

test("auto falls back to the host with the missing-cache hint when suites cannot be realized", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepare(cwd);
    let launched;
    await launchPreparedCrew(cwd, prepared, {
      resolveEnvironment: async () => ({ microvm: "gondolin", sandbox: { kind: "gondolin" } }),
      resolveArmoryCatalog: async () => ({ release: "https://example.test/artifacts.json" }),
      realizeArmorySuites: async () => Promise.reject(new Error("Reason: platform mismatch")),
      explainMissingCache: async (error) => new Error(`Armory cache not configured (run scripts/setup-env.sh); ${error.message}`),
      runtimeFor: () => ({
        launchCrew: async (agents) => {
          launched = agents;
          return { comm: {}, agents: agents.map((agent) => ({ id: agent.actorId, name: agent.name })) };
        },
        broadcast: async () => {},
      }),
    });
    assert.equal(launched[0].sandbox, undefined);
    const { environmentResolution } = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    assert.equal(environmentResolution.microvm, "none");
    assert.match(environmentResolution.fallbackReason, /Armory cache not configured \(run scripts\/setup-env\.sh\)/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

async function launchGithubCrew(cwd, dependencies) {
  const prepared = await prepareCrew(
    { getAllTools: () => [] },
    {
      members: [
        { name: "snowball", role: "reviewer", tools: [{ suite: "collaboration/pi-github-tools", operations: ["github_issue_view"] }] },
        { name: "tomashco", role: "advisor", tools: [{ suite: "system", operations: ["read"] }] },
      ],
    },
    { cwd },
    ".pi",
  );
  let launched;
  const result = await launchPreparedCrew(cwd, prepared, {
    resolveEnvironment: async () => ({ microvm: "gondolin", sandbox: { kind: "gondolin" } }),
    resolveArmoryCatalog: async () => ({ release: "https://example.test/artifacts.json" }),
    realizeArmorySuites: async () => [],
    resolveArmoryToolSuites: async ({ requests }) => requests,
    runtimeFor: () => ({
      launchCrew: async (agents) => ((launched = agents), { comm: {}, agents: agents.map((agent) => ({ id: agent.actorId, name: agent.name })) }),
      broadcast: async () => {},
    }),
    ...dependencies,
  });
  return { prepared, launched, result };
}

test("a consented login token reaches only the worker that needs it and is never written down", async () => {
  const saved = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const asked = [];
    const { prepared, launched, result } = await launchGithubCrew(cwd, {
      confirmCredential: async (request) => (asked.push(request), true),
      runLogin: async () => "gho_secret",
    });
    assert.deepEqual(asked, [{ label: "GitHub CLI login", variable: "GITHUB_TOKEN" }]);
    const byRole = Object.fromEntries(launched.map((agent) => [agent.role, agent.secretEnv]));
    assert.deepEqual(byRole, { reviewer: { GITHUB_TOKEN: "gho_secret" }, advisor: undefined });
    for (const path of [prepared.configFile, prepared.rosterFile, prepared.selectedCrewFile])
      assert.doesNotMatch(readFileSync(join(cwd, path), "utf8"), /gho_secret/);
    const { environmentResolution } = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    assert.equal(environmentResolution.credentials.GITHUB_TOKEN, "GitHub CLI login (consented)");
    assert.equal(result.warnings, undefined);
  } finally {
    if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("a missing credential is a launch warning, recorded without any secret", async () => {
  const saved = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const { prepared, launched, result } = await launchGithubCrew(cwd, { confirmCredential: async () => false });
    assert.match(result.warnings.join(" "), /GITHUB_TOKEN is not available/);
    assert.deepEqual(launched.map((agent) => agent.secretEnv), [undefined, undefined]);
    const { environmentResolution } = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    assert.equal(environmentResolution.credentials.GITHUB_TOKEN, "missing");
    assert.match(environmentResolution.warnings[0], /GITHUB_TOKEN/);
  } finally {
    if (saved !== undefined) process.env.GITHUB_TOKEN = saved;
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("an environment token needs no prompt and no warning", async () => {
  const saved = process.env.GITHUB_TOKEN;
  process.env.GITHUB_TOKEN = "from-env";
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const { result } = await launchGithubCrew(cwd, { confirmCredential: async () => assert.fail("must not prompt") });
    assert.equal(result.warnings, undefined);
  } finally {
    if (saved === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = saved;
    rmSync(cwd, { recursive: true, force: true });
  }
});
