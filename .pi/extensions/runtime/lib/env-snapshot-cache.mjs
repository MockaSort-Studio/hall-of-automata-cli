import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Env-owned sealed-snapshot cache boundary.
//
// This module knows nothing about Armory (catalogs, suite manifests, tool
// vendors) and nothing about GitHub registration -- it is the generic,
// content-addressed cache mechanics described in
// docs/crew/armory-env-lifecycle.md: "snapshot digest = base image +
// installed suite manifest/payload digests". Whatever produced those bytes
// is the caller's concern; this module only guarantees that a given profile
// key resolves to at most one sealed, immutable entry.
//
// Sealed marker file. Its presence is the sole publication signal: a
// directory missing this file is not yet a valid cache entry, even if other
// files under it already exist (e.g. a torn-down publish attempt).
const SEALED_MARKER = "sealed.json";

const sortKeys = (value) => {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  return value;
};

/**
 * Deterministic identity for a profile: the same logical profile (same
 * fields, any key order) always produces the same key, and any change to
 * the profile's shape produces a different one. This is the "snapshot
 * digest" axis from armory-env-lifecycle.md, not the separate authorization
 * digest -- callers combine both as needed.
 */
export function profileKey(profile) {
  const canonical = JSON.stringify(sortKeys(profile ?? {}));
  return createHash("sha256").update(canonical).digest("hex");
}

const entryDir = (cacheRoot, key) => join(cacheRoot, key);
const sealedMarkerPath = (dir) => join(dir, SEALED_MARKER);

/**
 * Look up an already-sealed snapshot for this exact profile key. Returns the
 * entry's directory path, or undefined on a miss. Never partially-written:
 * a directory without a sealed marker is treated as absent.
 */
export function lookupSealedSnapshot(cacheRoot, key) {
  const dir = entryDir(cacheRoot, key);
  return existsSync(sealedMarkerPath(dir)) ? dir : undefined;
}

/**
 * Publish a sealed snapshot for this profile key, or return the existing one
 * unchanged if another publisher already sealed it first. `populate(tempDir)`
 * is called at most once per successful publish and must write the entry's
 * full content into `tempDir` before returning.
 *
 * Immutability contract: once a key is sealed, this function never invokes
 * `populate` again for it and never mutates the sealed directory's content --
 * first publisher wins, every later call is a read-only lookup.
 */
export async function publishSealedSnapshot(cacheRoot, key, populate) {
  const existing = lookupSealedSnapshot(cacheRoot, key);
  if (existing) return existing;

  mkdirSync(cacheRoot, { recursive: true });
  const tempDir = mkdtempSync(join(cacheRoot, ".tmp-"));
  try {
    await populate(tempDir);
    writeFileSync(sealedMarkerPath(tempDir), JSON.stringify({ key, sealedAt: new Date().toISOString() }));

    const finalDir = entryDir(cacheRoot, key);
    try {
      renameSync(tempDir, finalDir);
      return finalDir;
    } catch (error) {
      // Lost a publish race: someone else's rename landed first. Their
      // sealed content is authoritative -- discard ours rather than
      // overwrite it.
      if (existsSync(sealedMarkerPath(finalDir))) {
        rmSync(tempDir, { recursive: true, force: true });
        return finalDir;
      }
      throw error;
    }
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true });
    throw error;
  }
}

/** Read and parse a sealed entry's marker metadata (key, sealedAt). */
export function readSealedMetadata(sealedDir) {
  return JSON.parse(readFileSync(sealedMarkerPath(sealedDir), "utf8"));
}
