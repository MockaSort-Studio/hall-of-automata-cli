const NL = String.fromCharCode(10);
export function crewDisciplineModule() {
  return {
    instructions: 
      "## CREW DISCIPLINE" + NL + NL +
      "- GitHub is the ONLY state model. Never cache state locally." + NL +
      "- Discussion is the a2a and a2h scratchpad." + NL +
      "- Wiki is for saga reference only." + NL +
      "- Project board/issues are for plan, assignments, and status." + NL +
      "- Mesh is for TRIGGERING ONLY. Payloads must be GitHub URLs." + NL +
      "- Write-then-tell: always post to GitHub first, get URL, then notify via mesh." + NL +
      "- One mesh topic per crew." + NL +
      "- Check the crew topic between sub-steps." + NL +
      "- Post all findings to the Discussion thread." + NL +
      "- Use agents.ask() for blocking questions, agents.tell() for info."
  };
}
