import { strict as assert } from "node:assert";
import test from "node:test";
import { buildNixClosure, guestNixSystem } from "../../.pi/extensions/hall-crew/env-runtime/lib/nix-closure-build.mjs";

const root = "/nix/store/0123456789abcdefghijklmnopqrstuv-gh-2.101.0";
const dependency = "/nix/store/vutsrqponmlkjihgfedcba9876543210-libc-1";

test("Env builds a suite closure and records every recursive store path", async () => {
  const calls = [];
  const closure = await buildNixClosure({
    suiteRoot: "/suites/github",
    closure: "./nix",
    execute: async (command, args) => {
      calls.push([command, args]);
      if (args[0] === "build") return { stdout: `${root}\n` };
      return { stdout: JSON.stringify({ [dependency]: {}, [root]: {} }) };
    },
  });
  assert.deepEqual(closure, {
    rootPath: root,
    paths: [root, dependency].sort(),
    closureDirectory: "/suites/github/nix",
    flake: "path:/suites/github/nix",
    output: "default",
  });
  assert.equal(calls[0][1].at(-1), "path:/suites/github/nix#default");
});

test("Env builds an explicit output from an immutable flake locator", async () => {
  const calls = [];
  await buildNixClosure({
    flake: "github:MockaSort-Studio/hall-armory/0123456789abcdef0123456789abcdef01234567?dir=collaboration/github",
    output: "guest",
    execute: async (command, args) => {
      calls.push([command, args]);
      return args[0] === "build" ? { stdout: `${root}\n` } : { stdout: JSON.stringify({ [root]: {} }) };
    },
  });
  assert.equal(calls[0][1].at(-1), `github:MockaSort-Studio/hall-armory/0123456789abcdef0123456789abcdef01234567?dir=collaboration/github#packages.${guestNixSystem()}.guest`);
});

test("Env rejects a closure path outside the suite", async () =>
  assert.rejects(
    buildNixClosure({ suiteRoot: "/suites/github", closure: "../../outside" }),
    /escapes suite root/,
  ));

test("flake outputs are selected for the Linux guest of the host architecture", () => {
  assert.equal(guestNixSystem("arm64"), "aarch64-linux");
  assert.equal(guestNixSystem("x64"), "x86_64-linux");
});

test("a GC root keeps the built closure alive and its directory is created", async () => {
  const calls = [];
  const gcRoot = `${process.env.TMPDIR ?? "/tmp"}/hall-roots-${process.pid}/suite-aarch64-linux`;
  await buildNixClosure({
    flake: "github:MockaSort-Studio/hall-armory/0123456789abcdef0123456789abcdef01234567?dir=collaboration/github",
    output: "guest",
    gcRoot,
    execute: async (command, args) => {
      calls.push(args);
      return args[0] === "build" ? { stdout: `${root}\n` } : { stdout: JSON.stringify({ [root]: {} }) };
    },
  });
  assert.deepEqual(calls[0].slice(0, 3), ["build", "--out-link", gcRoot]);
  assert.ok(!calls[0].includes("--no-link"));
});
