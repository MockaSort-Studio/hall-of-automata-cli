import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { openSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { consumeCredentialLease, issueCredentialLease, revokeCredentialLease } from "../../.pi/extensions/hall-crew/env-runtime/lib/credential-lease.mjs";

test("issues a per-worker lease without retaining a raw credential environment variable", () => {
  const environment = { GITHUB_TOKEN: "secret", OTHER_TOKEN: "unrelated" };
  const lease = issueCredentialLease({ credentials: [{ environment: "GITHUB_TOKEN", hosts: ["api.github.com"] }] }, environment);
  assert.match(lease.id, /^[0-9a-f-]{36}$/);
  assert.equal(environment.GITHUB_TOKEN, undefined);
  assert.equal(environment.OTHER_TOKEN, "unrelated");
});

test("consumes and revokes a credential lease from a private descriptor", () => {
  const path = join(tmpdir(), `credential-lease-${process.pid}`);
  writeFileSync(path, JSON.stringify({ id: "lease", credentials: { GITHUB_TOKEN: { value: "secret", hosts: ["api.github.com"] } } }));
  const fd = openSync(path, "r");
  try {
    const lease = consumeCredentialLease(fd);
    assert.equal(lease.credentials.get("GITHUB_TOKEN").value, "secret");
    revokeCredentialLease(lease);
    assert.equal(lease.credentials.size, 0);
  } finally { rmSync(path, { force: true }); }
});

test("standalone use, with no descriptor 3, is tolerated on every platform (ENXIO on macOS)", () => {
  const module = new URL("../../.pi/extensions/hall-crew/env-runtime/lib/credential-lease.mjs", import.meta.url).href;
  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "-e", `import { consumeCredentialLease } from "${module}"; const l = consumeCredentialLease(); console.log(JSON.stringify({ id: l.id ?? null, size: l.credentials.size }));`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  assert.deepEqual(JSON.parse(output), { id: null, size: 0 });
});
