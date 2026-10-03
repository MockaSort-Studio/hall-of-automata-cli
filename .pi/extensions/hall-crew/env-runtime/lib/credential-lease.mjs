import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

export function issueCredentialLease(network, environment = process.env) {
  const credentials = {};
  for (const policy of network?.credentials ?? []) {
    const value = environment[policy.environment];
    delete environment[policy.environment];
    if (value) credentials[policy.environment] = { value, hosts: policy.hosts };
  }
  return { id: randomUUID(), credentials };
}

export function consumeCredentialLease(fd = 3) {
  let lease;
  try {
    lease = JSON.parse(readFileSync(fd, "utf8"));
  } catch (error) {
    // Standalone Gondolin use has no worker credential descriptor.
    if (error?.code === "EBADF" || error?.code === "EINVAL") return { id: undefined, credentials: new Map() };
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
