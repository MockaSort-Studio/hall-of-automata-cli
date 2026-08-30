// tests/crew/comm.test.mjs
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSubstantive, readRoster, resolveRecipient, signedBody, writeRoster } from "../../.pi/extensions/crew/lib/comm.mjs";

let tmpDir;
const roster = {
  runId: "test-run", topic: "crew.test-run", owner: "org", repo: "repo",
  discussionNumber: 42, discussionUrl: "https://github.com/org/repo/discussions/42",
  members: [
    { name: "architect-tomashco", actorId: "actor-a", role: "architect" },
    { name: "developer-snowball", actorId: "actor-b", role: "developer" },
  ],
};

test("roster round-trips", () => {
  tmpDir = mkdtempSync(join(tmpdir(), "crew-test-"));
  const path = join(tmpDir, "roster.json");
  writeRoster(path, roster);
  assert.deepEqual(readRoster(path), roster);
});

test("recipient resolves by name, prefix, or role", () => {
  assert.equal(resolveRecipient(roster, "architect-tomashco").actorId, "actor-a");
  assert.equal(resolveRecipient(roster, "developer").actorId, "actor-b");
  assert.throws(() => resolveRecipient(roster, "wizard"), /not found/);
});

test("directed crew messages reject URL-only payloads", () => {
  assert.throws(() => assertSubstantive("https://github.com/org/repo/discussions/42"), /substantive/);
  assert.throws(() => assertSubstantive("DONE"), /substantive/);
  assert.doesNotThrow(() => assertSubstantive("Please review the evidence at https://example.test/comment/1"));
});

test("signed posts preserve the persona signature", () => {
  const r = { ...roster, lead: { name: "lead-old-major", actorId: "actor-lead", role: "lead" } };
  assert.match(signedBody(r, "lead-old-major", "ACCEPT: evidence is sufficient", "— [Hall-Master | 🦉 Old Major] · the work is finally facing forward."), /Hall-Master/);
  assert.throws(() => signedBody(r, "wizard", "This is substantive", "— wizard"), /Unknown Crew sender/);
});

test("cleanup", () => rmSync(tmpDir, { recursive: true, force: true }));
