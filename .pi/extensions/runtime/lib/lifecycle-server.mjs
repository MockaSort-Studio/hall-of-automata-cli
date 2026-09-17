import { WebSocketServer } from "ws";
import { LifecycleController } from "./lifecycle-controller.mjs";
const controller = new LifecycleController(JSON.parse(process.argv[2]));
const server = new WebSocketServer({ port: 0 });
await new Promise((resolve) => server.once("listening", resolve));
const methods = {
  "lifecycle.spawn": (p) => controller.spawn(p),
  "lifecycle.list": () => controller.list(),
  "lifecycle.inspect": (p) => controller.inspect(p.id),
  "lifecycle.remove": (p) => controller.remove(p.id),
  "lifecycle.shutdown": () => controller.shutdown(),
};
server.on("connection", (socket) =>
  socket.on("message", async (raw) => {
    let request;
    try {
      request = JSON.parse(String(raw));
      if (!request || typeof request.method !== "string") throw Error("Invalid request");
      const fn = methods[request.method];
      if (!fn) throw Error(`Unknown Lifecycle method: ${request.method}`);
      const result = await fn(request.params ?? {});
      if (request.id !== undefined && socket.readyState === socket.OPEN)
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }));
    } catch (error) {
      if (request?.id !== undefined && socket.readyState === socket.OPEN)
        socket.send(JSON.stringify({ jsonrpc: "2.0", id: request.id, error: { message: String(error) } }));
    }
  }),
);
process.stdout.write(`${JSON.stringify({ port: server.address().port })}\n`);
process.once("SIGTERM", async () => {
  await controller.shutdown();
  server.close(() => process.exit(0));
});
