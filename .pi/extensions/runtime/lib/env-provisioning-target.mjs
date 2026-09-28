import path from "node:path";

export const ARMORY_SIDECAR_PATH = "/var/lib/hall/armory/sidecar.json";
const packageJsonPath = (root, name) => path.posix.join(root, "node_modules", name, "package.json");

const readJson = async (fs, file) => {
  try {
    return JSON.parse(await fs.readFile(file, { encoding: "utf8" }));
  } catch {
    return undefined;
  }
};

async function succeeds(guest, argv) {
  try {
    return (await guest.exec(argv)).exitCode === 0;
  } catch {
    return false;
  }
}

function validInstalledPackage(sidecar, installed) {
  return (
    sidecar.package?.name === installed?.name &&
    sidecar.package?.version === installed?.version &&
    typeof sidecar.package.integrity === "string" &&
    sidecar.package.integrity.length > 0
  );
}

// Env's generic guest-filesystem target. `guest` only needs fs.readFile and
// exec(argv); installer/ensureNative perform provider-specific guest work.
export function createProvisioningTarget({ guest, installPackage, ensureNative, packageRoot = "/opt/hall/armory" }) {
  if (!guest?.fs?.readFile || !guest?.exec) throw new Error("Env target requires guest filesystem and executor");
  return {
    async findVerifiedSuite(request) {
      const sidecar = await readJson(guest.fs, ARMORY_SIDECAR_PATH);
      const suite = sidecar?.suites?.find((item) => item.suite === request.suite);
      if (!suite || !validInstalledPackage(suite, await readJson(guest.fs, packageJsonPath(packageRoot, suite.package?.name))))
        return undefined;
      if (!(await succeeds(guest, ["/usr/bin/env", suite.native.command, ...(suite.native.system?.probe ?? ["--version"])])))
        return undefined;
      return suite;
    },
    async materializeSuite(material) {
      await installPackage(material.package, packageRoot);
      await ensureNative(material.native);
      const installed = await readJson(guest.fs, packageJsonPath(packageRoot, material.package.name));
      if (!validInstalledPackage({ package: material.package }, installed))
        throw new Error(`Guest package verification failed: ${material.package.name}`);
      if (!(await succeeds(guest, ["/usr/bin/env", material.native.command, ...(material.native.system?.probe ?? ["--version"])])))
        throw new Error(`Guest native probe failed: ${material.native.command}`);
      return { ...material };
    },
  };
}
