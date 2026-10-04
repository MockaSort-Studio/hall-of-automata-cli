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
// Memory is reported as the OS physical footprint (dirty + compressed), which is what
// pressures RAM. RSS also counts reclaimable file-backed pages and overstated a QEMU VM
// by about 2x, so it is shown only for reference.
const footprintMB = (pid) => {
  try {
    const m = execFileSync("footprint", ["-p", String(pid)], { encoding: "utf8" }).match(/Footprint: (\d+(?:\.\d+)?) (KB|MB|GB)/);
    return m ? Number(m[1]) * { KB: 1 / 1024, MB: 1, GB: 1024 }[m[2]] : 0;
  } catch {
    return 0;
  }
};
const tree = () => {
  const rows = execFileSync("ps", ["-axo", "pid=,ppid=,rss=,command="], { encoding: "utf8" }).trim().split("\n").map((l) => { const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/); return { pid: +m[1], ppid: +m[2], rss: +m[3] / 1024, cmd: m[4] }; });
  const kids = new Map(); rows.forEach((r) => kids.set(r.ppid, [...(kids.get(r.ppid) ?? []), r]));
  const out = []; const walk = (pid) => (kids.get(pid) ?? []).forEach((c) => (out.push(c), walk(c.pid))); walk(process.pid);
  const kind = (cmd) => (/qemu-system|gondolin-krun-runner/.test(cmd) ? "vm" : /^pi(\s|$)/.test(cmd) ? "pi" : /worker\.mjs/.test(cmd) && !/lifecycle-server/.test(cmd) ? "worker" : /(lifecycle|comm)-server/.test(cmd) ? "servers" : "other");
  const fp = { vm: 0, pi: 0, worker: 0, servers: 0, other: 0 }, count = { vm: 0, pi: 0, worker: 0, servers: 0, other: 0 };
  let rss = 0;
  for (const p of out.filter((q) => !/^ps |footprint/.test(q.cmd))) { const k = kind(p.cmd); fp[k] += footprintMB(p.pid); count[k]++; rss += p.rss; }
  return { footprintMB: Object.fromEntries(Object.entries(fp).map(([k, v]) => [k, Math.round(v)])), count, totalFootprintMB: Math.round(Object.values(fp).reduce((a, b) => a + b, 0)), totalRssMB: Math.round(rss) };
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
// Workers that hold a VM while idle should give it back; sample again after the release window.
const idleAfterRelease = mode === "armory" ? (await sleep(26_000), tree()) : undefined;
const worktreeMB = handles.reduce((s, h) => s + du(`${cwd}/.pi/runtime/runs/${namespace}-${h}`), 0);
const t1 = performance.now();
await rt.stop();
const stopMs = Math.round(performance.now() - t1);
await sleep(1500);
const after = tree();
console.log(JSON.stringify({ mode, n, ready_ms: readyMs, ready_per_worker_ms: Math.round(readyMs / n), idle, idleAfterRelease: idleAfterRelease && { totalFootprintMB: idleAfterRelease.totalFootprintMB, vms: idleAfterRelease.count.vm }, diskPerWorkerMB: Math.round(worktreeMB / n), stop_ms: stopMs, residual_vms: after.count.vm }));
