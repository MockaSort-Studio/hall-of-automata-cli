import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../.pi/extensions/github/lib/discussions/index.ts", import.meta.url), "utf8");

test("Discussion reader includes nested replies for human review", () => {
  assert.match(source, /replies\(first:100\)/);
  assert.match(source, /replyToId: comment\.id/);
  assert.match(source, /flattenDiscussionComments/);
});
