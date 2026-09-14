import { Type } from "typebox";
import * as issues from "./index.ts";

const S = Type.String;
const I = Type.Integer;
const O = Type.Optional;
const obj = (properties) => Type.Object(properties);

export function registerIssueTools(pi) {
  const output = (value) => ({
    content: [{ type: "text", text: JSON.stringify(value) }], details: value,
  });

  const tool = (name, description, parameters, execute) => pi.registerTool({
    name, label: name.replaceAll("_", " "), description, parameters,
    async execute(_id, input) { return output(await execute(input)); },
  });

  tool("github_issue_create", "Create an Issue.",
    obj({ repo:S(), title:S(), bodyFile:S(), labels:O(Type.Array(S())), milestone:O(S()) }),
    x => issues.createIssue(x.repo,x));
  
  tool("github_issue_view", "Read an Issue.",
    obj({ repo:S(), issueNumber:I() }),
    x => issues.viewIssue(x.repo,x.issueNumber));
  
  tool("github_subissue_add", "Attach a child Issue to a parent.",
    obj({ repo:S(), parentNumber:I(), childNumber:I() }),
    x => issues.addSubIssue(x.repo,x.parentNumber,x.childNumber));
  
  tool("github_subissues_list", "List a parent Issue's children.",
    obj({ repo:S(), parentNumber:I() }),
    x => issues.listSubIssues(x.repo,x.parentNumber));
  
  tool("github_dependency_add", "Mark an Issue as blocked by another Issue.",
    obj({ repo:S(), issueNumber:I(), blockingNumber:I() }),
    x => issues.addBlockedBy(x.repo,x.issueNumber,x.blockingNumber));
  
  tool("github_issues_list", "List repository Issues, optionally filtered by state, labels, or milestone.",
    obj({ repo:S(), state:O(S()), labels:O(Type.Array(S())), milestone:O(S()), limit:O(I()) }),
    x => issues.listIssues(x.repo,x.state,x.labels,x.milestone,x.limit));
  
  tool("github_dependency_list", "Read open blockers for an Issue (GET blocked_by).",
    obj({ repo:S(), issueNumber:I() }),
    x => issues.listDependencies(x.repo,x.issueNumber));
  
  tool("github_issue_comment", "Post a status comment on an Issue.",
    obj({ repo:S(), issueNumber:I(), body:S() }),
    x => issues.commentOnIssue(x.repo,x.issueNumber,x.body));
  
  tool("github_issue_update", "Edit Issue fields: title, body, milestone, or state.",
    obj({ repo:S(), issueNumber:I(), title:O(S()), body:O(S()), milestone:O(S()), state:O(S()) }),
    x => issues.updateIssue(x.repo,x.issueNumber,x));
}