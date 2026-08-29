#!/usr/bin/env node

import { ask_support, tell_information } from "./lib/automaton/communication.mjs";
import { createRobot } from "./lib/automaton/robot.mjs";

function parseFlags(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith("--")) continue;
    const arg = argv[i].slice(2);
    const eqIndex = arg.indexOf('=');
    let key, value;
    if (eqIndex > 0) {
      key = arg.slice(0, eqIndex);
      value = arg.slice(eqIndex + 1);
    } else {
      key = arg;
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        value = next;
        i++;
      } else {
        value = true;
      }
    }
    out[key] = out[key] ? [...(Array.isArray(out[key]) ? out[key] : [out[key]]), value] : value;
  }
  return out;
}

function toList(v) {
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}

const [mode, action, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

async function main() {
  if (mode === "specialist") {
    if (action === "ask-support") {
      const result = await ask_support(flags.agent, flags.question);
      return result;
    }
    if (action === "tell-info") {
      const result = await tell_information(flags.agent, flags.info);
      return result;
    }
    throw new Error("Unknown specialist action: " + action);
  }

  if (mode === "crew") {
    if (action === "create") {
      const robot = createRobot({
        id: flags.id || "crew-lead",
        name: flags.name || "Crew Leader",
        role: flags.role || "lead",
      });
      return { id: robot.id, name: robot.name, role: robot.role };
    }
    throw new Error("Unknown crew action: " + action);
  }

  console.log(`
Pi Automata Crew CLI

Usage:
  node cli.mjs specialist <action> [flags]
  node cli.mjs crew <action> [flags]

Specialist Actions:
  ask-support    --agent=<id> --question=<text>  Ask support question
  tell-info      --agent=<id> --info=<text>      Share information

Crew Actions:
  create         --id=<id> --name=<name> --role=<role>  Create a crew robot

Examples:
  node cli.mjs specialist ask-support --agent=automaton-1 --question="How do I...?"
  node cli.mjs crew create --id=lead-1 --name="Lead Bot" --role=lead`);
  process.exit(0);
}

main()
  .then((result) => {
    if (result !== undefined) console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });