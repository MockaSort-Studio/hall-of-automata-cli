import { bash } from '../../../lib/executor.mjs';
import { tell_information } from '../../../pi-automata-crew/lib/communication/index.mjs';

const OWNER = "MockaSort-Studio";
const REPO = "hall-of-automata-cli";

export async function createDiscussion(owner = OWNER, repo = REPO, title, body, category = "Support") {
  const cmd = 'gh api repos/' + owner + '/' + repo + '/discussions -X POST -f title="' + title + '" -f body="' + body + '" -f category="' + category + '"';
  const result = await bash(cmd, { settle: true });
  if (!result.ok) throw new Error("createDiscussion failed");
  return JSON.parse(result.output);
}

export async function commentOnDiscussion(discussionId, body) {
  const cmd = 'gh api repos/' + OWNER + '/' + REPO + '/discussions/' + discussionId + '/comments -X POST -f body="' + body + '"';
  const result = await bash(cmd, { settle: true });
  if (!result.ok) throw new Error("commentOnDiscussion failed");
  return JSON.parse(result.output);
}

export async function listComments(discussionId) {
  const cmd = 'gh api repos/' + OWNER + '/' + REPO + '/discussions/' + discussionId + '/comments';
  const result = await bash(cmd, { settle: true });
  if (!result.ok) throw new Error("listComments failed");
  return JSON.parse(result.output);
}

export async function updateDiscussion(discussionId, title, body) {
  const updates = [];
  if (title) updates.push("-F title='" + title + "'");
  if (body) updates.push("-F body='" + body + "'");
  if (updates.length === 0) throw new Error("title or body required");
  const cmd = 'gh api repos/' + OWNER + '/' + REPO + '/discussions/' + discussionId + ' -X PATCH ' + updates.join(' ');
  const result = await bash(cmd, { settle: true });
  if (!result.ok) throw new Error("updateDiscussion failed");
  return JSON.parse(result.output);
}
