import { gh, ghJson } from "../core/gh.ts";
import * as labels from "../labels/index.ts";

export function listPullRequests(repo: string, state = "open", limit = 30) {
  return ghJson([
    "pr", "list", "-R", repo, "--state", state, "--limit", String(limit),
    "--json", "number,title,state,isDraft,author,headRefName,baseRefName,url",
  ]) ?? [];
}

export function viewPullRequest(repo: string, number: number) {
  return ghJson([
    "pr", "view", String(number), "-R", repo,
    "--json", "number,title,body,state,isDraft,author,headRefName,baseRefName,labels,reviews,statusCheckRollup,url",
  ]);
}

export function commentOnPullRequest(repo: string, number: number, body: string) {
  gh(["pr", "comment", String(number), "-R", repo, "--body", body]);
  return { repo, pullNumber: number, commented: true };
}

export function updatePullRequest(repo: string, number: number, { title, body, base, state }: { title?: string; body?: string; base?: string; state?: string }) {
  const args = ["pr", "edit", String(number), "-R", repo];
  if (title) args.push("--title", title);
  if (body) args.push("--body", body);
  if (base) args.push("--base", base);
  gh(args);
  if (state === "closed") gh(["pr", "close", String(number), "-R", repo]);
  if (state === "open") gh(["pr", "reopen", String(number), "-R", repo]);
  return viewPullRequest(repo, number);
}

export function reviewPullRequest(repo: string, number: number, event: "approve" | "request-changes", body?: string) {
  const args = ["pr", "review", String(number), "-R", repo, event === "approve" ? "--approve" : "--request-changes"];
  if (body) args.push("--body", body);
  gh(args);
  return { repo, pullNumber: number, review: event, reviewed: true };
}

export function mergePullRequest(repo: string, number: number, method = "squash") {
  gh(["pr", "merge", String(number), "-R", repo, `--${method}`, "--delete-branch"]);
  return viewPullRequest(repo, number);
}

export function addPullRequestLabels(repo: string, number: number, names: string[]) {
  return labels.addLabels(repo, number, names);
}

export function removePullRequestLabel(repo: string, number: number, name: string) {
  return labels.removeLabel(repo, number, name);
}
