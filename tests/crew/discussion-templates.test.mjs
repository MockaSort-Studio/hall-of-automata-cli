import { strict as assert } from "node:assert";
import { test } from "node:test";
import { renderKickoff } from "../../.pi/extensions/crew/lib/discussion-templates.mjs";

const roster = {
  runId: "run-1",
  topic: "crew.run-1",
  outputPath: "docs/result.md",
  lead: { name: "lead-old-major" },
};
const input = {
  title: "Audit Crew communication",
  objective: "Identify protocol gaps and recommend bounded fixes.",
  acceptanceCriteria: ["Map the current path.", "Name verified gaps."],
  crew: [
    { name: "architect-tomashco", assignment: "Review protocol boundaries." },
    { name: "advisor-indiana-docs", assignment: "Verify behavior.", dependsOn: ["architect-tomashco"] },
  ],
  references: [{ label: "Protocol", url: "https://example.test/protocol" }],
  openQuestions: ["Should retries remain bounded?"],
};

test("kickoff renders one concise canonical structure", () => {
  assert.equal(renderKickoff(roster, input), `**Run:** \`run-1\`  
**Lead:** @lead-old-major  
**Deliverable:** \`docs/result.md\`

## Objective
Identify protocol gaps and recommend bounded fixes.

## Acceptance criteria
- [ ] Map the current path.
- [ ] Name verified gaps.

## Crew
| Member | Assignment | Depends on |
| --- | --- | --- |
| @architect-tomashco | Review protocol boundaries. | — |
| @advisor-indiana-docs | Verify behavior. | @architect-tomashco |

## Communication
- Durable work and decisions: this Discussion.
- Lifecycle events: \`crew.run-1\`.
- Directed message: @role-persona. Shared message: @all.

## References
- [Protocol](https://example.test/protocol)

## Open questions
- Should retries remain bounded?`);
});

test("kickoff rejects repeated links instead of rendering duplicates", () => {
  assert.throws(() => renderKickoff(roster, {
    ...input,
    objective: "Read https://example.test/protocol before starting.",
  }), /repeated link/);
});

test("kickoff rejects missing criteria, specialists, and malformed handles", () => {
  assert.throws(() => renderKickoff(roster, { ...input, acceptanceCriteria: [] }), /acceptance criterion/);
  assert.throws(() => renderKickoff(roster, { ...input, crew: [] }), /at least one specialist/);
  assert.throws(() => renderKickoff(roster, {
    ...input,
    crew: [{ name: "Tomashco", assignment: "Review." }],
  }), /role-persona handle/);
});
