import { strict as assert } from "node:assert";
import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acquireArmoryPackage } from "../../.pi/extensions/runtime/lib/armory-package-cache.mjs";

const pkg = { name: "@mockasort-studio/pi-github-tools", version: "0.1.5", integrity: "sha512-test" };

async function install(directory, identity) {
  const root = join(directory, "node_modules", identity.name);
  await mkdir(root, { recursive: true });
  await writeFile(join(root, "package.json"), JSON.stringify({ name: identity.name, version: identity.version }));
  await writeFile(
    join(directory, "package-lock.json"),
    JSON.stringify({ packages: { [`node_modules/${identity.name}`]: { integrity: identity.integrity } } }),
  );
}

test("Env caches an npm package by pinned integrity", async () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), "armory-package-"));
  let installs = 0;
  try {
    const options = { cacheRoot, package: pkg, install: async (...args) => (installs++, install(...args)) };
    const first = await acquireArmoryPackage(options);
    const second = await acquireArmoryPackage(options);
    assert.equal(first, second);
    assert.equal(installs, 1);
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});

test("Env rejects a package installer whose lock integrity differs", async () => {
  const cacheRoot = mkdtempSync(join(tmpdir(), "armory-package-"));
  try {
    await assert.rejects(
      acquireArmoryPackage({
        cacheRoot,
        package: pkg,
        install: (directory, identity) => install(directory, { ...identity, integrity: "sha512-other" }),
      }),
      /integrity mismatch/,
    );
  } finally {
    rmSync(cacheRoot, { recursive: true, force: true });
  }
});
