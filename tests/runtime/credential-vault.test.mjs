import { strict as assert } from "node:assert";
import test from "node:test";
import { createCredentialVault, revokeVaultLeases } from "../../.pi/extensions/hall-crew/env-runtime/lib/credential-vault.mjs";

test("vault sources, scopes, and revokes a credential lease", async () => {
  let revoked = false;
  const vault = createCredentialVault({ sources: { test: async ({ reference }) => ({ value: reference, async revoke() { revoked = true; } }) } });
  const leases = await vault.lease([{ source: "test:secret", guestEnvironment: "TOKEN", hosts: ["api.example.test"] }], {});
  assert.deepEqual(leases.get("TOKEN").hosts, ["api.example.test"]);
  await revokeVaultLeases(leases);
  assert.equal(revoked, true);
  assert.equal(leases.size, 0);
});
