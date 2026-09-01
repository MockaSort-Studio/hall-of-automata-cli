import { Type } from "typebox";
import {
  createKickoff,
  postComment,
  readRoster,
  resolveRecipient,
  signedBody,
  writeRoster,
} from "./comm.mjs";
import { renderKickoff } from "./discussion-templates.mjs";

const result = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });
const rosterPath = (cwd, runId) => `${cwd}/.pi/fabric/crew-launch/${runId}-roster.json`;
const sender = {
  from: Type.String(),
  signature: Type.String({ description: "Completed funny signature from your persona" }),
};
const kickoffMember = Type.Object({
  name: Type.String({ description: "Canonical role-persona handle, without @" }),
  assignment: Type.String(),
  dependsOn: Type.Optional(Type.Array(Type.String())),
});
const reference = Type.Object({ label: Type.String(), url: Type.String() });

export function registerCommunicationTools(pi) {
  pi.registerTool({
    name: "crew_kickoff",
    label: "Crew: create kickoff",
    description: "Create one canonical Discussion from structured objective, criteria, crew, and references.",
    parameters: Type.Object({
      runId: Type.String(),
      title: Type.String(),
      objective: Type.String(),
      acceptanceCriteria: Type.Array(Type.String(), { minItems: 1 }),
      crew: Type.Array(kickoffMember, { minItems: 1 }),
      references: Type.Optional(Type.Array(reference)),
      openQuestions: Type.Optional(Type.Array(Type.String())),
      category: Type.Optional(Type.String()),
      ...sender,
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const path = rosterPath(ctx.cwd, input.runId);
      const roster = readRoster(path);
      if (roster.discussionNumber) throw new Error(`Crew ${input.runId} already has a Discussion`);
      const body = signedBody(roster, input.from, renderKickoff(roster, input), input.signature);
      const discussion = createKickoff(roster, input.title, body, input.category);
      writeRoster(path, { ...roster, discussionNumber: discussion.number, discussionUrl: discussion.url });
      return result({ discussionNumber: discussion.number, discussionUrl: discussion.url });
    },
  });

  pi.registerTool({
    name: "crew_post",
    label: "Crew: post finding",
    description: "Post a signed substantive finding or review.",
    parameters: Type.Object({ runId: Type.String(), message: Type.String(), ...sender }),
    async execute(_id, input, _signal, _update, ctx) {
      const roster = readRoster(rosterPath(ctx.cwd, input.runId));
      return result({ commentUrl: postComment(roster, signedBody(roster, input.from, input.message, input.signature)).url });
    },
  });

  for (const [name, field, prefix] of [["crew_tell", "message", ""], ["crew_ask", "question", "[QUESTION]\\n\\n"]]) {
    pi.registerTool({
      name,
      label: `Crew: ${name === "crew_tell" ? "tell member" : "ask member"}`,
      description: "Post a signed substantive directed message.",
      parameters: Type.Object({ runId: Type.String(), to: Type.String(), [field]: Type.String(), ...sender }),
      async execute(_id, input, _signal, _update, ctx) {
        const roster = readRoster(rosterPath(ctx.cwd, input.runId));
        const recipient = resolveRecipient(roster, input.to);
        const body = `@${recipient.name}\\n\\n${prefix}${input[field]}`;
        return result({ actorId: recipient.actorId, commentUrl: postComment(roster, signedBody(roster, input.from, body, input.signature)).url });
      },
    });
  }

  pi.registerTool({
    name: "crew_broadcast",
    label: "Crew: broadcast",
    description: "Post a signed shared decision.",
    parameters: Type.Object({ runId: Type.String(), message: Type.String(), ...sender }),
    async execute(_id, input, _signal, _update, ctx) {
      const roster = readRoster(rosterPath(ctx.cwd, input.runId));
      const body = signedBody(roster, input.from, `[BROADCAST]\\n\\n${input.message}`, input.signature);
      return result({ commentUrl: postComment(roster, body).url, topic: roster.topic });
    },
  });
}
