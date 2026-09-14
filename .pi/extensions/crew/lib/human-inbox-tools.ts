import { CONFIG_DIR_NAME, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import { Type } from "typebox";
import { listComments } from "../../github/lib/discussions/index.ts";
import { assertLead, readRoster, writeRoster } from "./comm.mjs";
import { acknowledgeHumanRequests, queueHumanRequests } from "./human-inbox-state.mjs";
const result = value => ({ content: [{ type: "text", text: JSON.stringify(value) }], details: value });
const rosterPath = (cwd, runId) => join(cwd, CONFIG_DIR_NAME, "fabric", "crew-launch", `${runId}-roster.json`);
export function registerHumanInboxTools(pi) {
  pi.registerTool({ name:"crew_poll_human_requests", label:"Crew: poll human requests", description:"Lead-only durable human inbox poll.", parameters:Type.Object({runId:Type.String(),from:Type.String()}), async execute(_id,input,_signal,_update,ctx) { const path=rosterPath(ctx.cwd,input.runId); return withFileMutationQueue(path,async()=>{ const roster=readRoster(path); assertLead(roster,input.from); if(roster.status!=="started"||!roster.discussionNumber) throw new Error(`Crew ${input.runId} has no active Discussion`); const next=queueHumanRequests(roster,listComments(roster.owner,roster.repo,roster.discussionNumber,100)); if(next!==roster) writeRoster(path,next); return result({requests:next.pendingHumanRequests||[]}); }); } });
  pi.registerTool({ name:"crew_ack_human_requests", label:"Crew: acknowledge human requests", description:"Lead-only durable acknowledgement after response or dispatch.", parameters:Type.Object({runId:Type.String(),from:Type.String(),commentIds:Type.Array(Type.String(),{minItems:1})}), async execute(_id,input,_signal,_update,ctx) { const path=rosterPath(ctx.cwd,input.runId); return withFileMutationQueue(path,async()=>{ const roster=readRoster(path); assertLead(roster,input.from); const next=acknowledgeHumanRequests(roster,input.commentIds); writeRoster(path,next); return result({acknowledged:input.commentIds,requests:next.pendingHumanRequests||[]}); }); } });
}
