import { readCatalogSuite } from "./armory-artifacts.mjs";
import { validateArmorySuite } from "./armory-manifest.mjs";
import { armoryCache } from "./armory-cache.mjs";
import { armoryRoot } from "./armory-roots.mjs";
import { guestNixSystem } from "./guest-system.mjs";
import { fetchPublishedClosure } from "./published-closure.mjs";

function catalogEntry(catalog, suite) {
  if (catalog?.format !== "hall.armory/v1" || !Array.isArray(catalog.lockers))
    throw new Error("Unsupported Armory catalog format");
  const [locker, extension] = String(suite).split("/");
  const entry = catalog.lockers.find((item) => item.name === locker)?.suites?.find((item) => item.extension === extension);
  if (!entry?.manifest) throw new Error(`Armory suite is not cataloged: ${suite}`);
  return entry;
}

// Fetches one suite's published closure for this guest system. The release is the
// only source: there is no flake evaluation, and a suite the release does not
// carry for this system is an error the caller degrades from.
export async function acquireNixGuestSuite({ catalog, request, readSuite = readCatalogSuite, fetchPublished = fetchPublishedClosure }) {
  if (!request?.suite) throw new Error("Nix guest suite request requires a suite");
  const entry = catalogEntry(catalog.catalog, request.suite);
  const suite = validateArmorySuite(await readSuite(catalog, entry.manifest), request.tools);
  const system = guestNixSystem();
  const published = catalog.artifacts?.[request.suite]?.[system];
  if (!published) throw new Error(`The Armory release has no ${system} artifact for ${request.suite}`);
  const artifact = await fetchPublished({ artifact: published, cache: armoryCache, gcRoot: armoryRoot(request.suite) });
  return {
    suite: request.suite,
    tools: suite.tools,
    network: suite.network,
    rootPath: artifact.rootPath,
    paths: artifact.paths,
  };
}

export async function resolveNixGuestSuiteRequests({ catalog, requests, readSuite = readCatalogSuite }) {
  if (!Array.isArray(requests)) throw new Error("Nix guest suite requests must be an array");
  const grouped = new Map();
  for (const request of requests) {
    if (!request?.suite || !Array.isArray(request.tools) || request.tools.some((tool) => typeof tool !== "string" || !tool))
      throw new Error("Nix guest suite requests require a suite and operations");
    const tools = grouped.get(request.suite) ?? new Set();
    request.tools.forEach((tool) => tools.add(tool));
    grouped.set(request.suite, tools);
  }
  return Promise.all(
    [...grouped].map(async ([suite, tools]) => {
      const entry = catalogEntry(catalog.catalog, suite);
      const manifest = validateArmorySuite(await readSuite(catalog, entry.manifest), [...tools]);
      return { suite, tools: manifest.tools };
    }),
  );
}

export async function acquireNixGuestSuites({ catalog, requests, readSuite = readCatalogSuite, fetchPublished }) {
  const resolved = await resolveNixGuestSuiteRequests({ catalog, requests, readSuite });
  return Promise.all(resolved.map((request) => acquireNixGuestSuite({ catalog, request, readSuite, fetchPublished })));
}
