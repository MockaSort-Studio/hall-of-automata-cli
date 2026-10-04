import { armoryCache } from "./armory-cache.mjs";
import { resolveArmoryCatalogReference } from "./armory-catalog-reference.mjs";

export const ARMORY_REPOSITORY = "MockaSort-Studio/hall-armory";
export const LATEST_RELEASE_URL = `https://github.com/${ARMORY_REPOSITORY}/releases/latest/download/artifacts.json`;
export const pinnedReleaseUrl = (revision) =>
  `https://github.com/${ARMORY_REPOSITORY}/releases/download/armory-${revision}/artifacts.json`;

const STORE_PATH = /^\/nix\/store\/[a-z0-9]{32}-[^/]+$/;
const NAR_HASH = /^sha256-[A-Za-z0-9+/]{43}=$/;
const SYSTEMS = ["x86_64-linux", "aarch64-linux"];

// This is the trust boundary for a downloaded catalog. It is deliberately strict
// and independent of the producer's own validation.
export function validateArtifactCatalog(doc, cache = armoryCache) {
  const fail = (message) => {
    throw new Error(`Invalid Armory artifact catalog: ${message}`);
  };
  if (doc?.format !== "hall.armory-artifacts/v1") fail("unsupported format");
  if (!/^[0-9a-f]{40}$/.test(doc.revision ?? "")) fail("revision must be a full git commit");
  // Never follow a catalog to a cache this client has not been configured to trust.
  if (doc.cache?.substituter !== cache.substituter || doc.cache?.publicKey !== cache.publicKey)
    fail("it names a different binary cache than the one pinned by this client");
  if (doc.catalog?.format !== "hall.armory/v1") fail("embedded catalog is not hall.armory/v1");
  for (const [id, suite] of Object.entries(doc.suites ?? {})) {
    if (suite.manifest?.format !== "hall.armory-suite/v1" || typeof suite.manifestPath !== "string")
      fail(`${id}: embedded manifest is missing`);
    for (const [system, artifact] of Object.entries(suite.systems ?? {})) {
      if (!SYSTEMS.includes(system)) fail(`${id}: unknown system ${system}`);
      const closure = artifact.closure ?? [];
      const valid = closure.every((item) => STORE_PATH.test(item.path) && NAR_HASH.test(item.narHash));
      if (!STORE_PATH.test(artifact.storePath) || !NAR_HASH.test(artifact.narHash) || !valid)
        fail(`${id}/${system}: bad store path or hash`);
      if (!closure.some((item) => item.path === artifact.storePath)) fail(`${id}/${system}: closure omits its root`);
    }
  }
  return doc;
}

export async function fetchArtifactCatalog({ url = LATEST_RELEASE_URL, fetchImpl = fetch, cache } = {}) {
  const response = await fetchImpl(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Armory release unavailable (HTTP ${response.status})`);
  return validateArtifactCatalog(await response.json(), cache);
}

// A catalog reference that needs no Nix to resolve: manifests are embedded and the
// artifact paths are known. `flake` is the same revision, kept for the slow path.
export function referenceFromArtifacts(doc) {
  return {
    flake: `github:${ARMORY_REPOSITORY}/${doc.revision}`,
    revision: doc.revision,
    manifest: "manifest.json",
    catalog: doc.catalog,
    manifests: Object.fromEntries(Object.values(doc.suites).map((suite) => [suite.manifestPath, suite.manifest])),
    artifacts: Object.fromEntries(Object.entries(doc.suites).map(([id, suite]) => [id, suite.systems])),
    release: pinnedReleaseUrl(doc.revision),
  };
}

// Prefer the released catalog. A pinned `flake` without a `release` means the launch
// already fell back, so the worker must not drift to a newer release.
export async function resolveArmoryCatalog({ release, flake, fetchImpl, cache, ...flakeOptions } = {}) {
  if (release || !flake) {
    try {
      return referenceFromArtifacts(await fetchArtifactCatalog({ url: release, fetchImpl, cache }));
    } catch (error) {
      const reference = await resolveArmoryCatalogReference({ flake, ...flakeOptions });
      return { ...reference, artifactsError: String(error?.message ?? error) };
    }
  }
  return resolveArmoryCatalogReference({ flake, ...flakeOptions });
}
