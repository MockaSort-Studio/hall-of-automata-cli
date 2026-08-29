# AGENT-GUIDELINES

## Rules

- Use pi.bash directly, never fabric_exec
- Import modules directly, never spawn node
- Use strings parameter for complex code in fabric_exec


---

## Communication Discipline

### 1. Mesh Topics - Lifecycle Only
- Use mesh topics **only** for lifecycle events: START, DONE, STOP, ERROR
- Do NOT use mesh for granular status updates
- Example: mesh.publish({ topic: 'task-done', text: 'DONE' })

### 2. GitHub Discussions - Information Only
- Use tell_information() **only** for meaningful, persistent information
- Do NOT use for status updates or completion notifications
- Only the **final agent** in a workflow should create a Discussion
- Example: tell_information(target, "Critical finding: X needs fix Y")

### 3. A2A Communication - Blocking/Inform Only
- Use ask_support() to request help/block on another agent
- Use tell_information() to send actual data/information to another agent
- Do NOT use for coordination - use mesh topics instead

### 4. Lead Governance
- The **lead agent** monitors all mesh topics
- The lead governs workflow sequencing
- The lead can broadcast corrections to all agents via mesh
- The lead can send specific corrections to individual agents via tell_information

### 5. Broadcasting Corrections
- Lead uses mesh.publish({ topic: 'broadcast', text: 'CORRECTION: ...' }) for all agents
- Lead uses tell_information(targetAgent, "Correction: ...") for specific agent
- Agents MUST respond to lead corrections immediately

### 6. Workflow Pattern
1. Lead publishes START to mesh
2. Agent receives START, does work
3. Agent publishes DONE to mesh (lifecycle only)
4. Next agent waits for DONE, then starts
5. Final agent creates ONE Discussion with summary
6. Lead verifies and publishes FINAL-DONE

### 7. No Redundant Communications
- ONE mesh message per lifecycle event per agent
- ONE Discussion per workflow (from final agent only)
- NO status updates via tell_information
- NO granular progress via mesh

### 8. Enforcement
- The communication layer enforces write-then-tell: creates Discussion BEFORE mesh notification
- Agents violating these rules will be killed and restarted
- Lead has authority to correct any agent's behavior
