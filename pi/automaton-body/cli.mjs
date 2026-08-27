#!/usr/bin/env node
import { resolveSpecialist } from "./lib/resolve.mjs";

function flags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next !== undefined && !next.startsWith("--") ? (i++, next) : true;
  }
  return out;
}

const f = flags(process.argv.slice(2));
if (!f.name || !f.mode || !f.task) {
  console.error("Usage: node cli.mjs --name <specialist> --mode <advising|researching> --task \"...\"");
  process.exit(1);
}

try {
  const result = resolveSpecialist(f.name, f.mode, f.task);
  console.log(JSON.stringify(result));
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
