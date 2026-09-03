import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const rendering = readFileSync(new URL("../../.pi/extensions/crew/lib/rendering.ts", import.meta.url), "utf8");
const extension = readFileSync(new URL("../../.pi/extensions/crew/index.ts", import.meta.url), "utf8");

test("Crew terminal result uses Pi TUI utilities and structured Fabric data", () => {
  assert.match(rendering, /from "@earendil-works\/pi-tui"/);
  assert.match(rendering, /new Box\(/);
  assert.match(rendering, /new Text\(/);
  assert.match(rendering, /pi-fabric-agent-message/);
  assert.match(rendering, /data\?\.kind !== "crew_result"/);
  assert.match(rendering, /data\.outcome === "PASS"/);
  assert.match(rendering, /pi\.on\("context"/);
});

test("start_crew provides custom call and result renderers", () => {
  assert.match(extension, /renderCall\(args, theme\)/);
  assert.match(extension, /renderResult\(result, \{ isPartial \}, theme\)/);
  assert.match(extension, /✓ Crew queued/);
  assert.match(extension, /monitor\.activate\(ctx, prepared\.rosterFile\)/);
  assert.match(extension, /launchRequired: true/);
  assert.ok(!extension.includes("sendUserMessage"));
  assert.ok(!extension.includes("Run this using fabric_exec"));
  assert.ok(!extension.includes("registerCommand"));
});
