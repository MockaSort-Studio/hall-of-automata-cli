import { resolve } from "node:path";

export const WORKER_COMM_HOST_CONTROL_EXTENSION = resolve(import.meta.dirname, "worker-comm-extension.mjs");

export function classifySandboxExtensionPath(extensionPath) {
  return resolve(extensionPath) === WORKER_COMM_HOST_CONTROL_EXTENSION ? "worker-comm-host-control" : "host-executing";
}

export function validateGondolinWorkerExtensionPath(extensionPath, worker) {
  const classification = classifySandboxExtensionPath(extensionPath);
  if (classification === "worker-comm-host-control") return classification;
  throw new Error(
    `Gondolin worker ${worker}: extension path ${extensionPath} is ${classification} and is not permitted.`,
  );
}
