import { Type } from "typebox";
import { createKickoff, postComment, readRoster, resolveRecipient, assertSubstantive, writeRoster } from "./comm.mjs";

const result = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });
const rosterPath = (cwd, runId) => `${cwd}/.pi/fabric/crew-launch/${runId}-roster.json`;

export function registerCommunicationTools(pi) {
  pi.registerTool({
    name: "crew_kickoff", label: "Crew: create kickoff",
    description: "Create the single canonical Discussion for a crew run.",
    parameters: Type.Object({ runId: Type.String(), title: Type.String(), body: Type.String(), category: Type.Optional(Type.String()) }),
    async execute(_id, input, _sig, _upd, ctx) {
      const path = rosterPath(ctx.cwd, input.runId);
      const roster = readRoster(path);
      if (roster.discussionNumber) throw new Error(`Crew ${input.runId} already has Discussion #${roster.discussionNumber}`);
      assertSubstantive(input.body);
      const discussion = createKickoff(roster, input.title, input.body, input.category);
      writeRoster(path, { ...roster, discussionNumber: discussion.number, discussionUrl: discussion.url });
      return result({ discussionNumber: discussion.number, discussionUrl: discussion.url });
    },
  });

  pi.registerTool({
    name: "crew_post", label: "Crew: post finding",
    description: "Post a substantive finding, review decision, or result to the crew Discussion.",
    parameters: Type.Object({ runId: Type.String(), message: Type.String() }),
    async execute(_id, input, _sig, _upd, ctx) {
      assertSubstantive(input.message);
      const comment = postComment(readRoster(rosterPath(ctx.cwd, input.runId)), input.message);
      return result({ commentUrl: comment.url });
    },
  });

  for (const [name, field, prefix] of [["crew_tell", "message", ""], ["crew_ask", "question", "[QUESTION]\\n\\n"]]) {
    pi.registerTool({
      name, label: `Crew: ${name === "crew_tell" ? "tell member" : "ask member"}`,
      description: "Post a substantive directed message and return its routing handles.",
      parameters: Type.Object({ runId: Type.String(), to: Type.String(), [field]: Type.String() }),
      async execute(_id, input, _sig, _upd, ctx) {
        assertSubstantive(input[field]);
        const roster = readRoster(rosterPath(ctx.cwd, input.runId));
        const member = resolveRecipient(roster, input.to);
        const comment = postComment(roster, `@${member.name}\\n\\n${prefix}${input[field]}`);
        return result({ actorId: member.actorId, commentUrl: comment.url });
      },
    });
  }

  pi.registerTool({
    name: "crew_broadcast", label: "Crew: broadcast",
    description: "Post a substantive shared decision and return its URL and topic for lifecycle notification.",
    parameters: Type.Object({ runId: Type.String(), message: Type.String() }),
    async execute(_id, input, _sig, _upd, ctx) {
      assertSubstantive(input.message);
      const roster = readRoster(rosterPath(ctx.cwd, input.runId));
      const comment = postComment(roster, `[BROADCAST]\\n\\n${input.message}`);
      return result({ commentUrl: comment.url, topic: roster.topic });
    },
  });
}
