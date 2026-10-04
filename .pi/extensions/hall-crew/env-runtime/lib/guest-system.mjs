// The guest is a Linux VM of the host's architecture, so Armory artifacts are
// selected for that Nix system even when the host itself is macOS.
export const guestNixSystem = (arch = process.arch) => (arch === "arm64" ? "aarch64-linux" : "x86_64-linux");
