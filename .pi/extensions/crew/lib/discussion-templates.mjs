const clean = (value, field) => {
  const text = value?.trim();
  if (!text) throw new Error(`${field} must not be empty.`);
  return text;
};

const bullets = items => items.map(item => `- ${item}`).join("\n");
const checks = items => items.map(item => `- [ ] ${item}`).join("\n");
const escapeCell = value => value.replaceAll("|", "\\|").replaceAll("\n", " ");

function assertUniqueLinks(input) {
  const values = [
    input.objective,
    ...input.acceptanceCriteria,
    ...input.crew.flatMap(member => [member.assignment, ...(member.dependsOn || [])]),
    ...(input.openQuestions || []),
    ...(input.references || []).flatMap(reference => [reference.label, reference.url]),
  ];
  const links = values.flatMap(value => value?.match(/https?:\/\/[^\s)>]+/g) || []);
  const duplicate = links.find((link, index) => links.indexOf(link) !== index);
  if (duplicate) throw new Error(`Kickoff contains a repeated link: ${duplicate}`);
}

function renderCrew(crew) {
  return [
    "| Member | Assignment | Depends on |",
    "| --- | --- | --- |",
    ...crew.map(member => {
      const name = clean(member.name, "Crew member name");
      if (!/^[a-z][a-z0-9-]*$/.test(name)) {
        throw new Error(`Crew member name must be a role-persona handle: ${name}`);
      }
      const dependency = member.dependsOn?.length ? member.dependsOn.map(item => `@${item}`).join(", ") : "—";
      return `| @${name} | ${escapeCell(clean(member.assignment, `Assignment for ${name}`))} | ${dependency} |`;
    }),
  ].join("\n");
}

export function renderKickoff(roster, input) {
  clean(input.title, "Title");
  const criteria = input.acceptanceCriteria.map(item => clean(item, "Acceptance criterion"));
  if (!criteria.length) throw new Error("Kickoff requires at least one acceptance criterion.");
  if (!input.crew.length) throw new Error("Kickoff requires at least one specialist.");
  assertUniqueLinks(input);

  const sections = [
    `**Run:** \`${roster.runId}\`  `,
    `**Lead:** @${roster.lead.name}  `,
    `**Deliverable:** ${roster.outputPath ? `\`${roster.outputPath}\`` : "Discussion synthesis"}`,
    "",
    "## Objective",
    clean(input.objective, "Objective"),
    "",
    "## Acceptance criteria",
    checks(criteria),
    "",
    "## Crew",
    renderCrew(input.crew),
    "",
    "## Communication",
    "- Durable work and decisions: this Discussion.",
    `- Lifecycle events: \`${roster.topic}\`.`,
    "- Directed message: @role-persona. Shared message: @all.",
  ];

  if (input.references?.length) {
    sections.push("", "## References", bullets(input.references.map(ref => `[${clean(ref.label, "Reference label")}](${clean(ref.url, "Reference URL")})`)));
  }
  if (input.openQuestions?.length) {
    sections.push("", "## Open questions", bullets(input.openQuestions.map(item => clean(item, "Open question"))));
  }
  return sections.join("\n");
}
