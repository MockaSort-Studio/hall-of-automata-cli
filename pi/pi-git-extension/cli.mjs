#!/usr/bin/env node
import { createIssue, viewIssue } from "./lib/issues.mjs";
import { addSubIssue, listSubIssues } from "./lib/subissues.mjs";
import { addBlockedBy } from "./lib/dependencies.mjs";
import { addItem, findItemId, setField } from "./lib/project.mjs";
import { commentOnDiscussion } from "./lib/discussions.mjs";

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      out[key] = out[key] ? [...(Array.isArray(out[key]) ? out[key] : [out[key]]), next] : next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function toList(v) { return v === undefined ? [] : Array.isArray(v) ? v : [v]; }

const [group, action, ...rest] = process.argv.slice(2);
const f = flags(rest);

async function main() {
  if (group === "issue" && action === "create") {
    return createIssue(f.repo, { title: f.title, bodyFile: f["body-file"], labels: toList(f.label), milestone: f.milestone });
  }
  if (group === "issue" && action === "view") return viewIssue(f.repo, Number(f.number));
  if (group === "subissue" && action === "add") return addSubIssue(f.repo, Number(f.parent), Number(f.child));
  if (group === "subissue" && action === "list") return listSubIssues(f.repo, Number(f.parent));
  if (group === "dep" && action === "add") return addBlockedBy(f.repo, Number(f.issue), Number(f["blocked-by"]));
  if (group === "project" && action === "add-item") return addItem(f.org, Number(f.project), f.url);
  if (group === "project" && action === "item-id") return findItemId(f.org, Number(f.project), Number(f.number));
  if (group === "project" && action === "set-field") {
    return setField(f.org, Number(f.project), f.item, f.field, f.value);
  }
  if (group === "discussion" && action === "comment") return commentOnDiscussion(f.owner, f.repo, Number(f.number), f.body);
  throw new Error(`Unknown command: ${group} ${action}`);
}

main()
  .then((result) => {
    if (result !== undefined) console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
