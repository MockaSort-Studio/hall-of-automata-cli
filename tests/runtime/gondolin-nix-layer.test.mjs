import { strict as assert } from "node:assert";
import test from "node:test";
import { createGondolinNixLayer } from "../../.pi/extensions/runtime/lib/gondolin-nix-layer.mjs";

const paths = [
  "/nix/store/0123456789abcdefghijklmnopqrstuv-gh-2.101.0",
  "/nix/store/vutsrqponmlkjihgfedcba9876543210-libc-1",
];

test("Gondolin receives one filtered read-only Nix store mount", () => {
  const mounts = createGondolinNixLayer(paths, { provider: (selected) => ({ selected, readonly: true }) });
  assert.deepEqual(mounts, { "/nix/store": { selected: paths, readonly: true } });
});

test("Gondolin Nix layer rejects duplicate store paths", () =>
  assert.throws(() => createGondolinNixLayer([paths[0], paths[0]]), /unique Nix store paths/));
