import { createProvisioningTarget } from "./env-provisioning-target.mjs";
import { ensureGuestNative, installGuestPackage } from "./gondolin-guest-installer.mjs";

const guestPlatform = (architecture = process.arch) => `linux-${architecture === "x64" ? "amd64" : architecture}`;

// Gondolin-specific half of Env's provisioning provider. It adapts a VM to
// Env's generic target; Armory never imports this module. Callers supply
// guest-only installers because package/native acquisition policy belongs to
// the selected suite and must remain testable independently of VM lifecycle.
export function createGondolinProvisioningTarget(vm, installers = {}) {
  const packageRoot = installers.packageRoot ?? "/opt/hall/armory";
  const platform = installers.platform ?? guestPlatform();
  if (!vm?.fs || !vm?.exec) throw new Error("Gondolin provisioning requires a VM filesystem and executor");
  return createProvisioningTarget({
    guest: {
      fs: vm.fs,
      async exec(argv) {
        return vm.exec(argv);
      },
    },
    installPackage: installers.installPackage ?? ((pkg, root) => installGuestPackage(vm, pkg, root)),
    ensureNative: installers.ensureNative ?? ((native) => ensureGuestNative(vm, native, { platform, root: packageRoot })),
    packageRoot,
  });
}
