import { startAdapters } from "./adapter-host.mjs";
import { CommController } from "./comm-controller.mjs";

const config = JSON.parse(process.argv[2] ?? "{}");
const controller = new CommController();
const port = await controller.start();
const stopAdapters = await startAdapters(controller, config.adapters);
process.stdout.write(`${JSON.stringify({ port })}\n`);
process.once("SIGTERM", async () => {
  await stopAdapters();
  await controller.stop();
  process.exit(0);
});
