import { execFileSync } from "node:child_process";

// Dynamic, not static: worker-gondolin-extension.mjs transitively imports
// @earendil-works/pi-coding-agent, which is only resolvable from inside a
// real pi-launched process (a worker, or Main itself) -- not from a plain
// `node --test` process, and not from any other host context that never
// loaded Gondolin. A static top-level import would make gh.ts itself fail to
// load anywhere that package isn't resolvable, breaking every GitHub tool
// call and test outside a worker. Resolving this lazily, on first real call,
// also means a newly available guest VM is picked up on the very next `gh()`
// call with no `/reload` and no extension re-registration -- the routing
// decision is data ("is a VM active right now"), not something wired once at
// module-load time.
let gondolinAccessors;
async function loadGondolinAccessors() {
  if (gondolinAccessors !== undefined) return gondolinAccessors;
  try {
    const [{ getActiveGondolinVm }, { execGhInGuest }] = await Promise.all([
      import("../../../runtime/lib/worker-gondolin-extension.mjs"),
      import("../../../runtime/lib/armory-gh.mjs"),
    ]);
    gondolinAccessors = { getActiveGondolinVm, execGhInGuest };
  } catch {
    // Gondolin isn't loaded/loadable in this process at all (for example
    // Main's own non-worker session, or an environment without the package).
    // That is exactly "no active VM", not a failure: fall back to host exec.
    gondolinAccessors = { getActiveGondolinVm: () => undefined, execGhInGuest: undefined };
  }
  return gondolinAccessors;
}

export class GithubError extends Error {
  constructor(message, { cause, status, operation, resource } = {}) {
    super(message, { cause });
    this.name = "GithubError";
    this.status = status;
    this.operation = operation;
    this.resource = resource;
    this.transient = status === 408 || status === 425 || status === 429 || status >= 500;
  }
}

function statusOf(error) {
  if (Number.isInteger(error?.status)) return error.status;
  const match = `${error?.stderr ?? ""}\n${error?.message ?? ""}`.match(
    /\bHTTP\s+(\d{3})\b|\bstatus(?:Code)?[=: ]+(\d{3})\b/i,
  );
  return match ? Number(match[1] ?? match[2]) : undefined;
}

export function githubError(error, operation, resource) {
  if (error instanceof GithubError) return error;
  const status = statusOf(error);
  const detail = error?.stderr?.trim() || error?.message || "unknown GitHub failure";
  return new GithubError(`GitHub ${operation} failed for ${resource}${status ? ` (HTTP ${status})` : ""}: ${detail}`, {
    cause: error,
    status,
    operation,
    resource,
  });
}

function context(args, opts) {
  const operation = opts.operation ?? `${args[0] ?? "GitHub"} ${args[1] ?? "operation"}`;
  const resource =
    opts.resource ??
    args.find((arg) => typeof arg === "string" && /^(?:[^/]+\/[^/]+|\d+)$/.test(arg)) ??
    "GitHub resource";
  return { operation, resource };
}

// Guest-only Armory routing: when this process has an active Gondolin VM
// (the worker is sandboxed), `gh` runs only inside that guest -- this file
// never executes it on the host in that case. Outside a sandboxed worker
// (Main, or a worker with microvm: "none"), the host fallback is byte-for-
// byte the pre-Armory behavior. Either path throws the same `GithubError`
// shape, so callers never see a different error contract based on sandboxing.
//
// `deps` is plain dependency injection, not test-only scaffolding: it lets
// `gh()` be re-checked on every call (no reload needed to notice a VM that
// started after this module was first loaded) while still letting tests
// exercise the real routing logic with a fake VM/exec, with no experimental
// module-mocking flag and no global mutation.
export async function gh(args, opts = {}, deps) {
  const { operation, resource } = context(args, opts);
  const { operation: _operation, resource: _resource, ...execOpts } = opts;
  const resolvedDeps = deps ?? { ...(await loadGondolinAccessors()), execFileSync };
  try {
    const vm = resolvedDeps.getActiveGondolinVm();
    if (vm) return await resolvedDeps.execGhInGuest(vm, args);
    return resolvedDeps.execFileSync("gh", args, { encoding: "utf8", ...execOpts }).trim();
  } catch (error) {
    throw githubError(error, operation, resource);
  }
}

export async function ghJson(args, opts = {}, deps) {
  const { operation, resource } = context(args, opts);
  const out = await gh(args, opts, deps);
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch (error) {
    throw githubError(error, operation, resource);
  }
}
