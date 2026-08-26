import { gh, ghJson } from "./gh.mjs";

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
