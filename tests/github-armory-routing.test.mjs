import { strict as assert } from "node:assert";
import test from "node:test";
import { gh, GithubError } from "../.pi/extensions/github/lib/core/gh.ts";

const fakeVm = "fake-vm-marker";

test("gh() routes through the guest adapter, argv form, when a VM is active", async () => {
  const calls = [];
  const deps = {
    getActiveGondolinVm: () => fakeVm,
    execGhInGuest: async (vm, args) => {
      calls.push({ vm, args });
      return "guest output";
    },
    execFileSync: () => {
      throw new Error("host execFileSync must not be called when a VM is active");
    },
  };
  const result = await gh(["pr", "view", "7"], {}, deps);
  assert.equal(result, "guest output");
  assert.deepEqual(calls, [{ vm: fakeVm, args: ["pr", "view", "7"] }]);
});

test("gh() falls back to the unchanged host execFileSync when no VM is active", async () => {
  const hostCalls = [];
  const deps = {
    getActiveGondolinVm: () => undefined,
    execGhInGuest: async () => {
      throw new Error("guest adapter must not be called without an active VM");
    },
    execFileSync: (command, args, opts) => {
      hostCalls.push({ command, args, opts });
      return "host output\n";
    },
  };
  const result = await gh(["pr", "view", "7"], {}, deps);
  assert.equal(result, "host output");
  assert.equal(hostCalls.length, 1);
  assert.equal(hostCalls[0].command, "gh");
  assert.deepEqual(hostCalls[0].args, ["pr", "view", "7"]);
});

test("a failing guest call and a failing host call produce the identical GithubError shape", async () => {
  // Both a real execFileSync failure and armory-gh.mjs's execGhInGuest
  // failure set `.status` to the underlying process exit code (not an HTTP
  // status) -- githubError() only falls back to parsing an HTTP status out
  // of stderr when `.status` is absent. Mirror that exit-code shape on both
  // fakes so this test compares the two paths' actual, identical contract
  // instead of asserting an arbitrary invented HTTP number.
  const guestDeps = {
    getActiveGondolinVm: () => fakeVm,
    execGhInGuest: async () => {
      const error = new Error("gh exited with code 1");
      error.status = 1;
      error.stderr = "HTTP 404 Not Found";
      throw error;
    },
    execFileSync: () => "",
  };
  const hostDeps = {
    getActiveGondolinVm: () => undefined,
    execGhInGuest: async () => "",
    execFileSync: () => {
      const error = new Error("Command failed");
      error.status = 1;
      error.stderr = "HTTP 404 Not Found";
      throw error;
    },
  };

  const fromGuest = await gh(
    ["pr", "view", "404"],
    { operation: "view pull request", resource: "o/r#404" },
    guestDeps,
  ).catch((error) => error);
  const fromHost = await gh(
    ["pr", "view", "404"],
    { operation: "view pull request", resource: "o/r#404" },
    hostDeps,
  ).catch((error) => error);

  for (const error of [fromGuest, fromHost]) assert.ok(error instanceof GithubError);
  assert.equal(fromGuest.status, fromHost.status);
  assert.equal(fromGuest.operation, fromHost.operation);
  assert.equal(fromGuest.resource, fromHost.resource);
  assert.equal(fromGuest.transient, fromHost.transient);
});

test("gh() with no injected deps resolves through the real import graph, not a wiring bug", async (t) => {
  // Exercises the actual default-wired imports (getActiveGondolinVm +
  // execGhInGuest from the real modules, not fakes) -- this is exactly the
  // seam a missing/incorrect import silently breaks (as happened before this
  // fix: `getActiveGondolinVm` was referenced but never imported). Outside a
  // sandboxed worker there is no active VM, so this takes the host path and
  // must reach a real `execFileSync("gh", ...)` call.
  let output;
  try {
    output = await gh(["--version"]);
  } catch (error) {
    // A GithubError wrapping ENOENT-class "gh not installed" is an
    // environment gap, acceptable to skip; anything else (a ReferenceError
    // from a broken import surfacing as a wrapped GithubError message) is a
    // real regression and must fail the test, not be silently accepted.
    if (error instanceof GithubError && /ENOENT|not found|no such file/i.test(error.message)) {
      t.skip("gh CLI is not installed on this host");
      return;
    }
    throw error;
  }
  assert.match(output, /gh version/);
});
