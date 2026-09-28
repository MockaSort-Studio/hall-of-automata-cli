const CATALOG_FORMAT = "hall.armory/v1";
const SUITE_FORMAT = "hall.armory-suite/v1";

export const ARMORY_CATALOG_URL = "https://raw.githubusercontent.com/MockaSort-Studio/hall-armory/main/manifest.json";

const requiredString = (value, label) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Armory ${label} is required`);
  return value;
};

async function fetchJson(url, fetcher) {
  const response = await fetcher(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Armory manifest fetch failed (${response.status}): ${url}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`Armory manifest is not JSON: ${url}`);
  }
}

function suiteEntry(catalog, suite) {
  if (catalog?.format !== CATALOG_FORMAT || !Array.isArray(catalog.lockers))
    throw new Error("Unsupported Armory catalog format");
  const [locker, extension] = requiredString(suite, "suite").split("/");
  const entry = catalog.lockers.find((item) => item.name === locker)?.suites?.find((item) => item.extension === extension);
  if (!entry) throw new Error(`Armory suite is not cataloged: ${suite}`);
  return entry;
}

function validatePackage(value) {
  if (!value || typeof value !== "object") throw new Error("Armory package is required");
  return {
    name: requiredString(value.name, "package name"),
    version: requiredString(value.version, "package version"),
    integrity: requiredString(value.integrity, "package integrity"),
  };
}

function validateSuite(suite, requestedTools) {
  if (suite?.format !== SUITE_FORMAT) throw new Error("Unsupported Armory suite manifest format");
  requiredString(suite.extension, "extension");
  requiredString(suite.native?.command, "native command");
  if (!Array.isArray(suite.tools) || !suite.tools.every((tool) => typeof tool === "string" && tool))
    throw new Error(`Armory suite ${suite.extension} has an invalid tool allowlist`);
  const tools = requestedTools ?? suite.tools;
  if (!Array.isArray(tools) || tools.some((tool) => !suite.tools.includes(tool)))
    throw new Error(`Armory suite ${suite.extension} was requested with undeclared tools`);
  return { ...suite, package: validatePackage(suite.package), tools: [...new Set(tools)] };
}

export async function resolveLiveArmorySuite({ suite, tools, catalogUrl = ARMORY_CATALOG_URL, fetcher = fetch }) {
  const catalog = await fetchJson(catalogUrl, fetcher);
  const entry = suiteEntry(catalog, suite);
  const manifestUrl = new URL(requiredString(entry.manifest, "suite manifest path"), catalogUrl).href;
  return { catalogUrl, manifestUrl, suite: validateSuite(await fetchJson(manifestUrl, fetcher), tools) };
}
