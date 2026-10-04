// Gondolin VM costs: boot, exec, concurrent boots, and the Armory path (mounted closure).
// Needs a rooted Armory closure (launch one Crew first) and QEMU.
//   node scripts/bench/gondolin-vm.mjs
import { execFileSync } from "node:child_process";
import { readlinkSync, mkdtempSync, writeFileSync } from "node:fs";
const { VM, RealFSProvider } = await import(new URL("../../node_modules/@earendil-works/gondolin/dist/src/index.js", import.meta.url));
const { createGondolinNixLayer } = await import(new URL("../../.pi/extensions/hall-crew/env-runtime/lib/gondolin-nix-layer.mjs", import.meta.url));
const ms = (t) => Math.round(performance.now() - t);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const qemuMB = () => Math.round(execFileSync("ps", ["-axo", "rss=,command="], { encoding: "utf8" }).split("\n").filter((l) => /qemu-system/.test(l)).reduce((s, l) => s + Number(l.trim().split(/\s+/)[0]) / 1024, 0));
const nix = "/nix/var/nix/profiles/default/bin/nix";

console.log("== concurrent boots (no mounts): wall ms to first exec, qemu RSS total");
for (const n of [1, 2, 4]) {
  const t = performance.now();
  const vms = await Promise.all(Array.from({ length: n }, async () => { const vm = await VM.create(); const s = performance.now(); await vm.exec(["true"]); return { vm, boot: ms(s) }; }));
  const wall = ms(t); const rss = qemuMB();
  console.log(`N=${n}: wall ${wall} ms, per-VM boot ${vms.map((v) => v.boot).join("/")} ms, qemu RSS total ${rss} MB (${Math.round(rss / n)}/VM)`);
  const c = performance.now(); await Promise.all(vms.map((v) => v.vm.close())); console.log(`      close ${ms(c)} ms, qemu left: ${qemuMB() > 0 ? "yes" : "none"}`);
}

console.log("== armory path (workspace + filtered closure mount)");
const root = readlinkSync(process.env.HOME + "/.cache/hall/armory/roots/collaboration_pi-github-tools-aarch64-linux");
const paths = execFileSync(nix, ["path-info", "-r", root], { encoding: "utf8" }).trim().split("\n");
const work = mkdtempSync("/tmp/bench-work-"); writeFileSync(work + "/in.json", JSON.stringify({ operations: ["github_issue_view"] }));
let t = performance.now();
const vm = await VM.create({ vfs: { mounts: { ...createGondolinNixLayer(paths), "/work": new RealFSProvider(work) } } });
const ghPath = paths.find((p) => /-gh-/.test(p));  // the closure rooted by a previous launch
await vm.exec(["true"]); console.log("first exec (boot with mounts):", ms(t), "ms");
const time = async (cmd, k = 5) => { const a = []; for (let i = 0; i < k; i++) { const s = performance.now(); const r = await vm.exec(["sh", "-c", cmd]); a.push(ms(s)); if (r.exitCode) throw new Error(String(r.stderr)); } return median(a); };
console.log("node -e 1 in guest:", await time("node -e 1"), "ms");
console.log("gh --version (closure, VFS read):", await time(`${ghPath}/bin/gh --version`), "ms");
{
  const s = performance.now();
  await vm.exec(["sh", "-c", `mkdir -p /tmp/hall-bin && cp ${ghPath}/bin/gh /tmp/hall-bin/gh`]);
  console.log("one-time copy of gh into guest tmpfs:", ms(s), "ms");
  console.log("gh --version (guest-local copy):", await time("/tmp/hall-bin/gh --version"), "ms");
}
console.log("armory-suite describe:", await time(`cd /tmp && ${root}/bin/armory-suite describe /work/in.json /work/out.json`), "ms");
console.log("qemu RSS with mounts after use:", qemuMB(), "MB");
await vm.close();
