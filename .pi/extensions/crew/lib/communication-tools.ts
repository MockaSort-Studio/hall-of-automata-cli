import { CONFIG_DIR_NAME, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { Type } from "typebox";
import {
  closeDiscussion,
  createKickoff,
  markDiscussionClosed,
  postComment,
  readRoster,
  registerMembers,
  resolveRecipient,
  signedBody,
  writeRoster,
} from "./comm.mjs";
import {
  renderBroadcast,
  renderDirected,
  renderFinal,
  renderFinding,
  renderKickoff,
  renderReply,
  renderReview,
} from "./discussion-templates.mjs";

const result = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });
const rosterPath = (cwd, runId) =>
  join(cwd, CONFIG_DIR_NAME, "fabric", "crew-launch", `${runId}-roster.json`);
const sender = {
  from: Type.String({ description: "Canonical role-persona sender handle, without @" }),
  signature: Type.String({ description: "Completed persona signature" }),
};
const evidence = Type.Array(Type.Object({ label: Type.String(), url: Type.String() }));
const kickoffMember = Type.Object({
  name: Type.String({ description: "Canonical role-persona handle, without @" }),
  assignment: Type.String(),
  dependsOn: Type.Optional(Type.Array(Type.String())),
});
const registeredMember = Type.Object({
  name: Type.String(), actorId: Type.String(), role: Type.String(),
});
const commentResult = (comment, extra = {}) => result({ commentId: comment.id, commentUrl: comment.url, ...extra });
const load = (ctx, runId) => readRoster(rosterPath(ctx.cwd, runId));
const signed = (roster, input, body) => signedBody(roster, input.from, body, input.signature);

