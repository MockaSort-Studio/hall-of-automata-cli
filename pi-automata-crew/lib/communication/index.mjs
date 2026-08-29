import { createDiscussion, commentOnDiscussion, listComments, updateDiscussion } from "../../../pi-git-extension/lib/discussions.mjs";
const DEFAULT_OWNER = "MockaSort-Studio";
const DEFAULT_REPO = "hall-of-automata-cli";
const DEFAULT_CATEGORY = "Support";
function validateAgentId(a) { if (!a) throw new Error("agentId required"); return a; }
function validateText(t) { if (!t) throw new Error("text required"); return t; }
function validateTopic(t) { if (!t) throw new Error("topic required"); return t; }
export async function ask_support(agentId, question) {
  validateAgentId(agentId); validateText(question);
  const body = "Question from " + agentId + ":\n\n" + question;
  const title = "Support: " + question.substring(0, 50);
  const discussion = await createDiscussion(DEFAULT_OWNER, DEFAULT_REPO, title, body, DEFAULT_CATEGORY);
  await mesh.publish({ topic: "ask-" + agentId, text: question, data: { url: discussion.html_url } });
  return discussion;
}
export async function tell_information(agentId, info) {
  validateAgentId(agentId); validateText(info);
  const body = "Info from " + agentId + ":\n\n" + info;
  const title = "Info: " + info.substring(0, 50);
  const discussion = await createDiscussion(DEFAULT_OWNER, DEFAULT_REPO, title, body, DEFAULT_CATEGORY);
  await mesh.publish({ topic: "tell-" + agentId, text: info, data: { url: discussion.html_url } });
  return discussion;
}
export async function publish_event(topic, data) {
  validateTopic(topic);
  const text = typeof data === "string" ? data : JSON.stringify(data);
  await mesh.publish({ topic: topic, text: text });
}
export { createDiscussion, commentOnDiscussion, listComments, updateDiscussion };