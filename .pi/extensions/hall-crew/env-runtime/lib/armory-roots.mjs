import { homedir } from "node:os";
import { join } from "node:path";
import { guestNixSystem } from "./nix-closure-build.mjs";

// Nix garbage collection deletes any store path without a root. A suite closure
// is expensive to fetch cold, so each is rooted here, one link per suite and
// guest system. A newer catalog revision overwrites the link, so older closures
// become collectable instead of accumulating.
export const armoryRootsDir = (home = homedir()) => join(home, ".cache", "hall", "armory", "roots");

export const armoryRoot = (suite, system = guestNixSystem(), home) =>
  join(armoryRootsDir(home), `${String(suite).replaceAll("/", "_")}-${system}`);
