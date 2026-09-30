import { strict as assert } from "node:assert";
import test from "node:test";
import {
  CREDENTIAL_LEASE_ENV,
  consumeCredentialLease,
  issueCredentialLease,
  revokeCredentialLease,
} from "../../.pi/extensions/hall-crew/env-runtime/lib/credential-lease.mjs";

test("issues a per-worker lease without retaining a raw credential environment variable", () => {
  const environment = { GITHUB_TOKEN: "secret", OTHER_TOKEN: "unrelated" };
  const lease = issueCredentialLease({ credentials: [{ environment: "GITHUB_TOKEN", hosts: ["api.github.com"] }] }, environment);
  assert.match(lease.id, /^[0-9a-f-]{36}$/);
  assert.equal(environment.GITHUB_TOKEN, undefined);
  assert.equal(environment.OTHER_TOKEN, "unrelated");
  assert.deepEqual(lease.credentials, { GITHUB_TOKEN: { value: "secret", hosts: ["api.github.com"] } });
});

test("consumes and revokes a credential lease", () => {
  const environment = {
    [CREDENTIAL_LEASE_ENV]: JSON.stringify({ id: "lease", credentials: { GITHUB_TOKEN: { value: "secret", hosts: ["api.github.com"] } } }),
  };
  const lease = consumeCredentialLease(environment);
  assert.equal(environment[CREDENTIAL_LEASE_ENV], undefined);
  assert.equal(lease.credentials.get("GITHUB_TOKEN").value, "secret");
  revokeCredentialLease(lease);
  assert.equal(lease.credentials.size, 0);
});
