import { CommController } from "./comm-controller.mjs";

const controller = new CommController();
const port = await controller.start(Number(process.argv[2] ?? 0));
process.stdout.write(`${JSON.stringify({ port })}\n`);
process.once("SIGTERM", async () => {
  await controller.stop();
  process.exit(0);
});
