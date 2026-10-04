// Launch cost of N resident workers through the production path (no model calls):
// time to ready, per-class resident memory, disk per worker, teardown, residue.
//   node scripts/bench/crew-scale.mjs <none|gondolin|armory> <N>
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const { Runtime } = await import(new URL("../../.pi/extensions/hall-crew/crew-runtime/lib/runtime.mjs", import.meta.url));
const { resolveArmoryCatalog } = await import(new URL("../../.pi/extensions/hall-crew/env-runtime/lib/armory-artifacts.mjs", import.meta.url));
const [mode, n] = [process.argv[2], Number(process.argv[3])];
const cwd = fileURLToPath(new URL("../../", import.meta.url)).replace(/\/$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tree = () => {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss=,command="], { encoding: "utf8" }).trim().split("\n").map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/); return { pid: +m[1], ppid: +m[2], rss: +m[3] / 1024, cmd: m[4] }; });
  const kids = new Map(); rows.forEach((r) => kids.set(r.ppid, [...(kids.get(r.ppid) ?? []), r]));
  const out = []; const walk = (pid) => (kids.get(pid) ?? []).forEach((c) => (out.push(c), walk(c.pid))); walk(process.pid);
  const by = { qemu: 0, pi: 0, worker: 0, servers: 0, other: 0 }, count = { qemu: 0, pi: 0, worker: 0, servers: 0, other: 0 };
  for (const p of out.filter((q) => !/^ps /.test(q.cmd))) { const k = /qemu-system/.test(p.cmd) ? "qemu" : /^pi(\s|$)/.test(p.cmd) ? "pi" : /worker\.mjs/.test(p.cmd) ? "worker" : /(lifecycle|comm)-server/.test(p.cmd) ? "servers" : "other"; by[k] += p.rss; count[k]++; }
  if (process.env.BENCH_DEBUG) out.forEach((p) => console.error(Math.round(p.rss) + "MB", p.cmd.slice(0, 150)));
  return { byMB: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, Math.round(v)])), count, totalMB: Math.round(out.reduce((s, p) => s + p.rss, 0)), procs: out.length };
};
const du = (path) => { try { return Number(execFileSync("du", ["-sk", path], { encoding: "utf8" }).split("\t")[0]) / 1024; } catch { return 0; } };
const runId = randomUUID(), namespace = `crew-${runId}`;
const release = mode === "armory" ? (await resolveArmoryCatalog()).release : undefined;
const handles = Array.from({ length: n }, (_, i) => `developer-bench${i + 1}-00`);
const agents = handles.map((handle) => ({
  name: handle, actorId: `${namespace}-${handle}`, role: "developer", task: "bench", resident: true, initialTurn: "first-delivery",
  namespace, crewMembers: handles, tools: ["read"], commTools: ["comm_notify", "comm_request", "comm_reply"],
  ...(mode !== "none" ? { sandbox: { kind: "gondolin" } } : {}),
  ...(mode === "armory" ? { armory: { catalog: { release }, requests: [{ suite: "collaboration/pi-github-tools", tools: ["github_issue_view"] }] } } : {}),
}));
const rt = new Runtime(cwd);
const before = tree();
const t0 = performance.now();
await rt.launchCrew(agents, [], { namespace, members: handles.map((handle) => ({ handle, dependsOn: [], task: "bench" })) }, { readyTimeoutMs: 120_000 });
const readyMs = Math.round(performance.now() - t0);
await sleep(4000);
const idle = tree();
const worktreeMB = handles.reduce((s, h) => s + du(`${cwd}/.pi/runtime/runs/${namespace}-${h}`), 0);
const t1 = performance.now();
await rt.stop();
const stopMs = Math.round(performance.now() - t1);
await sleep(1500);
const after = tree();
console.log(JSON.stringify({ mode, n, ready_ms: readyMs, ready_per_worker_ms: Math.round(readyMs / n), idle, diskPerWorkerMB: Math.round(worktreeMB / n), stop_ms: stopMs, residual_procs: after.procs, residual_qemu: after.count.qemu }));
