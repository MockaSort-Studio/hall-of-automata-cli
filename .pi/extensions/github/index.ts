import { Type } from "typebox";
import * as discussions from "./lib/discussions/index.ts";
import * as issues from "./lib/issues/index.ts";
import * as projects from "./lib/projects/index.ts";
import * as repo from "./lib/core/repo.ts";
import * as labels from "./lib/labels/index.ts";
import { registerDiscussionTools } from "./lib/discussions/tools.ts";
import { registerIssueTools } from "./lib/issues/tools.ts";
import { registerProjectTools } from "./lib/projects/tools.ts";
import { registerLabelTools } from "./lib/labels/tools.ts";
import { registerCoreTools } from "./lib/core/tools.ts";

export default function (pi) {
  registerDiscussionTools(pi);
  registerIssueTools(pi);
  registerProjectTools(pi);
  registerLabelTools(pi);
  registerCoreTools(pi);
}