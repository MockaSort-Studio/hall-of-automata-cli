import { createRobot, baseModule, soulModule, roleModule, crewDisciplineModule } from "./automaton-body/lib/index.mjs";

/**
 * Main-side entrypoint. Run this module from fabric_exec.
 * Main recruits exactly one persistent lead; the lead recruits and governs
 * the rest of the crew. Durable content belongs in GitHub, never in mesh.
 */
export async function startCrew({ task, runId, model, thinking } = {}) {
  if (!task || typeof task !== "string") throw new Error("startCrew requires task");
  const id = runId || crypto.randomUUID();
  const topic = `crew.${id}`;
  const robot = createRobot({ id: `lead-${id}`, name: "Crew Lead", role: "lead" })
    .install(baseModule)
    .install(soulModule, { name: "old-major" })
    .install(crewDisciplineModule)
    .install(roleModule, { role: "lead", override: { model, thinking } })
    .build();

  const lead = await agents.create({
    name: robot.id,
    instructions: `${robot.instructions}\n\n## CURRENT DISPATCH\nTask: ${task}\nRun ID: ${id}\nCrew topic: ${topic}\n\nYou are the only lead. Recruit specialists yourself with agents.create({ runner: "pi", extensions: true, topics: ["${topic}"], tools: [] }). Do not ask Main to recruit them.\n\nCreate one GitHub Discussion for this dispatch with github_discussion_create. Every kickoff, finding, question, and answer must be a comment in that same thread using github_discussion_comment. Read it with github_discussion_comments before acting or reviewing. After each comment, use agents.tell/ask only to send the comment URL and a short notification to the target. Use mesh only for START, DONE, ERROR, and STOP lifecycle signals. Finish with exactly: FINAL discussionUrl=<url> artifactUrl=<url-or-none> status=<complete|blocked>.`,
    runner: "pi",
    model,
    thinking,
    topics: [topic],
    tools: [],
    extensions: true,
    responseMode: "text",
    delivery: "mailbox",
    residency: "session",
  });

  await mesh.publish({ topic, kind: "START", to: lead.id, text: "START" });
  return { runId: id, topic, leadId: lead.id, status: "started" };
}

export default startCrew;
