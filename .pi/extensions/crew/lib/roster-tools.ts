import { CONFIG_DIR_NAME, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { Type } from "typebox";
import {
  beginClose,
  finishClose,
  readRoster,
  registerMembers,
  unregisterMembers,
  writeRoster,
} from "./comm.mjs";

const pathFor = (cwd, runId) =>
  join(cwd, CONFIG_DIR_NAME, "fabric", "crew-launch", `${runId}-roster.json`);
const result = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });
const member = Type.Object({ name: Type.String(), actorId: Type.String(), role: Type.String() });

function mutate(input, ctx, change) {
  const path = pathFor(ctx.cwd, input.runId);
  return withFileMutationQueue(path, async () => {
    const roster = change(readRoster(path));
    writeRoster(path, roster);
    return result(roster);
  });
}

export function registerRosterTools(pi) {
  pi.registerTool({
    name: "crew_register", label: "Crew: register members",
    description: "Atomically register specialist actors.",
    parameters: Type.Object({ runId: Type.String(), from: Type.String(), members: Type.Array(member, { minItems: 1 }) }),
    async execute(_id, input, _signal, _update, ctx) {
      return mutate(input, ctx, roster => registerMembers(roster, input.from, input.members));
    },
  });
  pi.registerTool({
    name: "crew_unregister", label: "Crew: unregister removed members",
    description: "Remove roster records after verified agents.remove.",
    parameters: Type.Object({ runId: Type.String(), from: Type.String(), actorIds: Type.Array(Type.String(), { minItems: 1 }) }),
    async execute(_id, input, _signal, _update, ctx) {
      return mutate(input, ctx, roster => unregisterMembers(roster, input.from, input.actorIds));
    },
  });
  pi.registerTool({
    name: "crew_begin_close", label: "Crew: begin verified close",
    description: "Record GitHub-confirmed closure before disband.",
    parameters: Type.Object({ runId: Type.String(), from: Type.String(), closedAt: Type.String() }),
    async execute(_id, input, _signal, _update, ctx) {
      return mutate(input, ctx, roster => beginClose(roster, input.from, input.closedAt));
    },
  });
  pi.registerTool({
    name: "crew_finish_close", label: "Crew: finish close",
    description: "Mark terminal only after all specialists are unregistered.",
    parameters: Type.Object({ runId: Type.String(), from: Type.String() }),
    async execute(_id, input, _signal, _update, ctx) {
      return mutate(input, ctx, roster => finishClose(roster, input.from));
    },
  });
}
