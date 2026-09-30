import { RealFSProvider, ShadowProvider, VM, createHttpHooks, createShadowPathPredicate } from "@earendil-works/gondolin";
import {
  createBashTool,
  createEditTool,
  createFindTool,
  createGrepTool,
  createLsTool,
  createReadTool,
  createWriteTool,
} from "@earendil-works/pi-coding-agent";
import { HIDDEN_WORKSPACE_PATHS, GUEST_WORKSPACE } from "./gondolin-worker-paths.mjs";
import {
  editOperations,
  executeGrep,
  findOperations,
  lsOperations,
  readOperations,
  writeOperations,
} from "./gondolin-worker-operations.mjs";
import { bashOperations } from "./gondolin-worker-shell.mjs";
import { createGondolinNixLayer } from "./gondolin-nix-layer.mjs";
import { readWorkerArmoryConfig } from "./worker-armory-config.mjs";
import { consumeCredentialLease, revokeCredentialLease } from "./credential-lease.mjs";

// A resident worker's own new_session call (see worker.mjs) fires
// session_shutdown -> reload -> session_start again in this same process,
// re-invoking this factory with a fresh `pi`. `vm`/`starting` are
// module-level, not per-invocation, so ensureVm() stays idempotent and
// getActiveGondolinVm() always returns the one real VM for this worker's
// whole lifetime instead of a second invocation racing its own separate,
// orphaned VM boot -- exactly the class of bug fixed in
// worker-comm-extension.mjs for the Comm connection.
let vm;
let starting;
const credentialLease = consumeCredentialLease();

async function startVm(localCwd) {
  const armory = readWorkerArmoryConfig();
  const secrets = Object.fromEntries(
    (armory.network?.credentials ?? [])
      .filter((credential) => credentialLease.credentials.has(credential.environment))
      .map((credential) => [credential.environment, credentialLease.credentials.get(credential.environment)]),
  );
  const network = armory.network ? createHttpHooks({ allowedHosts: armory.network.allowedHosts, secrets }) : undefined;
  const created = await VM.create({
    sessionLabel: `crew worker ${process.env.PI_SDK_ACTOR_ID ?? "unknown"}`,
    ...(network ? { httpHooks: network.httpHooks, env: network.env } : {}),
    vfs: {
      mounts: {
        [GUEST_WORKSPACE]: new ShadowProvider(new RealFSProvider(localCwd), {
          shouldShadow: createShadowPathPredicate(HIDDEN_WORKSPACE_PATHS),
        }),
        ...(armory.paths.length ? createGondolinNixLayer(armory.paths) : {}),
      },
    },
  });
  vm = created;
  return created;
}

async function ensureVm(localCwd) {
  if (vm) return vm;
  if (!starting) starting = startVm(localCwd).finally(() => (starting = undefined));
  return starting;
}

/**
 * The active Gondolin VM for this worker process, if a sandboxed session has
 * started one. Other extensions (for example an Armory guest-only tool
 * adapter) call this to route their own execution into the same guest
 * instead of the host, without needing to manage VM lifecycle themselves.
 * Returns undefined outside a Gondolin-sandboxed worker.
 */
export function getActiveGondolinVm() {
  return vm;
}

export function ensureActiveGondolinVm() {
  return ensureVm(process.cwd());
}

export default function gondolinWorkerExtension(pi) {
  const localCwd = process.cwd();
  const localRead = createReadTool(localCwd);
  const localWrite = createWriteTool(localCwd);
  const localEdit = createEditTool(localCwd);
  const localBash = createBashTool(localCwd);
  const localGrep = createGrepTool(localCwd);
  const localFind = createFindTool(localCwd);
  const localLs = createLsTool(localCwd);

  const routed = (local, createOperations) => ({
    ...local,
    async execute(id, params, signal, onUpdate) {
      return createOperations(await ensureVm(localCwd)).execute(id, params, signal, onUpdate);
    },
  });

  pi.on("session_start", () => ensureVm(localCwd));
  // Only a real process-ending shutdown closes the VM -- see the
  // module-level comment above for why the VM itself survives a reload.
  pi.on("session_shutdown", async (event) => {
    if (event.reason !== "quit") return;
    const activeVm = vm ?? (await starting?.catch(() => undefined));
    vm = undefined;
    starting = undefined;
    if (activeVm) await activeVm.close();
    revokeCredentialLease(credentialLease);
  });

  pi.registerTool(
    routed(localRead, (activeVm) =>
      createReadTool(GUEST_WORKSPACE, { operations: readOperations(activeVm, localCwd) }),
    ),
  );
  pi.registerTool(
    routed(localWrite, (activeVm) =>
      createWriteTool(GUEST_WORKSPACE, { operations: writeOperations(activeVm, localCwd) }),
    ),
  );
  pi.registerTool(
    routed(localEdit, (activeVm) =>
      createEditTool(GUEST_WORKSPACE, { operations: editOperations(activeVm, localCwd) }),
    ),
  );
  pi.registerTool(
    routed(localBash, (activeVm) =>
      createBashTool(GUEST_WORKSPACE, { operations: bashOperations(activeVm, localCwd) }),
    ),
  );
  pi.registerTool(
    routed(localLs, (activeVm) => createLsTool(GUEST_WORKSPACE, { operations: lsOperations(activeVm, localCwd) })),
  );
  pi.registerTool(
    routed(localFind, (activeVm) =>
      createFindTool(GUEST_WORKSPACE, { operations: findOperations(activeVm, localCwd) }),
    ),
  );
  pi.registerTool({
    ...localGrep,
    async execute(_id, params, signal) {
      return executeGrep(await ensureVm(localCwd), localCwd, params, signal);
    },
  });
  pi.on("user_bash", async () => ({ operations: bashOperations(await ensureVm(localCwd), localCwd) }));
}
