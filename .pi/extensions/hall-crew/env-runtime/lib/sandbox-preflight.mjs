import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { nixBinary } from "./nix-binary.mjs";

const gondolinPackage = "@earendil-works/gondolin";
const piCacheHome = () => join(homedir(), ".pi", "agent", "cache");

export function gondolinCacheHome(environment = process.env) {
  return environment.PI_GONDOLIN_CACHE_HOME ?? environment.XDG_CACHE_HOME ?? piCacheHome();
}

export function requiredQemuBinary(platform = process.platform, architecture = process.arch) {
  if (platform === "darwin" && architecture === "arm64") return "qemu-system-aarch64";
  if (architecture === "arm64") return "qemu-system-aarch64";
  return "qemu-system-x86_64";
}

function verifyQemu(binary) {
  const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
  if (!result.error && result.status === 0) return;
  throw new Error(`Gondolin sandbox requires ${binary}; install QEMU first (macOS: brew install qemu).`);
}

function verifyQemuImage(binary = "qemu-img") {
  const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
  if (!result.error && result.status === 0) return;
  throw new Error(`Gondolin sandbox requires ${binary}; install QEMU first (macOS: brew install qemu).`);
}

// Armory guest suites are Nix flake outputs, so a Gondolin worker needs Nix.
// Missing Nix makes `auto` fall back to the host; explicit `gondolin` reports it.
function verifyNix(binary = nixBinary()) {
  const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
  if (!result.error && result.status === 0) return;
  throw new Error(
    "Gondolin sandbox requires Nix for Armory suites; run scripts/setup-env.sh (installs Nix and the Armory cache; one password prompt).",
  );
}

// The checks spawn several processes (about 110 ms) and a Crew spawns its workers one
// after another, so a recent success is reused. Callers that inject their own checks
// (tests) are never memoized.
const VERIFIED_FOR_MS = 30_000;
let verifiedAt = 0;

export async function preflightWorkerSandbox(config, dependencies = {}) {
  if (!config.sandbox) return;
  if (config.sandbox.kind !== "gondolin") throw new Error(`Unsupported worker sandbox: ${config.sandbox.kind}`);
  const memoize = Object.keys(dependencies).length === 0;
  if (memoize && Date.now() - verifiedAt < VERIFIED_FOR_MS) return;
  const environment = dependencies.environment ?? process.env;
  environment.XDG_CACHE_HOME ??= gondolinCacheHome(environment);
  const binary = requiredQemuBinary();
  (dependencies.verifyQemu ?? verifyQemu)(binary);
  (dependencies.verifyQemuImage ?? verifyQemuImage)();
  (dependencies.verifyNix ?? verifyNix)();
  try {
    const gondolin = dependencies.gondolin ?? (await import(gondolinPackage));
    await gondolin.ensureGuestAssets();
  } catch (error) {
    throw new Error(`Gondolin sandbox preflight failed: ${error.message}`);
  }
  if (memoize) verifiedAt = Date.now();
}
