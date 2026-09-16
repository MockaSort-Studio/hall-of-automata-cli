import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const config = JSON.parse(readFileSync(".pi/fabric.json", "utf8"));
const source = readFileSync(".pi/extensions/fabric-direct-probe/index.ts", "utf8");

test("Fabric direct probe stays visible on Pi's native tool path", () => {
  assert.ok(config.capture.keepVisible.includes("fabric_direct_probe"));
  assert.equal(config.capture.risks.fabric_direct_probe, "read");
  assert.match(source, /pi\.registerTool\(\{/);
  assert.match(source, /name: "fabric_direct_probe"/);
  assert.match(source, /route: "native-extension"/);
});
