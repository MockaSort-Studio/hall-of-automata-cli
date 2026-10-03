// Host-owned bindings. Armory names a suite; it never selects a secret source
// or the destinations at which a secret may be substituted.
const policies = new Map([
  [
    "collaboration/pi-github-tools",
    [{ slot: "github-api", environment: "GITHUB_TOKEN", guestEnvironment: "GITHUB_TOKEN", hosts: ["api.github.com", "github.com"], source: "environment:GITHUB_TOKEN" }],
  ],
]);

export function credentialPolicyForSuites(suites) {
  const bindings = [];
  for (const suite of suites) bindings.push(...(policies.get(suite) ?? []));
  const names = new Set();
  for (const binding of bindings) {
    if (names.has(binding.guestEnvironment)) throw new Error(`Conflicting credential binding: ${binding.guestEnvironment}`);
    names.add(binding.guestEnvironment);
  }
  return bindings;
}
