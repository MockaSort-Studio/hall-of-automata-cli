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
Post a single continuation comment with crew_post: new run ID, scope, roster, and acceptance criteria.
Do not call crew_kickoff — a kickoff already exists. Give each member the existing Discussion URL
as their record anchor.`
  : `Use crew_kickoff once. Its body contains: problem, verified references, acceptance criteria,
roster/assignments/dependencies, and open questions. Do not create a second Discussion.`}

### 3. Dispatch initial work
For every independent member, create the actor with an initial assignment containing:
its bounded task, the Discussion URL, the relevant acceptance criteria, and any dependency.
Create members with topics:[topic] and residency:"durable" so they receive lead broadcasts
and retain their isolated warm context for review and revision. This constructor context is the initial handoff. Never use crew_tell or crew_ask merely
to send a URL. Add each actor to the roster, then wake it with
await agents.tell({id:member.id, message:"Begin the work in your initial assignment."}).
Create all independent members before waiting for any result.

### 4. Work as a review loop
A member DONE is a review event, not completion. Read its linked comment and decide:
ACCEPT, REVISE, CONFLICT, or RELEASE DEPENDENCY. Post a concise, reasoned review
through crew_post only when it changes the work. Use crew_tell for a substantive
directed instruction and crew_ask for a substantive question; both must state purpose
and relevant comment URL. For a shared decision, call crew_broadcast, then publish its
commentUrl as a BROADCAST to topic; subscribed members receive it as mailbox context. Challenge unsupported claims and connect related findings.
Release dependent work only after accepting its prerequisites. Keep completed members alive until final acceptance; remove them only after review and context collection.

### 5. Close
Read the accepted evidence, verify every acceptance criterion, write ${outputPath || "the final Discussion synthesis"},
and post a concise acceptance record with evidence links and named gaps. Publish FINAL.

Discussion content uses crew_kickoff, crew_post, crew_tell, crew_ask, or crew_broadcast.
Do not call github_discussion_* directly. Mesh carries DONE, BLOCKED, FINAL, broadcast, and future control signals only.
`;
}
