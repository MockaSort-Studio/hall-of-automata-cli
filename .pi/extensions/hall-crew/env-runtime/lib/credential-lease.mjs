import { randomUUID } from "node:crypto";

export const CREDENTIAL_LEASE_ENV = "HALL_CREW_GUEST_CREDENTIAL_LEASE";

export function issueCredentialLease(network, environment = process.env) {
  const credentials = {};
  for (const policy of network?.credentials ?? []) {
    const value = environment[policy.environment];
    delete environment[policy.environment];
    if (value) credentials[policy.environment] = { value, hosts: policy.hosts };
  }
  return { id: randomUUID(), credentials };
}

export function consumeCredentialLease(environment = process.env) {
  const raw = environment[CREDENTIAL_LEASE_ENV];
  delete environment[CREDENTIAL_LEASE_ENV];
  if (!raw) return { id: undefined, credentials: new Map() };
  let lease;
  try {
    lease = JSON.parse(raw);
  } catch {
    throw new Error("Invalid worker credential lease.");
  }
  if (!lease || typeof lease.id !== "string" || !lease.credentials || typeof lease.credentials !== "object")
    throw new Error("Invalid worker credential lease.");
  const credentials = new Map();
  for (const [name, entry] of Object.entries(lease.credentials)) {
    if (typeof entry?.value !== "string" || !Array.isArray(entry.hosts) || !entry.hosts.every((host) => typeof host === "string"))
      throw new Error("Invalid worker credential lease.");
    credentials.set(name, entry);
  }
  return { id: lease.id, credentials };
}

export function revokeCredentialLease(lease) {
  lease.credentials.clear();
}
