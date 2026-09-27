import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import test from "node:test";
import {
  WORKER_COMM_HOST_CONTROL_EXTENSION,
  classifySandboxExtensionPath,
  validateGondolinWorkerExtensionPath,
} from "../../.pi/extensions/runtime/lib/sandbox-extension-paths.mjs";

test("classifies the worker Comm extension as permitted host control", () => {
  assert.equal(classifySandboxExtensionPath(WORKER_COMM_HOST_CONTROL_EXTENSION), "worker-comm-host-control");
  assert.equal(
    validateGondolinWorkerExtensionPath(WORKER_COMM_HOST_CONTROL_EXTENSION, "developer-tomashco-00"),
    "worker-comm-host-control",
  );
});

test("rejects an arbitrary host-executing extension path with worker context", () => {
  const path = resolve("/tmp/untrusted-host-extension.mjs");
  assert.equal(classifySandboxExtensionPath(path), "host-executing");
  assert.throws(
    () => validateGondolinWorkerExtensionPath(path, "developer-tomashco-00"),
    /Gondolin worker developer-tomashco-00.*untrusted-host-extension\.mjs.*host-executing/i,
  );
});
