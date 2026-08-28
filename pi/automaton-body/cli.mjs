#!/usr/bin/env node
import { createRobot, baseModule, soulModule, roleModule } from "./lib/index.mjs";

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
  console.error("       Optional: --model <model> --thinking <low|medium|high>");
  process.exit(1);
}

try {
  const override = {};
  if (f.model) override.model = f.model;
  if (f.thinking) override.thinking = f.thinking;

  const body = createRobot()
    .install(baseModule, {})
    .install(soulModule, { name: f.name })
    .install(roleModule, { name: f.name, role: f.role, task: f.task, override })
    .build();

  console.log(JSON.stringify(body));
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
