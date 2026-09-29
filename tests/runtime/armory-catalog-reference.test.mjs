import assert from "node:assert/strict";
import test from "node:test";
import { readCatalogSuite, resolveArmoryCatalogReference, suiteFlakeLocator } from "../../.pi/extensions/runtime/lib/armory-catalog-reference.mjs";

const revision = "0123456789abcdef0123456789abcdef01234567";
const metadata = {
  locked: { type: "github", owner: "MockaSort-Studio", repo: "hall-armory", rev: revision },
  path: "/nix/store/0123456789abcdefghijklmnopqrstuv-source",
};
const execute = async () => ({ stdout: JSON.stringify(metadata) });
const read = async (path) => JSON.stringify({ path });

test("catalog channel resolves once to an immutable Nix GitHub revision", async () => {
  const catalog = await resolveArmoryCatalogReference({ flake: "github:MockaSort-Studio/hall-armory/main", execute, read });
  assert.equal(catalog.flake, `github:MockaSort-Studio/hall-armory/${revision}`);
  assert.equal(catalog.revision, revision);
  assert.equal(catalog.catalog.path, "/nix/store/0123456789abcdefghijklmnopqrstuv-source/manifest.json");
});

test("suite locator uses the catalog revision and explicit guest output", () => {
  const locator = suiteFlakeLocator(
    { flake: `github:MockaSort-Studio/hall-armory/${revision}` },
    "collaboration/github/manifest.json",
    { closure: ".", output: "guest" },
  );
  assert.equal(locator, `github:MockaSort-Studio/hall-armory/${revision}?dir=collaboration/github#guest`);
});

test("catalog source paths cannot escape the Nix source", async () => {
  await assert.rejects(() => readCatalogSuite({ sourcePath: "/nix/store/source" }, "../secret.json", { read }), /non-escaping/);
});
