import { createDiscussion, commentOnDiscussion as postComment, listComments as readComments, updateDiscussion } from "../../../pi-git-extension/lib/discussions.mjs";

const DEFAULT_OWNER = "MockaSort-Studio";
const DEFAULT_REPO = "hall-of-automata-cli";
const DEFAULT_CATEGORY = "Support";

function getAgentId(agentId) {
  return agentId || "automaton";
}

function formatQuestion(agentId, question) {
  return "**Question from " + agentId + ":**\n\n" + question;
}

function formatInformation(agentId, info) {
  return "**Information from " + agentId + ":**\n\n" + info;
}

export function ask_support(agentId, question) {
  const body = formatQuestion(getAgentId(agentId), question);
  const title = "Support Request: " + question.substring(0, 50) + (question.length > 50 ? "..." : "");
  
  return createDiscussion(
    DEFAULT_OWNER,
    DEFAULT_REPO,
    title,
    body,
    DEFAULT_CATEGORY
  );
}

export function tell_information(agentId, info) {
  const body = formatInformation(getAgentId(agentId), info);
  const title = "Information: " + info.substring(0, 50) + (info.length > 50 ? "..." : "");
  
  return createDiscussion(
    DEFAULT_OWNER,
    DEFAULT_REPO,
    title,
    body,
    DEFAULT_CATEGORY
  );
}

export { createDiscussion, postComment, readComments, updateDiscussion };