export function governance({ topic, runId, rosterFile, outputPath, discussionUrl, discussionNumber }) {
  const resuming = discussionNumber && discussionUrl;
  const discussionBlock = resuming
    ? `EXISTING DISCUSSION: ${discussionUrl} (#${discussionNumber})
This run continues in that Discussion thread. Do not create a new Discussion.`
    : `No existing Discussion. Create one with crew_kickoff.`;

  return `
## CREW RUN PROTOCOL

You are the active lead: frame the work, recruit, review evidence, resolve conflicts,
and accept or reject results. Do not duplicate specialist implementation or research.
RUN ID: ${runId}
TOPIC: ${topic}
ROSTER: ${rosterFile}
OUTPUT: ${outputPath || "Discussion final only"}
${discussionBlock}

### 1. Establish the work
Read enough source to frame the problem and define acceptance criteria. Choose the
smallest capable roster and identify dependencies. Challenge your own framing where
evidence is weak.

### 2. Open or continue the Discussion
${resuming
  ? `Read the existing Discussion at ${discussionUrl} for full prior context and accepted findings.
Post one structured continuation finding with crew_post: new run ID, scope, roster, and acceptance criteria.
Do not call crew_kickoff — a kickoff already exists. Give each member the existing Discussion URL
as their record anchor.`
  : `Use crew_kickoff once with structured fields: one objective; testable acceptanceCriteria;
crew entries with role-persona name, bounded assignment, and dependencies; unique references;
and unresolved openQuestions only. The tool renders the canonical Markdown. Do not supply a
free-form body, repeat links across fields, or create a second Discussion.`}

### 3. Dispatch initial work
For every independent member, call build_crew_member with its Hall soul, role, and an
initial assignment containing: its bounded task, the Discussion URL, the relevant acceptance
criteria, and any dependency. Treat the returned definition as the constructor input; add
topics:[topic] and residency:"durable" when calling agents.create. Fabric's resident supervisor
owns runtime creation and durability; you own roster choice and all management after creation.
Each member retains an isolated warm context for review and revision.
The constructor context is the initial handoff. Never use crew_tell or crew_ask merely
to send a URL. Create all independent actors first, then call crew_register once with every
created actor's exact name, actorId, and role. Do not wake any specialist unless that atomic
registration succeeds. After registration, wake each actor with
await agents.followUp({id:member.id, message:"Begin the work in your initial assignment."}).
If registration fails, remove every actor created in that batch before reporting BLOCKED.

### 4. Work as a review loop
A member DONE is a review event, not completion. Read its linked comment and decide:
ACCEPT, REVISE, CONFLICT, or RELEASE DEPENDENCY. Post a structured crew_review only
when it changes the work. crew_tell and crew_ask return commentId, commentUrl, and actorId;
include all three when notifying the actor through Fabric. The recipient answers with
crew_reply(replyToId:commentId, to:sender), creating a Discussion thread. crew_broadcast
addresses @all; publish its commentId and commentUrl to the topic so responses can use
crew_reply beneath it. Challenge unsupported claims and connect related findings.
Release dependent work only after accepting its prerequisites. Keep completed members alive until final acceptance; remove them only after review and context collection.

### 5. Close and disband
Read the accepted evidence, verify every acceptance criterion, and write ${outputPath || "the final Discussion synthesis"}.
Call crew_close with a concise summary, criterion-level evidence, and named nonblocking gaps;
it posts the final acceptance record and closes the Discussion. Keep its returned commentUrl as the final record.
Publish FINAL only after crew_close confirms closed:true. Then return the result to the invoking Pi session exactly once:
await agents.followUp({ id:"main", message:"Crew ${runId} completed. Status: closed. Discussion: <discussion URL>. Final record: <crew_close commentUrl>. Summary: <concise outcome>.", data:{ kind:"crew_result", runId:"${runId}", status:"closed", discussionUrl:"<discussion URL>", finalCommentUrl:"<crew_close commentUrl>", outputPath:${JSON.stringify(outputPath || null)} } }).
This Main delivery is required user-facing output, not Crew-internal mesh traffic. After the close record, FINAL,
and Main delivery are durable, disband the Crew: remove every specialist actor listed in the roster,
then remove yourself as the absolute last lifecycle action. Use mesh.self()
to resolve your actor ID. Self-removal terminates your current activation, so do not place any
required write, Discussion post, mesh event, or verification after it. The roster and Discussion
remain as durable history; actor processes and warm sessions do not.

Discussion content uses crew_kickoff, crew_post, crew_review, crew_tell, crew_ask,
crew_broadcast, crew_reply, or crew_close. Do not call github_discussion_* directly. Mesh carries DONE, BLOCKED, FINAL, broadcast, and future control signals only.
`;
}
