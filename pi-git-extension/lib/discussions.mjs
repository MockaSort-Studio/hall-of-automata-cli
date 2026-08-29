import { execFileSync } from "node:child_process";

const OWNER = "MockaSort-Studio";
const REPO = "hall-of-automata-cli";

// Use native pi.bash if in Fabric, else fallback to execFileSync
async function bash(cmd, opts = {}) {
  if (typeof pi !== 'undefined' && pi.bash) {
    return await pi.bash({ cmd, ...opts });
  }
  try {
    const output = execFileSync('bash', ['-c', cmd], { encoding: 'utf8', ...opts });
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e.message, output: e.stdout || '' };
  }
}

export async function createDiscussion(owner = OWNER, repo = REPO, title, body, category = "General", options = {}) {
  const { labels = [], assignees = [], projectId, notify = false } = options;
  
  let cmd = 'gh discussion create --title "' + title + '" --body "' + body + '" --category "' + category + '"';
  
  if (labels.length > 0) {
    cmd += ' --label "' + labels.join('","') + '"';
  }
  if (assignees.length > 0) {
    cmd += ' --assignee "' + assignees.join('","') + '"';
  }
  if (projectId) {
    cmd += ' --project "' + projectId + '"';
  }
  if (notify) {
    cmd += ' --notify';
  }
  
  const result = await bash(cmd, { settle: true });
  if (!result.ok) throw new Error("createDiscussion failed: " + (result.error || result.output));
  return { html_url: result.output.trim() };
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
  if (title) updates.push("-F title="'" + title + """);
  if (body) updates.push("-F body="'" + body + """);
  if (updates.length === 0) throw new Error("title or body required");
  const cmd = 'gh api repos/' + OWNER + '/' + REPO + '/discussions/' + discussionId + ' -X PATCH ' + updates.join(' ');
  const result = await bash(cmd, { settle: true });
  if (!result.ok) throw new Error("updateDiscussion failed");
  return JSON.parse(result.output);
}
