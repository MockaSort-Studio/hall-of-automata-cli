import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

// Nix installers add their profile to interactive shell setup only, so a Pi
// process started elsewhere may not have `nix` on PATH. Prefer PATH, then the
// standard install location.
const DEFAULT_PROFILE_NIX = "/nix/var/nix/profiles/default/bin/nix";

export function nixBinary({
  onPath = () => spawnSync("nix", ["--version"], { stdio: "ignore" }).status === 0,
  exists = existsSync,
} = {}) {
  if (onPath()) return "nix";
  return exists(DEFAULT_PROFILE_NIX) ? DEFAULT_PROFILE_NIX : "nix";
}
