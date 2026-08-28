#!/usr/bin/env node
import { installRole } from "./lib/resolve.mjs";

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
if (!f.name || !f.role || !f.task) {
  console.error("Usage: node cli.mjs --name <specialist> --role <advisor|researcher|architect|lead> --task \"...\"");
  console.error("       Optional: --model <model-name> --thinking <low|medium|high>");
  process.exit(1);
}

try {
  const override = {};
  if (f.model) override.model = f.model;
  if (f.thinking) override.thinking = f.thinking;

  const result = installRole(f.name, f.role, f.task, Object.keys(override).length ? override : undefined);
  console.log(JSON.stringify(result));
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
