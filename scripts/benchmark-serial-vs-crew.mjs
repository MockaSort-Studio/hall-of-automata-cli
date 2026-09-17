import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Runtime } from "../.pi/extensions/runtime/lib/runtime.mjs";
import { prepareCrew } from "../.pi/extensions/crew/lib/startup.mjs";

const root = process.cwd(),
  rounds = Number(process.argv[2] ?? 1),
  out = join(root, ".pi/runtime/benchmark");
const requests = [
  "Inspect comm-controller.mjs and comm-client.mjs: return two file-backed invariants and one risk with mitigation.",
  "Inspect lifecycle-controller.mjs and lifecycle-client.mjs: return two file-backed invariants and one risk with mitigation.",
  "Inspect worker.mjs and runtime.mjs: return one file-backed invariant and one risk with mitigation.",
];
const task = `Complete these requests:\n${requests.map((request, index) => `${index + 1}. ${request}`).join("\n")}\n\nReturn exactly: ## Invariants (five file-backed facts), ## Risks (three concrete risks with mitigation), ## Recommendation (one ranked next change). Do not edit files.`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const events = async (id) =>
  readFile(join(root, ".pi/runtime/runs", id, "events.jsonl"), "utf8")
    .then((x) => x.trim().split("\n").filter(Boolean).map(JSON.parse))
    .catch(() => []);
const summary = (groups) => {
  const workers = groups.map((xs) => {
    const starts = xs.filter((x) => x.type === "agent_start"),
      turns = xs.filter((x) => x.type === "turn"),
      tools = xs.filter((x) => x.type === "tool_start"),
      results = xs.filter((x) => x.type === "tool_end");
    const usage = turns.reduce(
      (sum, turn) => {
        for (const key of ["input", "output", "reasoning", "cacheRead", "cacheWrite", "totalTokens"])
          sum[key] += turn.usage?.[key] ?? 0;
        sum.cost += turn.usage?.cost?.total ?? 0;
        return sum;
      },
      { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: 0 },
    );
    const systemTokens = starts.reduce((n, e) => n + (e.systemTokens ?? 0), 0);
    const toolSchemaTokens = starts.reduce((n, e) => n + (e.toolSchemaTokens ?? 0), 0);
    const contextBefore = systemTokens + toolSchemaTokens;
    const contextAfter = turns.at(-1)?.context?.tokens ?? contextBefore;
    return {
      report: turns.at(-1)?.output ?? "",
      usage,
      contextBefore,
      contextAfter,
      contextBloat: contextAfter - contextBefore,
      contextTokens: Math.max(contextBefore, ...turns.map((turn) => turn.context?.tokens ?? 0)),
      systemTokens,
      toolSchemaTokens,
      toolCalls: tools.length,
      toolCallTokens: tools.reduce((n, e) => n + (e.callTokens ?? 0), 0),
      toolResultTokens: results.reduce((n, e) => n + (e.resultTokens ?? 0), 0),
    };
  });
  const total = workers.reduce(
    (sum, worker) => {
      for (const key of [
        "input",
        "output",
        "reasoning",
        "cacheRead",
        "cacheWrite",
        "totalTokens",
        "cost",
        "systemTokens",
        "toolSchemaTokens",
        "toolCalls",
        "toolCallTokens",
        "toolResultTokens",
      ])
        sum[key] += worker.usage[key] ?? worker[key] ?? 0;
      sum.contextBefore += worker.contextBefore;
      sum.contextAfter += worker.contextAfter;
      sum.contextBloat += worker.contextBloat;
      sum.contextTokens = Math.max(sum.contextTokens, worker.contextTokens);
      return sum;
    },
    {
      input: 0,
      output: 0,
      reasoning: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: 0,
      systemTokens: 0,
      toolSchemaTokens: 0,
      toolCalls: 0,
      toolCallTokens: 0,
      toolResultTokens: 0,
      contextBefore: 0,
      contextAfter: 0,
      contextBloat: 0,
      contextTokens: 0,
    },
  );
  return { workers, total, report: workers.at(-1)?.report ?? "" };
};
const valid = (report) => ["## Invariants", "## Risks", "## Recommendation"].every((x) => report.includes(x));
async function serial(i) {
  const runtime = new Runtime(root),
    id = `benchmark-serial-${i}-${crypto.randomUUID()}`,
    at = Date.now();
  try {
    const agent = await runtime.spawn({ name: id, actorId: id, task, resident: false, initialTurn: "startup" });
    for (let n = 0; n < 90; n++) {
      await sleep(1000);
      const xs = await events(agent.id);
      if (xs.some((x) => x.type === "agent_end" || x.type === "agent_error"))
        return { variant: "serial", elapsedMs: Date.now() - at, ...summary([xs]), valid: valid(summary([xs]).report) };
    }
    throw Error("serial timeout");
  } finally {
    await runtime.stop();
  }
}
async function crew(i) {
  const runtime = new Runtime(root),
    at = Date.now();
  const pi = { getAllTools: () => [] };
  const prepared = await prepareCrew(
    pi,
    {
      task: `${task}\nLead: collect specialist replies then comm_notify Main with the exact final report.`,
      members: [
        { name: "hamlet", role: "advisor" },
        { name: "hamlet", role: "advisor" },
        { name: "hamlet", role: "advisor" },
      ],
      thinking: "off",
    },
    { cwd: root },
    ".pi",
  );
  prepared.agents.forEach((agent) => {
    agent.thinking = "off";
  });
  prepared.agents.slice(0, -1).forEach((agent, index) => {
    agent.task += `\n\nBENCHMARK SPECIALIST REQUEST:\n${requests[index]}\nReply to the Lead with file-backed evidence.`;
  });
  try {
    const launched = await runtime.launchCrew(prepared.agents);
    let report = "";
    for (let n = 0; n < 90; n++) {
      await sleep(1000);
      const message = await runtime.receive();
      if (message?.payload) {
        report = typeof message.payload === "string" ? message.payload : JSON.stringify(message.payload);
        break;
      }
    }
    const groups = await Promise.all(launched.agents.map((a) => events(a.id)));
    const xs = groups.flat();
    return {
      variant: "crew",
      elapsedMs: Date.now() - at,
      ...summary(groups),
      commEvents: xs.filter((x) => x.type === "tool_end" && x.name?.startsWith("comm_")).length,
      report,
      valid: valid(report),
    };
  } finally {
    await runtime.stop();
  }
}
await mkdir(out, { recursive: true });
const results = [];
for (let i = 1; i <= rounds; i++) {
  results.push(await serial(i), await crew(i));
}
await writeFile(join(out, "serial-vs-crew.json"), JSON.stringify({ task, results }, null, 2));
console.log(JSON.stringify({ results }, null, 2));
