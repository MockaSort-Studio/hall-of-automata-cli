import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { crewPaths, prepareCrew, queuedMessage } from "../../.pi/extensions/crew/lib/startup.mjs";
import { assemble } from "../../.pi/extensions/crew/lib/assembly.mjs";

const source = readFileSync(new URL("../../.pi/extensions/crew/lib/startup.mjs", import.meta.url), "utf8");

test("crew paths include an immutable selected-party manifest", () =>
  assert.deepEqual(crewPaths(".pi", "run-1"), {
    roster: ".pi/runtime/crew-launch/run-1-roster.json",
    selected: ".pi/runtime/crew-launch/selected_crew_run-1.json",
    config: ".pi/runtime/crew-launch/run-1.json",
  }));
test("queued acknowledgment names the SDK runtime", () =>
  assert.match(queuedMessage({ runId: "run-1" }), /SDK runtime/));
test("prepareCrew preserves a selected lead instead of synthesizing one", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepareCrew(
      { getAllTools: () => [] },
      {
        task: "Measure safely",
        members: [
          { name: "old-major", role: "lead" },
          { name: "snowball", role: "developer" },
        ],
      },
      { cwd },
      ".pi",
    );
    const config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    const selected = JSON.parse(readFileSync(join(cwd, prepared.selectedCrewFile), "utf8"));
    assert.deepEqual(
      config.agents.map((agent) => agent.name),
      ["lead-old-major-00", "developer-snowball-00"],
    );
    assert.equal(config.kickoff, undefined);
    assert.equal(selected.members[0].handle, "lead-old-major-00");
    assert.doesNotMatch(config.agents[0].task, /## CREW INPUT/);
    assert.doesNotMatch(source, /assemble\("old-major"/);
    assert.ok(config.agents[0].commTools.includes("comm_notify_all"));
    assert.ok(!config.agents[1].commTools.includes("comm_notify_all"));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test("prepareCrew preserves validated per-member task and dependsOn in the selected-crew manifest", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepareCrew(
      { getAllTools: () => [] },
      {
        task: "Measure safely",
        members: [
          { name: "old-major", role: "lead", task: "Coordinate the run" },
          {
            name: "snowball",
            role: "developer",
            model: "terra-5.6",
            task: "Build the windmill",
            dependsOn: ["lead-old-major-00"],
          },
        ],
      },
      { cwd },
      ".pi",
    );
    const selected = JSON.parse(readFileSync(join(cwd, prepared.selectedCrewFile), "utf8"));
    assert.equal(selected.members[0].task, "Coordinate the run");
    assert.deepEqual(selected.members[0].dependsOn, []);
    assert.equal(selected.members[1].task, "Build the windmill");
    assert.deepEqual(selected.members[1].dependsOn, ["lead-old-major-00"]);
    assert.equal(selected.members[1].model, "terra-5.6");
    const config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    assert.equal(config.agents[1].model, "terra-5.6");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test("prepareCrew rejects a dependsOn reference to an unknown handle", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    await assert.rejects(
      prepareCrew(
        { getAllTools: () => [] },
        {
          task: "Measure safely",
          members: [{ name: "snowball", role: "developer", dependsOn: ["developer-nowhere-00"] }],
        },
        { cwd },
        ".pi",
      ),
      /dependsOn/,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test("prepareCrew assembles a bounded snapshot prompt with the full ordinal-suffixed Crew handle", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepareCrew(
      { getAllTools: () => [] },
      {
        task: "Measure safely",
        members: [{ name: "snowball", role: "developer", task: "Build one bounded windmill plank." }],
      },
      { cwd },
      ".pi",
    );
    const config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    const prompt = config.agents[0].task;
    // Exact substitution point: identity line follows the assembled instructions and
    // precedes the SDK runtime block, matching workerTask()'s fixed template order.
    assert.match(
      prompt,
      /## BOUNDED ASSIGNMENT\nBuild one bounded windmill plank\.\n\n## CREW IDENTITY\nYour exact Comm sender handle is developer-snowball-00\.\n\n## SDK CREW RUNTIME\n/,
    );
    // No sitewide concept of a maximum assembled-prompt size exists (grepped for
    // exceeds/length >/token limit across .pi/extensions/crew): the only enforced
    // bounds are per-field (assembly.mjs's 4000-char assignment cap, startup.mjs's
    // 8000-char task cap). This derives a ceiling from those documented bounds plus
    // the fixed non-assignment instruction/template overhead, rather than asserting
    // an invented number.
    const fixedOverhead = assemble("snowball", "developer", "").instructions.length;
    const runtimeTemplateOverhead = 400; // identity line + SDK CREW RUNTIME block boilerplate
    const MAX_ASSIGNMENT_CHARS = 4000;
    assert.ok(
      prompt.length <= fixedOverhead + MAX_ASSIGNMENT_CHARS + runtimeTemplateOverhead,
      `assembled prompt (${prompt.length} chars) exceeded the bound derived from documented per-field caps`,
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
test("prepareCrew leaves task delivery to a later Comm message", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "crew-sdk-"));
  try {
    const prepared = await prepareCrew(
      { getAllTools: () => [] },
      { task: "Measure safely", members: [{ name: "snowball", role: "developer" }] },
      { cwd },
      ".pi",
    );
    const config = JSON.parse(readFileSync(join(cwd, prepared.configFile), "utf8"));
    assert.equal(config.kickoff, undefined);
    assert.equal(config.agents[0].initialTurn, "first-delivery");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
