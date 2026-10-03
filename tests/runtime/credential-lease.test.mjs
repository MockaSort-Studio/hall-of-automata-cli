import { strict as assert } from "node:assert";
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
