import { readCatalogSuite, suiteFlakeLocator } from "./armory-catalog-reference.mjs";
import { validateArmorySuite } from "./armory-manifest.mjs";
import { buildNixClosure } from "./nix-closure-build.mjs";

function catalogEntry(catalog, suite) {
  if (catalog?.format !== "hall.armory/v1" || !Array.isArray(catalog.lockers))
    throw new Error("Unsupported Armory catalog format");
  const [locker, extension] = String(suite).split("/");
  const entry = catalog.lockers.find((item) => item.name === locker)?.suites?.find((item) => item.extension === extension);
  if (!entry?.manifest) throw new Error(`Armory suite is not cataloged: ${suite}`);
  return entry;
}

// The Nix-only replacement for legacy package/native guest materialization.
// It derives the exact flake from the already-resolved catalog revision, builds
// its named guest output, and returns only immutable mount paths plus approved
// operation names for the worker lease.
export async function acquireNixGuestSuite({ catalog, request, readSuite = readCatalogSuite, build = buildNixClosure }) {
  if (!request?.suite) throw new Error("Nix guest suite request requires a suite");
  const entry = catalogEntry(catalog.catalog, request.suite);
  const manifest = await readSuite(catalog, entry.manifest);
  const suite = validateArmorySuite(manifest, request.tools);
  const flake = suiteFlakeLocator(catalog, entry.manifest, suite.native);
  const artifact = await build({ flake: flake.slice(0, flake.lastIndexOf("#")), output: suite.native.output });
  return {
    suite: request.suite,
    tools: suite.tools,
    network: suite.network,
    flake,
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

export async function acquireNixGuestSuites({ catalog, requests, readSuite = readCatalogSuite, build = buildNixClosure }) {
  const resolved = await resolveNixGuestSuiteRequests({ catalog, requests, readSuite });
  return Promise.all(resolved.map((request) => acquireNixGuestSuite({ catalog, request, readSuite, build })));
}
