/**
 * GitHub Discussions Tool
 * Part of pi-git-extension
 * Provides GitHub Discussion operations for pi-automata-crew
 */

const OWNER = "MockaSort-Studio";
const REPO = "hall-of-automata-cli";

/**
 * Create a new GitHub Discussion
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name  
 * @param {string} title - Discussion title
 * @param {string} body - Discussion body
 * @param {string} category - Discussion category
 * @returns {Promise<Object>} - Discussion data with html_url
 */
export async function createDiscussion(owner = OWNER, repo = REPO, title, body, category = "Support") {
  const cmd = 'gh api -H "Accept: application/vnd.github.v3+json" ' +
    
  const result = await pi.bash({ cmd, settle: true });
  
  if (!result.ok) {
    throw new Error('Failed to create discussion: ' + (result.error || result.output));
  }
  
  try {
    return JSON.parse(result.output);
  } catch (e) {
    return { html_url: result.output.trim() };
  }
}

/**
 * Post a comment to an existing Discussion
 * @param {string} discussionId - Discussion node ID or number
 * @param {string} body - Comment body
 * @returns {Promise<Object>} - Comment data with html_url
 */
export async function commentOnDiscussion(discussionId, body) {
  const cmd = 'gh api -H "Accept: application/vnd.github.v3+json" ' +
    
  const result = await pi.bash({ cmd, settle: true });
  
  if (!result.ok) {
    throw new Error('Failed to post comment: ' + (result.error || result.output));
  }
  
  try {
    return JSON.parse(result.output);
  } catch (e) {
    return { html_url: result.output.trim() };
  }
}

/**
 * List comments in a Discussion
 * @param {string} discussionId - Discussion node ID or number
 * @returns {Promise<Array>} - Array of comment objects
 */
export async function listComments(discussionId) {
  const cmd = 'gh api -H "Accept: application/vnd.github.v3+json" ' +
    
  const result = await pi.bash({ cmd, settle: true });
  
  if (!result.ok) {
    throw new Error('Failed to list comments: ' + (result.error || result.output));
  }
  
  try {
    return JSON.parse(result.output);
  } catch (e) {
    return [];
  }
}

/**
 * Update a Discussion (title or body)
 * @param {string} discussionId - Discussion node ID or number
 * @param {string} title - New title (optional)
 * @param {string} body - New body (optional)
 * @returns {Promise<Object>} - Updated discussion data
 */
export async function updateDiscussion(discussionId, title, body) {
  const updates = [];
  if (title) updates.push('-F title="' + title.replace(/"/g, '\"') + '"');
  if (body) updates.push('-F body="' + body.replace(/"/g, '\"') + '"');
  
  if (updates.length === 0) {
    throw new Error('updateDiscussion: title or body must be provided');
  }
  
  const cmd = 'gh api -H "Accept: application/vnd.github.v3+json" ' +
    
  const result = await pi.bash({ cmd, settle: true });
  
  if (!result.ok) {
    throw new Error('Failed to update discussion: ' + (result.error || result.output));
  }
  
  try {
    return JSON.parse(result.output);
  } catch (e) {
    return { html_url: result.output.trim() };
  }
}
