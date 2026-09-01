const clean = (value, field) => {
  const text = value?.trim();
  if (!text) throw new Error(`${field} must not be empty.`);
  return text;
};

const forbiddenTag = /\[(broadcast|question|ask|tell|response|message)\]/i;
const bullets = items => items.map(item => `- ${item}`).join("\n");
const checks = items => items.map(item => `- [ ] ${item}`).join("\n");
const escapeCell = value => value.replaceAll("|", "\\|").replaceAll("\n", " ");

export function assertCleanMessage(value, field = "Message") {
  const text = clean(value, field);
  if (forbiddenTag.test(text)) {
    throw new Error(`${field} contains an internal transport label. Use the operation template instead.`);
  }
  return text;
}

function linksIn(value) {
  return value?.match(/https?:\/\/[^\s)>]+/g) || [];
}

function assertUniqueLinks(values) {
  const links = values.flatMap(linksIn);
  const duplicate = links.find((link, index) => links.indexOf(link) !== index);
  if (duplicate) throw new Error(`Message contains a repeated link: ${duplicate}`);
}

function renderReferences(references = []) {
  assertUniqueLinks(references.flatMap(reference => [reference.label, reference.url]));
  return references.map(reference =>
    `- [${clean(reference.label, "Reference label")}](${clean(reference.url, "Reference URL")})`
  ).join("\n");
}

function renderCrew(crew) {
  return [
    "| Member | Assignment | Depends on |",
    "| --- | --- | --- |",
    ...crew.map(member => {
      const name = canonicalHandle(member.name);
      const dependency = member.dependsOn?.length
        ? member.dependsOn.map(item => `@${canonicalHandle(item)}`).join(", ")
        : "—";
      return `| @${name} | ${escapeCell(clean(member.assignment, `Assignment for ${name}`))} | ${dependency} |`;
    }),
  ].join("\n");
}

export function canonicalHandle(value) {
  const name = clean(value?.replace(/^@/, ""), "Crew member name");
  if (!/^[a-z][a-z0-9-]*-[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`Crew member name must be a role-persona handle: ${name}`);
  }
  return name;
}

export function renderKickoff(roster, input) {
  assertCleanMessage(input.title, "Title");
  const criteria = input.acceptanceCriteria.map(item => clean(item, "Acceptance criterion"));
  if (!criteria.length) throw new Error("Kickoff requires at least one acceptance criterion.");
  if (!input.crew.length) throw new Error("Kickoff requires at least one specialist.");
  assertUniqueLinks([
    input.objective,
    ...criteria,
    ...input.crew.flatMap(member => [member.assignment, ...(member.dependsOn || [])]),
    ...(input.openQuestions || []),
    ...(input.references || []).flatMap(reference => [reference.label, reference.url]),
  ]);

  const sections = [
    `**Run:** \`${roster.runId}\`  `,
    `**Lead:** @${canonicalHandle(roster.lead.name)}  `,
    `**Deliverable:** ${roster.outputPath ? `\`${roster.outputPath}\`` : "Discussion synthesis"}`,
    "", "## Objective", assertCleanMessage(input.objective, "Objective"),
    "", "## Acceptance criteria", checks(criteria),
    "", "## Crew", renderCrew(input.crew),
    "", "## Communication",
    "- Durable work and decisions: this Discussion.",
    `- Lifecycle events: \`${roster.topic}\`.`,
    "- Directed message: @role-persona. Shared message: @all.",
  ];
  if (input.references?.length) sections.push("", "## References", renderReferences(input.references));
  if (input.openQuestions?.length) {
    sections.push("", "## Open questions", bullets(input.openQuestions.map(item => assertCleanMessage(item, "Open question"))));
  }
  return sections.join("\n");
}

function renderEvidence(evidence) {
  return evidence?.length ? `\n\n### Evidence\n${renderReferences(evidence)}` : "";
}

export function renderFinding(input) {
  const subject = assertCleanMessage(input.subject, "Finding subject");
  const message = assertCleanMessage(input.message, "Finding");
  return `## Finding: ${subject}\n\n${message}${renderEvidence(input.evidence)}`;
}

export function renderReview(input) {
  const subject = assertCleanMessage(input.subject, "Review subject");
  const reason = assertCleanMessage(input.reason, "Review reason");
  return `## Review: ${subject}\n\n**Decision:** ${input.decision}\n\n${reason}${renderEvidence(input.evidence)}`;
}

export function renderDirected(to, message) {
  return `@${canonicalHandle(to)}\n\n${assertCleanMessage(message)}`;
}

export function renderBroadcast(message) {
  return `@all\n\n${assertCleanMessage(message)}`;
}

export const renderReply = renderDirected;

export function renderFinal(input) {
  const acceptance = input.acceptance.map(item => {
    const criterion = assertCleanMessage(item.criterion, "Acceptance criterion");
    return `- [x] ${criterion}${item.evidenceUrl ? ` — ${clean(item.evidenceUrl, "Evidence URL")}` : ""}`;
  });
  if (!acceptance.length) throw new Error("Final close requires accepted criteria.");
  const sections = [
    "## Final acceptance",
    "",
    assertCleanMessage(input.summary, "Final summary"),
    "",
    "### Acceptance criteria",
    acceptance.join("\n"),
  ];
  if (input.gaps?.length) sections.push("", "### Remaining gaps", bullets(input.gaps.map(gap => assertCleanMessage(gap, "Gap"))));
  return sections.join("\n");
}
