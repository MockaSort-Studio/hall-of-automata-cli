export function isCrewComment(roster, comment) {
  const members = [roster.lead, ...(roster.members || [])].filter(Boolean);
  return members.some(member => comment.body?.includes(`\n---\n@${member.name}\n`));
}

const request = comment => ({
  id: comment.id,
  url: comment.url,
  body: comment.body,
  author: comment.author?.login ?? "unknown",
  threadRootId: comment.replyToId || comment.id,
  ...(comment.replyToId ? { replyToId: comment.replyToId } : {}),
});

export function queueHumanRequests(roster, comments) {
  const pending = roster.pendingHumanRequests || [];
  const known = new Set([...(roster.handledHumanCommentIds || []), ...pending.map(item => item.id)]);
  const additions = comments
    .filter(comment => !known.has(comment.id) && !isCrewComment(roster, comment))
    .map(request);
  return additions.length ? { ...roster, pendingHumanRequests: [...pending, ...additions] } : roster;
}

export function acknowledgeHumanRequests(roster, ids) {
  const selected = new Set(ids);
  const pending = roster.pendingHumanRequests || [];
  const missing = ids.filter(id => !pending.some(item => item.id === id));
  if (missing.length) throw new Error(`Human request is not pending: ${missing.join(", ")}`);
  return {
    ...roster,
    pendingHumanRequests: pending.filter(item => !selected.has(item.id)),
    handledHumanCommentIds: [...new Set([...(roster.handledHumanCommentIds || []), ...ids])],
  };
}
