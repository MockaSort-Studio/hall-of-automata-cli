import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planRowsFor } from "../../.pi/extensions/crew/lib/monitor-dashboard-command.mjs";

const selectedCrew = {
  runId: "run-1",
  members: [
    { name: "alpha", handle: "developer-alpha-00", task: "Do alpha work.", dependsOn: [] },
    { name: "bravo", handle: "developer-bravo-00", task: "Do bravo work.", dependsOn: ["developer-alpha-00"] },
  ],
};

const roster = { selectedCrew: ".pi/runtime/crew-launch/selected_crew_run-1.json" };

test("planRowsFor reads selected_crew via the injected readJson and seeds a fresh ledger", () => {
  const readJson = (path) => {
    assert.match(path, /selected_crew_run-1\.json$/);
    return selectedCrew;
  };
  const rows = planRowsFor(readJson, "/repo", roster);
  assert.deepEqual(rows, [
    { task: "Do alpha work.", status: "waiting", assignedAutomaton: "developer-alpha-00", dependsOn: [] },
    {
      task: "Do bravo work.",
      status: "waiting",
      assignedAutomaton: "developer-bravo-00",
      dependsOn: ["developer-alpha-00"],
    },
  ]);
});

test("planRowsFor returns no rows when the roster has no selectedCrew file recorded", () => {
  assert.deepEqual(
    planRowsFor(() => null, "/repo", {}),
    [],
  );
});

test("planRowsFor returns no rows when selected_crew fails to parse", () => {
  assert.deepEqual(
    planRowsFor(() => null, "/repo", roster),
    [],
  );
});
