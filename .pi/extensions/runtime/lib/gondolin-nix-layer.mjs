import { ReadonlyProvider, RealFSProvider } from "@earendil-works/gondolin";

const STORE_PATH = /^\/nix\/store\/[a-z0-9]{32}-[^/]+$/;

// Mount each exact path, never `/nix`: an arbitrary guest shell must not see
// unrelated host store entries.
export function createGondolinNixLayer(paths, { provider = (path) => new ReadonlyProvider(new RealFSProvider(path)) } = {}) {
  if (!Array.isArray(paths) || !paths.length || new Set(paths).size !== paths.length || !paths.every((path) => STORE_PATH.test(path)))
    throw new Error("Gondolin Nix layer requires unique Nix store paths");
  return Object.fromEntries(paths.map((path) => [path, provider(path)]));
}
