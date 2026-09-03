const NL = String.fromCharCode(10);
export function crewDisciplineModule() {
  return { instructions: [
    "## CREW OPERATING CONTRACT",
    "Discussion is the durable evidence and decision record; Fabric carries activation, lifecycle, and comment pointers.",
    "Use only registered crew_* tools for Discussion writes; wrappers own addressing, threads, formatting, and signatures.",
    "Post evidence and decisions only. Never publish operational status or repeat an already-linked finding.",
    "Only the Lead manages lifecycle. Specialists never stop or remove actors; stop pauses and is not disbanding.",
  ].join(NL) };
}
