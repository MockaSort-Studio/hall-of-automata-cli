// Reusable GitHub suite descriptor: `collaboration/github` in the catalog
// hierarchy described in docs/crew/armory-env-lifecycle.md
// (locker -> suite -> operations). This module owns the one place that
// knows the full set of GitHub operations; both the static extension entry
// point (`index.ts`) and any future Armory suite loader register through
// the exact same descriptor list and the exact same `registerOperations`
// seam, so there is nowhere for the two paths to drift apart.
//
// This module intentionally does not implement an Armory loader, catalog
// index, or snapshot lifecycle -- it only exposes the data (descriptors)
// and the seam (registration) a loader would eventually call.

import { coreOperationDescriptors } from "./core/tools.ts";
import { discussionOperationDescriptors } from "./discussions/tools.ts";
import { issueOperationDescriptors } from "./issues/tools.ts";
import { labelOperationDescriptors } from "./labels/tools.ts";
import { projectOperationDescriptors } from "./projects/tools.ts";
import { pullRequestOperationDescriptors } from "./pulls/tools.ts";
import { registerOperations, type OperationDescriptor } from "./core/tool-registration.ts";

export const GITHUB_SUITE_ID = { locker: "collaboration", suite: "github" } as const;

export function githubOperationDescriptors(): OperationDescriptor[] {
  return [
    ...coreOperationDescriptors(),
    ...discussionOperationDescriptors(),
    ...issueOperationDescriptors(),
    ...labelOperationDescriptors(),
    ...projectOperationDescriptors(),
    ...pullRequestOperationDescriptors(),
  ];
}

export function registerGithubSuite(pi) {
  registerOperations(pi, githubOperationDescriptors());
}
