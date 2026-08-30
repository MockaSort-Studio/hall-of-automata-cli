import { gh, ghJson } from "../core/gh.ts";

export function listLabels(repo: string) {
  return ghJson([
    "label", "list", "-R", repo,
    "--json", "name,color,description",
  ]);
}

export function createLabel(repo: string, name: string, color: string, description?: string) {
  const args = ["label", "create", name, "-R", repo, "--color", color, "--force"];
  if (description) args.push("--description", description);
  gh(args);
  return { repo, name, color, description: description ?? "" };
}

export function updateLabel(repo: string, name: string, color?: string, description?: string) {
  const args = ["label", "edit", name, "-R", repo];
  if (color) args.push("--color", color);
  if (description !== undefined) args.push("--description", description);
  gh(args);
  return { repo, name, color, description };
}

export function addLabels(repo: string, issueNumber: number, labels: string[]) {
  gh([
    "issue", "edit", String(issueNumber), "-R", repo,
    "--add-label", labels.join(","),
  ]);
  return ghJson([
    "issue", "view", String(issueNumber), "-R", repo,
    "--json", "number,title,labels,url",
  ]);
}
