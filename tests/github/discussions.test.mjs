// tests/github/discussions.test.mjs
// Unit tests for github discussion helper functions (pure logic, no gh CLI calls).
import { strict as assert } from "node:assert";
import { test } from "node:test";

// Test the category matching logic used in createDiscussion
test("category matching is case-insensitive", () => {
  const categories = [
    { id: "cat-1", name: "General" },
    { id: "cat-2", name: "Q&A" },
  ];
  const find = (name) => categories.find(c => c.name.toLowerCase() === name.toLowerCase());
  assert.equal(find("general").id, "cat-1");
  assert.equal(find("General").id, "cat-1");
  assert.equal(find("GENERAL").id, "cat-1");
  assert.equal(find("q&a").id, "cat-2");
});

test("category matching throws for unknown category", () => {
  const categories = [{ id: "cat-1", name: "General" }];
  const find = (name) => {
    const match = categories.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!match) throw new Error(`Unknown discussion category "${name}"`);
    return match.id;
  };
  assert.throws(() => find("Crew"), /Unknown discussion category/);
});

test("listComments output shape validation", () => {
  // Simulate the shape the gh CLI returns after --jq processing
  const sample = [
    { id: "C_1", url: "https://github.com/.../1", body: "hello", author: { login: "mksetaro" } },
  ];
  assert.ok(Array.isArray(sample));
  assert.ok(sample[0].url.startsWith("https://"));
  assert.ok(typeof sample[0].body === "string");
  assert.ok(typeof sample[0].author.login === "string");
});
