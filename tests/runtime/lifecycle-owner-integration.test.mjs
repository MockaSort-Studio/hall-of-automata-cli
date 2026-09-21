import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Runtime } from "../../.pi/extensions/runtime/lib/runtime.mjs";
import { listOwners, recordOwner } from "../../.pi/extensions/runtime/lib/lifecycle-registry.mjs";

test("Runtime records and clears its own Lifecycle server's owner file", async () => {
  const cwd = process.cwd();
  const runtime = new Runtime(cwd);
  try {
    await runtime.list(); // triggers #ensureLifecycle() without spawning any worker
    const owners = await listOwners(cwd);
    assert.equal(owners.length, 1);
    assert.equal(owners[0].hostPid, process.pid);
  } finally {
    await runtime.stop();
  }
  assert.deepEqual(await listOwners(cwd), []);
});

test("Runtime reaps a stale owner record from a dead host session before spawning its own", async () => {
  const cwd = process.cwd();
  await recordOwner(cwd, { pid: 999999, hostPid: 999999, port: 1 });
  const runtime = new Runtime(cwd);
  try {
    await runtime.list();
    const owners = await listOwners(cwd);
    // The stale record (dead pid 999999) is gone; only this Runtime's live
    // Lifecycle server owner record remains.
    assert.equal(
      owners.some((owner) => owner.pid === 999999),
      false,
    );
  } finally {
    await runtime.stop();
  }
});
