
import { gh, ghJson } from "../core/gh.ts";

// Original issues.ts functions
export function createIssue(repo, { title, bodyFile, labels = [], milestone }) {
  const args = ["issue", "create", "-R", repo, "--title", title, "--body-file", bodyFile];
  for (const label of labels) args.push("--label", label);
  if (milestone) args.push("--milestone", milestone);
  const url = gh(args);
  return { url, number: Number(url.split("/").pop()) };
}

export function viewIssue(repo, number) {
  return ghJson([
    "issue", "view", String(number), "-R", repo,
    "--json", "number,title,body,labels,milestone,state,url",
  ]);
}

// Merged from subissues.ts
export function addSubIssue(repo, parentNumber, childNumber) {
  const subIssueId = issueDbId(repo, childNumber);
  return gh([
    "api", `repos/${repo}/issues/${parentNumber}/sub_issues`,
    "-X", "POST", "-F", `sub_issue_id=${subIssueId}`,
    "--jq", ".sub_issues_summary",
  ]);
}

export function listSubIssues(repo, parentNumber) {
  return gh([
    "api", `repos/${repo}/issues/${parentNumber}/sub_issues`,
    "--jq", ".[] | {number, title}",
  ]);
}

// Merged from dependencies.ts
export function addBlockedBy(repo, issueNumber, blockingNumber) {
  const issueId = issueDbId(repo, blockingNumber);
  return gh([
    "api", `repos/${repo}/issues/${issueNumber}/dependencies/blocked_by`,
    "-X", "POST", "-F", `issue_id=${issueId}`,
    "--jq", ".number",
  ]);
}

// Shared helper function (from dependencies.ts and subissues.ts)
function issueDbId(repo, number) {
  return Number(gh(["api", `repos/${repo}/issues/${number}`, "--jq", ".id"]));
}
