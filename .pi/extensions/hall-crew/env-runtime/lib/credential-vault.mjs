// A host-owned source adapter. Production callers can provide renewable vault
// sources; environment is deliberately only the default bootstrap source.
export function createCredentialVault({ sources = { environment: environmentSource } } = {}) {
  return {
    async lease(bindings, context) {
      const leases = new Map();
      for (const binding of bindings) {
        const [kind, reference] = binding.source.split(":", 2);
        const source = sources[kind];
        if (!source) throw new Error(`Unknown credential source: ${kind}`);
        const lease = await source({ reference, binding, context });
        if (lease?.value) leases.set(binding.guestEnvironment, { ...lease, hosts: binding.hosts });
      }
      return leases;
    },
  };
}

async function environmentSource({ reference }) {
  const value = process.env[reference];
  delete process.env[reference];
  return value ? { value, async revoke() {} } : undefined;
}

export async function revokeVaultLeases(leases) {
  await Promise.allSettled([...leases.values()].map((lease) => lease.revoke?.()));
  leases.clear();
}
