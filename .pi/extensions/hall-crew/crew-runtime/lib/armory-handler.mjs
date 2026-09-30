import { resolveLiveArmorySuite } from "./armory-manifest.mjs";

// Armory side of the Env/Armory boundary. A target represents a provisioning
// filesystem (or a test directory), never a VM. It must verify its own
// sidecar, installed Pi package, and native probe before returning a hit.
// Env owns booting that target and sealing it after this function returns.
const isSubset = (requested, available) => requested.every((tool) => available.includes(tool));

export function cachedArmorySuite(cached, request) {
  if (!cached || cached.suite !== request.suite || !cached.package?.name || !cached.package?.integrity || !Array.isArray(cached.tools))
    return undefined;
  const tools = request.tools ?? cached.tools;
  if (!Array.isArray(tools) || !isSubset(tools, cached.tools)) return undefined;
  return { ...cached, tools: [...new Set(tools)], source: "guest-cache" };
}

/**
 * Resolve and materialize one fixed suite profile.
 *
 * `target.findVerifiedSuite(request)` must inspect the target disk's sealed
 * sidecar and verify package/native presence. A cache hit intentionally does
 * not fetch the live manifest or package bytes. On a miss, the live manifest
 * is resolved and `target.materializeSuite` performs the guest-only install.
 */
export async function prepareArmorySuite({ request, target, resolve = resolveLiveArmorySuite }) {
  if (!request?.suite) throw new Error("Armory preparation requires a suite");
  if (!target?.findVerifiedSuite || !target?.materializeSuite)
    throw new Error("Armory preparation target must verify and materialize suites");

  const cached = cachedArmorySuite(await target.findVerifiedSuite(request), request);
  if (cached) return cached;

  const resolved = await resolve(request);
  const materialized = await target.materializeSuite({
    suite: request.suite,
    package: resolved.suite.package,
    native: resolved.suite.native,
    tools: resolved.suite.tools,
    catalogUrl: resolved.catalogUrl,
    manifestUrl: resolved.manifestUrl,
  });
  if (!materialized?.package?.name || !materialized.package?.integrity || !Array.isArray(materialized.tools))
    throw new Error(`Armory target did not verify materialized suite ${request.suite}`);
  return { ...materialized, source: "provisioned" };
}
