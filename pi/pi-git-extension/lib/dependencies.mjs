import { gh } from "./gh.mjs";

function issueDbId(repo, number) {
  return Number(gh(["api", `repos/${repo}/issues/${number}`, "--jq", ".id"]));
}

export function addBlockedBy(repo, issueNumber, blockingNumber) {
  const issueId = issueDbId(repo, blockingNumber);
  return gh([
    "api", `repos/${repo}/issues/${issueNumber}/dependencies/blocked_by`,
    "-X", "POST", "-F", `issue_id=${issueId}`,
    "--jq", ".number",
  ]);
}
