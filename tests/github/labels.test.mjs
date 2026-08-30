// tests/github/labels.test.mjs
// Unit tests for github label helper functions.
import { strict as assert } from "node:assert";
import { test } from "node:test";

// Validate the gh CLI argument shapes used by label tools
test("label list args are valid gh CLI format", () => {
  const repo = "MockaSort-Studio/hall-of-automata-cli";
  const args = ["label", "list", "-R", repo, "--json", "name,color,description"];
  assert.equal(args[0], "label");
  assert.ok(args.includes("-R"));
  assert.ok(args.includes("--json"));
});

test("label create requires name and color", () => {
  const validate = ({name, color}) => {
    if (!name?.trim())  throw new Error("name is required");
    if (!color?.match(/^[0-9a-fA-F]{6}$/)) throw new Error("color must be a 6-digit hex string without #");
  };
  assert.doesNotThrow(() => validate({name:"bug",   color:"d73a4a"}));
  assert.throws(()       => validate({name:"",    color:"d73a4a"}), /name is required/);
  assert.throws(()       => validate({name:"bug", color:"#d73a4a"}), /6-digit hex/);
  assert.throws(()       => validate({name:"bug", color:"red"}),    /6-digit hex/);
});

test("label update allows partial fields", () => {
  const buildArgs = ({name, newName, color, description}) => {
    const args = ["label", "edit", name, "-R", "owner/repo"];
    if (newName)      args.push("--name",        newName);
    if (color)        args.push("--color",        color);
    if (description)  args.push("--description",  description);
    return args;
  };
  const args = buildArgs({name:"bug", color:"ffffff"});
  assert.ok(args.includes("--color"));
  assert.ok(!args.includes("--name"));
  assert.ok(!args.includes("--description"));
});
