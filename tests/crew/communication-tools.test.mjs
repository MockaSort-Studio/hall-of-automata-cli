import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../.pi/extensions/crew/lib/communication-tools.ts", import.meta.url), "utf8");

test("kickoff validates exact roster member names", () => {
  assert.match(source, /new Set\(\(roster\.members \|\| \[\]\)\.map\(member => member\.name\)\)/);
  assert.match(source, /if \(!members\.has\(item\.name\)\) throw new Error\(`Kickoff assignment names unknown specialist/);
});

test("activation carries exact Crew and GitHub identities", () => {
  assert.match(source, /runId: roster\.runId/);
  assert.match(source, /runId=\$\{roster\.runId\}/);
  assert.match(source, /discussionNumber=\$\{discussion\.number\}/);
  assert.doesNotMatch(source, /repo=\$\{roster\.repo\}; number=/);
});
