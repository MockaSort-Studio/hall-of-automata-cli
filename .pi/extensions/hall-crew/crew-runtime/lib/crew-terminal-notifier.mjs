// Read-only typed-state completion notifier. It never infers lifecycle from
// prose, worker settlement, or process state; callers provide Comm snapshots.
const TERMINAL = new Set(["complete", "blocked", "failed"]);

// Follow-up turns raised by a terminal notification may immediately dispatch a
// replacement Crew, so retain the same launch/kickoff contract as user input.
export const dispatchProtocol = `\n\n## CREW DISPATCH PROTOCOL\nIf dispatching a Crew: use only \`start_crew\`; its successful launch broadcasts one non-turn-triggering \`kind: "kickoff"\` manifest to registered Crew recipients. It does not assign specialist work; use Main dispatch controls for directed tasks. Do not send a second kickoff.`;

function nodesOf(snapshot) {
  return Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
}

function terminal(snapshot) {
  const nodes = nodesOf(snapshot);
  return nodes.length > 0 && nodes.every((node) => TERMINAL.has(node?.status));
}

function terminalMessage(namespace, nodes) {
  const counts = Object.fromEntries(
    [...TERMINAL].map((status) => [status, nodes.filter((node) => node.status === status).length]),
  );
  const summary = Object.entries(counts)
    .filter(([, count]) => count)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");
  return {
    customType: "crew-terminal",
    content: `Crew ${namespace} reached terminal lifecycle state (${summary}).${dispatchProtocol}`,
    display: true,
    details: { namespace, counts },
  };
}

export function createCrewTerminalNotifier(sendMessage) {
  if (typeof sendMessage !== "function") throw new TypeError("sendMessage must be a function");
  const runs = new Map();

  function observe(snapshot) {
    const namespace = snapshot?.namespace;
    if (!namespace || !nodesOf(snapshot).length) return false;
    let run = runs.get(namespace);
    if (!run) {
      run = { seenSnapshot: true, notified: false };
      runs.set(namespace, run);
    }
    if (run.notified || !terminal(snapshot)) return false;
    run.notified = true;
    Promise.resolve(
      sendMessage(terminalMessage(namespace, nodesOf(snapshot)), { triggerTurn: true, deliverAs: "followUp" }),
    ).catch(() => {});
    return true;
  }

  return { observe };
}
