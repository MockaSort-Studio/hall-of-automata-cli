import { credentialPolicyForSuites } from "../credential-policy.mjs";

const hostVariable = (binding) => binding.source.split(":", 2)[1];

// Reports, at launch, whether each credential the granted suites need is present in
// Pi's environment, and tells the person how to create one when it is not. Hall never
// reads a login or keyring on its own: the token is minted deliberately and handed over
// through the environment. Only presence is recorded, never a value.
export function checkLaunchCredentials({ suiteIds, environment = process.env }) {
  const status = {};
  const warnings = [];
  for (const binding of credentialPolicyForSuites(suiteIds)) {
    const name = hostVariable(binding);
    if (environment[name]) {
      status[name] = "environment";
      continue;
    }
    status[name] = "missing";
    warnings.push(
      `${name} is not set, so operations that need it will fail. Create ${binding.mint.advice} at ${binding.mint.url}, ` +
        `store it with scripts/setup-github-token.sh (or export ${name}), and restart Pi.`,
    );
  }
  return { status, warnings };
}
