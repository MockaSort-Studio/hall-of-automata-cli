const DEFAULT_OWNER = "MockaSort-Studio";
const DEFAULT_REPO = "hall-of-automata-cli";
const DEFAULT_CATEGORY = "General";

function validateAgentId(a) { if (!a) throw new Error("agentId required"); return a; }
function validateText(t) { if (!t) throw new Error("text required"); return t; }
function validateTopic(t) { if (!t) throw new Error("topic required"); return t; }

// Helper to safely publish to mesh (only works in Fabric context)
async function safeMeshPublish(topic, text, data) {
  if (typeof mesh !== 'undefined' && mesh.publish) {
    await mesh.publish({ topic, text, data });
  } else {
    console.log('Mesh publish skipped (not in Fabric context):', { topic, text, data });
  }
}

// Import from the Pi extension (nested in pi/)
import { createDiscussion, commentOnDiscussion, listComments, updateDiscussion } from '../../../pi/pi-git-extension/lib/discussions.mjs';

export async function ask_support(agentId, question) {
  validateAgentId(agentId); validateText(question);
  const body = `Question from ${agentId}:

${question}`;
  const title = "Support: " + question.substring(0, 50);
  const discussion = await createDiscussion(DEFAULT_OWNER, DEFAULT_REPO, title, body, DEFAULT_CATEGORY);
  await safeMeshPublish("ask-" + agentId, question, { url: discussion.url });
  return discussion;
}

export async function tell_information(agentId, info) {
  validateAgentId(agentId); validateText(info);
  const body = `Info from ${agentId}:

${info}`;
  const title = "Info: " + info.substring(0, 50);
  const discussion = await createDiscussion(DEFAULT_OWNER, DEFAULT_REPO, title, body, DEFAULT_CATEGORY);
  await safeMeshPublish("tell-" + agentId, info, { url: discussion.url });
  return discussion;
}

export async function publish_event(topic, data) {
  validateTopic(topic);
  const text = typeof data === "string" ? data : JSON.stringify(data);
  await safeMeshPublish(topic, text);
}

export { createDiscussion, commentOnDiscussion, listComments, updateDiscussion };

export function subscribe(topic) {
  validateTopic(topic);
  console.log('Subscribed to topic:', topic);
  return { topic, status: 'subscribed' };
}