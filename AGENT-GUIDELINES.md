# AGENT-GUIDELINES.md

## Rules for Fabric Agents

1. **Use pi.bash directly, never fabric_exec**
   - Always use `pi.bash({cmd: "..."})` for shell commands
   - Do not use `fabric_exec` as a tool
   - This ensures proper Fabric context handling

2. **Import modules directly, never spawn node**
   - Use ES module imports: `import { function } from 'module.mjs'`
   - Never use `child_process.spawn('node', ...)` to run JavaScript
   - Direct imports are more efficient and maintain proper context

3. **Use strings parameter for complex code in fabric_exec**
   - When using `fabric_exec`, pass complex code through the `strings` parameter
   - Use `π.key` to reference named strings in your code
   - This avoids quoting issues and improves readability

4. **Additional Best Practices**
   - Keep files small (max ~200 lines)
   - Prefer many small focused files over fewer large ones
   - No duplicated logic
   - Code is written to be read

## Validation Checklist

- [ ] lib/executor.mjs exists and exports bash()
- [ ] bash() works in Fabric context
- [ ] discussions.mjs imports from executor
- [ ] communication layer imports discussions.mjs
- [ ] AGENT-GUIDELINES.md created with all rules