import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertCleanMessage, canonicalHandle } from "./discussion-templates.mjs";

const gh = args => execFileSync("gh", args, { encoding: "utf8" }).trim();

function ghWithBody(args, body) {
  const dir = mkdtempSync(join(tmpdir(), "crew-"));
  const file = join(dir, "body.txt");
  writeFileSync(file, body, "utf8");
  try {
    return gh([...args, "-F", `body=@${file}`]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function repositoryId(owner, repo) {
  const query = "query($o:String!,$r:String!){repository(owner:$o,name:$r){id}}";
  return gh(["api", "graphql", "-f", `query=${query}`, "-f", `o=${owner}`, "-f", `r=${repo}`, "--jq", ".data.repository.id"]);
}

function categoryId(owner, repo, category) {
  const query = "query($o:String!,$r:String!){repository(owner:$o,name:$r){discussionCategories(first:20){nodes{id name}}}}";
  const nodes = JSON.parse(gh(["api", "graphql", "-f", `query=${query}`, "-f", `o=${owner}`, "-f", `r=${repo}`, "--jq", ".data.repository.discussionCategories.nodes"]));
  const match = nodes.find(item => item.name.toLowerCase() === category.toLowerCase());
  if (!match) throw new Error(`Unknown discussion category "${category}"`);
  return match.id;
}

function discussionId(owner, repo, number) {
  const query = "query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){discussion(number:$n){id}}}";
  return gh(["api", "graphql", "-f", `query=${query}`, "-f", `o=${owner}`, "-f", `r=${repo}`, "-F", `n=${number}`, "--jq", ".data.repository.discussion.id"]);
}

export const readRoster = path => JSON.parse(readFileSync(path, "utf8"));
export const writeRoster = (path, roster) => writeFileSync(path, JSON.stringify(roster, null, 2), "utf8");

export function resolveRecipient(roster, value) {
  const name = canonicalHandle(value);
  const recipients = [roster.lead, ...roster.members].filter(Boolean);
  const member = recipients.find(item => item.name === name);
  if (!member) throw new Error(`Crew member "${name}" not found. Use one of: ${recipients.map(item => `@${item.name}`).join(", ")}`);
  return member;
}

export function registerMembers(roster, from, members) {
  const sender = canonicalHandle(from);
  if (roster.status !== "started" || !roster.discussionNumber) {
    throw new Error("Members may be registered only on an active Crew with a canonical Discussion.");
  }
  if (roster.lead?.name !== sender) {
    throw new Error("Only the Crew Lead may register members.");
  }
  const next = [...(roster.members || [])];
  for (const candidate of members) {
    const member = {
      name: canonicalHandle(candidate.name),
      actorId: candidate.actorId?.trim(),
      role: candidate.role?.trim(),
    };
    if (!member.actorId || !member.role) throw new Error("Crew members require actorId and role.");
    const byName = next.find(item => item.name === member.name);
    const byActor = next.find(item => item.actorId === member.actorId);
    if (byName && byName.actorId !== member.actorId) {
      throw new Error(`Crew member "${member.name}" is already registered to another actor.`);
    }
    if (byActor && byActor.name !== member.name) {
      throw new Error(`Actor "${member.actorId}" is already registered under another name.`);
    }
    if (!byName) next.push(member);
  }
  return { ...roster, members: next };
}

export function unregisterMembers(roster, from, actorIds) {
  const sender = canonicalHandle(from);
  if (roster.lead?.name !== sender) throw new Error("Only the Crew Lead may unregister members.");
  const removed = new Set(actorIds.map(id => id.trim()));
  if (!removed.size || removed.has("")) throw new Error("Crew unregister requires actor IDs.");
  return { ...roster, members: (roster.members || []).filter(member => !removed.has(member.actorId)) };
}

export function resolveReplyTarget(roster, replyToId) {
  const request = (roster.pendingHumanRequests || []).find(item => item.id === replyToId);
  return request?.threadRootId || request?.replyToId || replyToId;
}

export function beginHumanClose(roster, from, closedAt) {
  if (roster.lead?.name !== canonicalHandle(from)) throw new Error("Only the Crew Lead may close a Crew.");
  if (roster.status === "closed" || roster.status === "closing") return roster;
  if (roster.status !== "started") throw new Error("Only an active Crew may begin human closure.");
  return { ...roster, status: "closing", discussionClosed: true, discussionClosedAt: closedAt };
}

export function finishHumanClose(roster, from) {
  if (roster.lead?.name !== canonicalHandle(from)) throw new Error("Only the Crew Lead may finish closure.");
  if (roster.status === "closed") return roster;
  if (roster.status !== "closing" || (roster.members || []).length) throw new Error("All specialists must be unregistered before closure.");
  return { ...roster, status: "closed" };
}

export function assertSubstantive(message) {
  const text = message.replace(/https?:\/\/\S+/g, "").replace(/@\S+/g, "").replace(/^#+\s*/gm, "").trim();
  if (text.length < 8) {
    throw new Error("Crew messages must contain a substantive instruction, question, or finding; a URL alone is not enough.");
  }
}

export function signedBody(roster, from, message, signature) {
  if (roster.status !== "started") {
    throw new Error("Crew Discussion mutations require an active Crew.");
  }
  const senders = [roster.lead, ...roster.members].filter(Boolean);
  const sender = canonicalHandle(from);
  if (!senders.some(member => member.name === sender)) throw new Error(`Unknown Crew sender "${sender}"`);
  assertCleanMessage(message);
  assertSubstantive(message);
  if (!signature?.trim() || signature.trim().length < 6) {
    throw new Error("Crew posts require the sender's completed persona signature.");
  }
  return `${message}\n\n---\n@${sender}\n${signature.trim()}`;
}

export function markDiscussionClosed(roster, closed) {
  if (!closed?.closed) throw new Error("GitHub did not report the Discussion as closed.");
  return {
    ...roster,
    status: "closed",
    discussionClosed: true,
    discussionClosedAt: closed.closedAt,
  };
}

export function createKickoff(roster, title, body, category = "General") {
  const repo = repositoryId(roster.owner, roster.repo);
  const categoryNode = categoryId(roster.owner, roster.repo, category);
  const mutation = "mutation($r:ID!,$c:ID!,$t:String!,$body:String!){createDiscussion(input:{repositoryId:$r,categoryId:$c,title:$t,body:$body}){discussion{number url}}}";
  return JSON.parse(ghWithBody(["api", "graphql", "-f", `query=${mutation}`, "-f", `r=${repo}`, "-f", `c=${categoryNode}`, "-f", `t=${title}`, "--jq", ".data.createDiscussion.discussion"], body));
}

export function postComment(roster, body, replyToId) {
  const id = discussionId(roster.owner, roster.repo, roster.discussionNumber);
  const reply = replyToId ? ",replyToId:$reply" : "";
  const variable = replyToId ? ",$reply:ID!" : "";
  const mutation = `mutation($id:ID!,$body:String!${variable}){addDiscussionComment(input:{discussionId:$id,body:$body${reply}}){comment{id url}}}`;
  const args = ["api", "graphql", "-f", `query=${mutation}`, "-f", `id=${id}`];
  if (replyToId) args.push("-f", `reply=${replyToId}`);
  return JSON.parse(ghWithBody([...args, "--jq", ".data.addDiscussionComment.comment"], body));
}

export function closeDiscussion(roster) {
  const id = discussionId(roster.owner, roster.repo, roster.discussionNumber);
  const mutation = "mutation($id:ID!){closeDiscussion(input:{discussionId:$id}){discussion{url closed closedAt}}}";
  return JSON.parse(gh(["api", "graphql", "-f", `query=${mutation}`, "-f", `id=${id}`, "--jq", ".data.closeDiscussion.discussion"]));
}