export function registerCommunicationTools(pi) {
  pi.registerTool({
    name: "crew_kickoff", label: "Crew: create kickoff",
    description: "Create one canonical Discussion from structured objective, criteria, crew, and references.",
    parameters: Type.Object({
      runId: Type.String(), title: Type.String(), objective: Type.String(),
      acceptanceCriteria: Type.Array(Type.String(), { minItems: 1 }),
      crew: Type.Array(kickoffMember, { minItems: 1 }),
      references: Type.Optional(evidence), openQuestions: Type.Optional(Type.Array(Type.String())),
      category: Type.Optional(Type.String()), ...sender,
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const path = rosterPath(ctx.cwd, input.runId);
      const roster = readRoster(path);
      if (roster.status !== "started") throw new Error(`Crew ${input.runId} is not active`);
      if (roster.discussionNumber) throw new Error(`Crew ${input.runId} already has a Discussion`);
      const body = signed(roster, input, renderKickoff(roster, input));
      const discussion = createKickoff(roster, input.title, body, input.category);
      writeRoster(path, { ...roster, discussionNumber: discussion.number, discussionUrl: discussion.url });
      return result({ discussionNumber: discussion.number, discussionUrl: discussion.url });
    },
  });

  pi.registerTool({
    name: "crew_register", label: "Crew: register members",
    description: "Atomically register specialist actors; only the persisted supervisor or Lead may call it.",
    parameters: Type.Object({
      runId: Type.String(), from: Type.String(),
      members: Type.Array(registeredMember, { minItems: 1 }),
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const path = rosterPath(ctx.cwd, input.runId);
      return withFileMutationQueue(path, async () => {
        const roster = registerMembers(readRoster(path), input.from, input.members);
        writeRoster(path, roster);
        return result({ registered: input.members.map(member => member.name), members: roster.members });
      });
    },
  });

  pi.registerTool({
    name: "crew_post", label: "Crew: post finding",
    description: "Post a structured finding with optional evidence links.",
    parameters: Type.Object({
      runId: Type.String(), subject: Type.String(), message: Type.String(),
      evidence: Type.Optional(evidence), ...sender,
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const roster = load(ctx, input.runId);
      return commentResult(postComment(roster, signed(roster, input, renderFinding(input))));
    },
  });

  pi.registerTool({
    name: "crew_review", label: "Crew: post review",
    description: "Post a structured Lead review and explicit decision.",
    parameters: Type.Object({
      runId: Type.String(), subject: Type.String(),
      decision: Type.Union([Type.Literal("ACCEPT"), Type.Literal("REVISE"), Type.Literal("CONFLICT"), Type.Literal("RELEASE DEPENDENCY")]),
      reason: Type.String(), evidence: Type.Optional(evidence), ...sender,
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const roster = load(ctx, input.runId);
      if (roster.lead?.name !== input.from) throw new Error("Only the Crew Lead may post a review.");
      return commentResult(postComment(roster, signed(roster, input, renderReview(input))));
    },
  });

  for (const [name, field] of [["crew_tell", "message"], ["crew_ask", "question"]]) {
    pi.registerTool({
      name, label: `Crew: ${name === "crew_tell" ? "tell member" : "ask member"}`,
      description: "Post a clean directed message to one exact @role-persona recipient.",
      parameters: Type.Object({ runId: Type.String(), to: Type.String(), [field]: Type.String(), ...sender }),
      async execute(_id, input, _signal, _update, ctx) {
        const roster = load(ctx, input.runId);
        const recipient = resolveRecipient(roster, input.to);
        const comment = postComment(roster, signed(roster, input, renderDirected(recipient.name, input[field])));
        return commentResult(comment, { actorId: recipient.actorId });
      },
    });
  }

  pi.registerTool({
    name: "crew_broadcast", label: "Crew: broadcast",
    description: "Post a clean @all shared decision.",
    parameters: Type.Object({ runId: Type.String(), message: Type.String(), ...sender }),
    async execute(_id, input, _signal, _update, ctx) {
      const roster = load(ctx, input.runId);
      const comment = postComment(roster, signed(roster, input, renderBroadcast(input.message)));
      return commentResult(comment, { topic: roster.topic });
    },
  });

  pi.registerTool({
    name: "crew_reply", label: "Crew: reply in thread",
    description: "Reply beneath a specific ask, tell, or broadcast Discussion comment.",
    parameters: Type.Object({
      runId: Type.String(), replyToId: Type.String({ description: "GraphQL ID returned with the parent comment" }),
      to: Type.String(), message: Type.String(), ...sender,
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const roster = load(ctx, input.runId);
      const recipient = input.to === "all" ? "all" : resolveRecipient(roster, input.to).name;
      const body = recipient === "all" ? renderBroadcast(input.message) : renderReply(recipient, input.message);
      return commentResult(postComment(roster, signed(roster, input, body), input.replyToId));
    },
  });

  pi.registerTool({
    name: "crew_close", label: "Crew: accept and close",
    description: "Post the Lead's final acceptance record, then close the canonical Discussion.",
    parameters: Type.Object({
      runId: Type.String(), summary: Type.String(),
      acceptance: Type.Array(Type.Object({ criterion: Type.String(), evidenceUrl: Type.Optional(Type.String()) }), { minItems: 1 }),
      gaps: Type.Optional(Type.Array(Type.String())), ...sender,
    }),
    async execute(_id, input, _signal, _update, ctx) {
      const path = rosterPath(ctx.cwd, input.runId);
      return withFileMutationQueue(path, async () => {
        let roster = readRoster(path);
        if (roster.lead?.name !== input.from) throw new Error("Only the Crew Lead may close the Discussion.");
        if (roster.discussionClosed) {
          if (roster.status !== "closed") {
            roster = { ...roster, status: "closed" };
            writeRoster(path, roster);
          }
          return result({ discussionUrl: roster.discussionUrl, closed: true, status: "closed", commentId: roster.finalCommentId, commentUrl: roster.finalCommentUrl });
        }
        if (!roster.finalCommentId) {
          const comment = postComment(roster, signed(roster, input, renderFinal(input)));
          roster = { ...roster, finalCommentId: comment.id, finalCommentUrl: comment.url };
          writeRoster(path, roster);
        }
        const closed = closeDiscussion(roster);
        roster = markDiscussionClosed(roster, closed);
        writeRoster(path, roster);
        return result({ discussionUrl: closed.url, closed: true, status: "closed", commentId: roster.finalCommentId, commentUrl: roster.finalCommentUrl });
      });
    },
  });
}
