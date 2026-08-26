import { gh } from "./gh.mjs";

function issueDbId(repo, number) {
  return Number(gh(["api", `repos/${repo}/issues/${number}`, "--jq", ".id"]));
}

// REST wants the numeric database id, not the issue number — the quirk that
// cost several retries when this was done by hand.
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
