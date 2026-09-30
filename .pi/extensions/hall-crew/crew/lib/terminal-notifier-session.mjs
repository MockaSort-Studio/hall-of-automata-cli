// Binds the read-only Runtime terminal notifier to one Pi session.
export function registerTerminalNotifierSession(pi, runtimeFor) {
  let detach;
  const attach = (ctx) => {
    detach?.();
    detach = runtimeFor(ctx.cwd).attachTerminalNotifier((message, options) => pi.sendMessage(message, options));
  };
  pi.on("session_start", (_event, ctx) => attach(ctx));
  pi.on("session_shutdown", () => {
    detach?.();
    detach = undefined;
  });
  return attach;
}
