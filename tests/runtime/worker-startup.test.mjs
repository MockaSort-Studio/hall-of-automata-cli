import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";

const worker = readFileSync(new URL("../../.pi/extensions/runtime/lib/worker.mjs", import.meta.url), "utf8");

test("resident workers prompt only after their correlated session bootstrap", () => {
  assert.match(worker, /id: "worker-session", type: "new_session"/);
  assert.match(worker, /message\.id === "worker-session" && message\.success\) sendStartupPrompt\(\)/);
  assert.match(worker, /if \(config\.resident\) send\(\{ id: "worker-session"/);
});
