import { lookupSealedSnapshot, profileKey, publishSealedSnapshot } from "./env-snapshot-cache.mjs";

// Env-owned per-worker VM acquisition boundary, composed on top of the
// sealed-snapshot cache (see env-snapshot-cache.mjs) and the existing
// per-worker Gondolin lifecycle (worker-gondolin-extension.mjs).
//
// This module has no Armory, suite-manifest, or GitHub-registration
// knowledge. It takes a caller-supplied `provision` (how to populate a fresh
// environment) and `vmFactory` (how to boot one private VM instance) and
// only owns the sequencing described in
// docs/crew/armory-env-lifecycle.md's "Spawn and restore":
//
//   matching sealed snapshot -> boot private VM with a private COW overlay
//   miss                     -> provision once, seal, then boot from it
//
// `vmFactory` is invoked on every single acquisition, cache hit or miss: the
// sealed snapshot is the only thing ever shared between workers. Every
// acquisition gets its own fresh VM instance/handle -- this boundary never
// hands out a previously-returned VM to a second caller, and never mutates
// a sealed entry once published.

/**
 * Acquire one private worker VM for `profile`, provisioning and sealing a
 * cache entry first if none exists yet for this exact profile identity.
 *
 * - `provision(tempDir, profile)`: populate a fresh environment's content
 *   into `tempDir`. Called at most once per distinct profile, ever (per
 *   env-snapshot-cache.mjs's immutable-publication guarantee).
 * - `vmFactory({ sealedSnapshotPath, profileKey, profile })`: boot and
 *   return one private VM instance. Called exactly once per
 *   `acquireWorkerVm` call -- never reused, never shared.
 */
export async function acquireWorkerVm({ cacheRoot, profile, provision, vmFactory }) {
  const key = profileKey(profile);
  const sealedSnapshotPath =
    lookupSealedSnapshot(cacheRoot, key) ??
    (await publishSealedSnapshot(cacheRoot, key, (tempDir) => provision(tempDir, profile)));
  return vmFactory({ sealedSnapshotPath, profileKey: key, profile });
}
