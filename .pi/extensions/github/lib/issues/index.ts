
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


export function listIssues(repo: string, state = "open", labels?: string[], milestone?: string, limit = 30) {
  const args = ["issue", "list", "-R", repo, "--state", state, "--limit", String(limit), "--json", "number,title,labels,milestone,state,url,assignees"];
  if (labels?.length) args.push("--label", labels.join(","));
  if (milestone) args.push("--milestone", milestone);
  return ghJson(args) ?? [];
}

export function listDependencies(repo: string, issueNumber: number) {
  return ghJson(["api", `repos/${repo}/issues/${issueNumber}/dependencies/blocked_by`]) ?? [];
}

export function commentOnIssue(repo: string, issueNumber: number, body: string) {
  const args = ["issue", "comment", String(issueNumber), "-R", repo, "--body", body];
  gh(args);
  return { repo, issueNumber, commented: true };
}

export function updateIssue(repo: string, issueNumber: number, { title, body, milestone, state }: { title?: string; body?: string; milestone?: string; state?: string }) {
  const args = ["issue", "edit", String(issueNumber), "-R", repo];
  if (title) args.push("--title", title);
  if (body) args.push("--body", body);
  if (milestone) args.push("--milestone", milestone);
  if (state === "closed") args.push("--state", "closed");
  if (state === "open") args.push("--state", "open");
  gh(args);
  return ghJson(["issue", "view", String(issueNumber), "-R", repo, "--json", "number,title,state,milestone,url"]);
}

// Shared helper function (from dependencies.ts and subissues.ts)
function issueDbId(repo, number) {
  return Number(gh(["api", `repos/${repo}/issues/${number}`, "--jq", ".id"]));
}
