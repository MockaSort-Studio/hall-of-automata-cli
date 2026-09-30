import { cachedArmorySuite, prepareArmorySuite } from "./armory-handler.mjs";

const requestsFor = (profile) => {
  if (!Array.isArray(profile?.suites) || !profile.suites.length)
    throw new Error("Env profile requires at least one Armory suite");
  return profile.suites;
};

async function cachedSuites(target, requests) {
  const suites = await Promise.all(
    requests.map(async (request) => cachedArmorySuite(await target.findVerifiedSuite(request), request)),
  );
  return suites.every(Boolean) ? suites : undefined;
}

// Env coordinates Armory and the VM provider. It knows the provisioning and
// sealing sequence, but delegates suite semantics to Armory and VM mechanics
// to `provider`. A provider target is the only shared abstraction.
export async function acquireArmoryEnvironment({ profile, provider, prepare = prepareArmorySuite }) {
  const requests = requestsFor(profile);
  const sealed = await provider.findSealed(profile);
  if (sealed) {
    const target = await provider.inspectSealed(sealed);
    const suites = await cachedSuites(target, requests);
    if (suites) return provider.restore(sealed, { profile, suites });
  }

  const provisioning = await provider.createProvisioning(profile);
  try {
    const target = await provider.provisioningTarget(provisioning);
    const suites = [];
    for (const request of requests) suites.push(await prepare({ request, target }));
    const sidecar = { profile, suites };
    const published = await provider.seal(provisioning, sidecar);
    return provider.restore(published, { profile, suites });
  } finally {
    await provider.destroyProvisioning(provisioning);
  }
}
