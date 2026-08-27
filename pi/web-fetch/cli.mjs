#!/usr/bin/env node
import { webFetch } from "./lib.mjs";

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
if (!f.url) {
  console.error("Usage: node cli.mjs --url <url> [--max-chars N]");
  process.exit(1);
}

webFetch(f.url, f["max-chars"] ? Number(f["max-chars"]) : undefined)
  .then((result) => console.log(JSON.stringify(result, null, 2)))
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
