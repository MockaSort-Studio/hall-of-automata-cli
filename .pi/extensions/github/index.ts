import { registerDiscussionTools } from "./lib/discussions/tools.ts";
import { registerIssueTools } from "./lib/issues/tools.ts";
import { registerProjectTools } from "./lib/projects/tools.ts";
import { registerLabelTools } from "./lib/labels/tools.ts";
import { registerCoreTools } from "./lib/core/tools.ts";
import { registerPullRequestTools } from "./lib/pulls/tools.ts";

export default function (pi) {
  registerDiscussionTools(pi);
  registerIssueTools(pi);
  registerProjectTools(pi);
  registerLabelTools(pi);
  registerCoreTools(pi);
  registerPullRequestTools(pi);
}