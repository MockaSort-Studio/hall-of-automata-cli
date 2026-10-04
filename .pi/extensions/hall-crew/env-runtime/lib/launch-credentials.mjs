import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { credentialPolicyForSuites } from "../credential-policy.mjs";

const exec = promisify(execFile);
const runLogin = async ([command, ...args]) => (await exec(command, args, { encoding: "utf8", timeout: 15_000 })).stdout.trim();
const hostVariable = (binding) => binding.source.split(":", 2)[1];

// Decides, at launch, where each credential the granted suites need comes from:
// the host environment if it is set (explicit, no prompt); otherwise, only with
// the person's explicit consent, a login the policy names (`gh auth token`). The
// secrets live in memory and are handed straight to the worker processes; the
// returned `status` and `warnings` carry no secret and are safe to persist.
export async function collectLaunchCredentials({ suiteIds, environment = process.env, confirm, run = runLogin }) {
  const secrets = {};
  const status = {};
  const warnings = [];
  for (const binding of credentialPolicyForSuites(suiteIds)) {
    const name = hostVariable(binding);
    if (environment[name]) {
      status[name] = "environment";
      continue;
    }
    if (binding.login && confirm && (await confirm({ label: binding.login.label, variable: name }))) {
      const value = await run(binding.login.command).catch(() => "");
      if (value) {
        secrets[name] = value;
        status[name] = `${binding.login.label} (consented)`;
        continue;
      }
      warnings.push(`${binding.login.label} did not provide ${name}.`);
    }
    status[name] = "missing";
    warnings.push(`${name} is not available: operations that need it will fail until it is provided (set ${name} in Pi's environment or approve the ${binding.login?.label ?? "login"}).`);
  }
  return { secrets, status, warnings };
}

// Each worker receives only the secrets its own suites need.
export function secretEnvFor(agent, secrets) {
  const names = credentialPolicyForSuites((agent.environmentProfile?.suites ?? []).map((suite) => suite.suite)).map(hostVariable);
  const own = Object.fromEntries(names.filter((name) => secrets[name]).map((name) => [name, secrets[name]]));
  return Object.keys(own).length ? own : undefined;
}
