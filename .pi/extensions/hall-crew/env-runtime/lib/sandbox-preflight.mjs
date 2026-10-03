import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

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
function verifyNix(binary = "nix") {
  const result = spawnSync(binary, ["--version"], { stdio: "ignore" });
  if (!result.error && result.status === 0) return;
  throw new Error(
    "Gondolin sandbox requires Nix for Armory suites; install it (curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install).",
  );
}

export async function preflightWorkerSandbox(config, dependencies = {}) {
  if (!config.sandbox) return;
  if (config.sandbox.kind !== "gondolin") throw new Error(`Unsupported worker sandbox: ${config.sandbox.kind}`);
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
}
