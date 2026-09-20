import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  createCrewDashboardComponent,
  formatAutomataLines,
  formatPlanLines,
} from "../../.pi/extensions/crew/lib/monitor-dashboard-view.mjs";

const automataRow = () => ({
  actorId: "a1",
  name: "architect-a",
  bucket: "running",
  turns: 3,
  toolCalls: 5,
  toolErrors: 1,
  compactions: 2,
  providerTraffic: { uncachedInput: 100, generatedOutput: 200, cacheRead: 10, cacheWrite: 20 },
  sessionContext: "42% / 200000",
});

const planRow = () => ({
  task: "Do the thing.",
  status: "running",
  assignedAutomaton: "developer-alpha-00",
  dependsOn: [],
});

test("formatAutomataLines emits a header plus one line per automaton with bucket, metrics, and context", () => {
  const lines = formatAutomataLines([automataRow()]);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /BUCKET/);
  assert.match(lines[1], /architect-a/);
  assert.match(lines[1], /running/);
  assert.match(lines[1], /42% \/ 200000/);
});

test("formatAutomataLines reports an explicit empty state instead of a blank table", () => {
  assert.deepEqual(formatAutomataLines([]), ["(no automata on the roster yet)"]);
});

test("formatPlanLines renders task, status, assigned automaton, and dependsOn per row", () => {
  const lines = formatPlanLines([{ ...planRow(), dependsOn: ["developer-bravo-00"] }]);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /developer-alpha-00/);
  assert.match(lines[0], /running/);
  assert.match(lines[0], /developer-bravo-00/);
  assert.match(lines[0], /Do the thing\./);
});

test("formatPlanLines reports an explicit empty state instead of a blank table", () => {
  assert.deepEqual(formatPlanLines([]), ["(no plan recorded for this Crew yet)"]);
});

test("createCrewDashboardComponent starts on the Automata tab and switches on Tab input", () => {
  const component = createCrewDashboardComponent({
    getData: () => ({ automataRows: [automataRow()], planRows: [planRow()] }),
  });
  assert.equal(component.tab, "automata");
  component.handleInput("\t");
  assert.equal(component.tab, "plan");
  component.handleInput("\t");
  assert.equal(component.tab, "automata");
});

test("createCrewDashboardComponent renders the active tab's rows and respects width", () => {
  const component = createCrewDashboardComponent({
    getData: () => ({ automataRows: [automataRow()], planRows: [planRow()] }),
  });
  const lines = component.render(20);
  assert.ok(lines.every((line) => line.length <= 20));
  component.handleInput("\t");
  const planLines = component.render(200);
  assert.ok(planLines.some((line) => line.includes("developer-alpha-00")));
});

test("createCrewDashboardComponent calls onClose on escape or q", () => {
  let closed = 0;
  const component = createCrewDashboardComponent({
    getData: () => ({ automataRows: [], planRows: [] }),
    onClose: () => closed++,
  });
  component.handleInput("\x1b");
  component.handleInput("q");
  assert.equal(closed, 2);
});
