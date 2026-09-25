import { strict as assert } from "node:assert";
import { test } from "node:test";
import { assemble } from "../../.pi/extensions/crew/lib/assembly.mjs";
test("assembly embeds bounded work without adapter tools", () => {
  const actor = assemble("mergio", "architect", "Design one focused behavior and prove it.");
  assert.match(actor.instructions, /## BOUNDED ASSIGNMENT/);
  assert.ok(!actor.tools.some((tool) => tool.startsWith("crew_") || tool.startsWith("github_")));
});
test("reviewer carries the native GitHub extension only when its tools are available", () => {
  const tools = [
    "read",
    "grep",
    "find",
    "ls",
    "bash",
    "github_pull_request_view",
    "github_pull_request_files",
    "github_pull_request_checks",
    "github_pull_request_review_threads",
    "github_pull_request_review_start",
    "github_pull_request_review_inline_comment",
    "github_pull_request_review_submit",
    "github_pull_request_comment",
  ];
  const actor = assemble("snowball", "reviewer", "Review PR 1.", { runtimeTools: tools });
  assert.deepEqual(actor.extensionPaths, [".pi/extensions/github/index.ts"]);
});

test("assembly does not claim unverified Armory tools", () => {
  const actor = assemble("panoramix", "developer", "Implement one BEAM change.");
  assert.ok(!actor.tools.includes("mix_test"));
});
test("assembly adds only supplied common assignment context", () => {
  const actor = assemble("snowball", "developer", "Review a change.", {
    deliverTo: "main",
    authority: { merge: false },
  });
  assert.match(actor.instructions, /## ASSIGNMENT CONTEXT/);
  assert.match(actor.instructions, /"deliverTo":"main"/);
});

test("assembly rejects oversized work", () =>
  assert.throws(() => assemble("mergio", "architect", "x".repeat(4001)), /exceeds 4000/));
