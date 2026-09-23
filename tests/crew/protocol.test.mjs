import { strict as assert } from "node:assert";
import { test } from "node:test";
import { crewDisciplineModule } from "../../.pi/extensions/crew/lib/automaton-body/lib/modules/crew-discipline.mjs";
test("base Crew discipline is Comm-only", () => {
  const text = crewDisciplineModule().instructions;
  assert.match(text, /comm_request/);
  assert.match(text, /before ending that delivery call `comm_notify` to `main`/);
  assert.match(text, /taskStatus: "complete"\|"blocked"\|"failed"/);
  assert.match(text, /A prose final answer is not a report/);
  assert.match(text, /Only Main\/Lifecycle removes SDK workers/);
  assert.doesNotMatch(text, /github_discussion|crew_kickoff/);
});
