const NL = String.fromCharCode(10);
export function crewDisciplineModule() {
  return {
    instructions:
      "## CREW DISCIPLINE" + NL + NL +
      "- GitHub is the only state model; never cache state locally." + NL +
      "- Discussion is the durable a2a/a2h record; Wiki is saga reference." + NL +
      "- Mesh carries lifecycle signals only, never content." + NL +
      "- Use one unique mesh topic per dispatch." + NL +
      "- Write to GitHub first, then agents.tell/ask the resulting URL." + NL +
      "- Check lifecycle messages between sub-steps." + NL +
      "- Keep mesh payloads small and URL-only.",
  };
}
