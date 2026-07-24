---
name: hall-route
description: Specialist routing rationale. Old Major reads this when assigning tasks to Hall specialists before dispatch.
---

# Specialist Routing Rationale

## Specialist roster

Specialist summaries (scope, domain, roles) are in `~/.hall/agent-index.json`, built at session open. When domain match is uncertain, fetch the full persona on-demand: call `get_file_contents` MCP (owner=`$ORG`, repo=`hall-of-automata`, path=`roster/<name>.md`).

Do not hardcode specialist names. Always read the current roster.

## Assignment heuristics

**Language is the primary signal for implementation tasks.** Match the task's primary language/technology to the specialist whose domain covers it.

**CI/CD is its own domain regardless of language.** A GitHub Actions workflow change for any project goes to the CI/CD specialist.

**For tasks spanning domains, assign by dominant work.** A task that's 80% Python with a small CI change goes to the Python specialist.

**Advisory specialists take advisory or research tasks.** Implementation touching their domain still goes to an implementation specialist — advisory specialists are for analysis, not implementation.

## Rationale format

In the dispatch confirmation summary, one sentence per assignment:
> "<Specialist>: pure Python service logic, no frontend surface, no infrastructure changes."

In the issue body, include a `## Routing` section:

```markdown
## Routing

Assigned to <Specialist>. Rationale: this task implements <description> with no <out-of-domain surfaces>. Dominant work is <domain>.
```

Do not explain the Hall's mechanics to the specialist — they already know them. Keep routing rationale to why this specialist is right for this work.

## Local consultation overlay

When Old Major invokes a specialist as a local subagent, render their overlay immediately before invocation:

```python
import os
plugin_root = (os.environ.get('CLAUDE_PLUGIN_ROOT') or
               open(os.path.expanduser('~/.hall/plugin-root')).read().strip())
cache_root = os.path.expanduser('~/.hall')
org = open(os.path.expanduser('~/.hall/session/.repo-slug')).read().strip().split('/')[0]
specialist = '<NAME>'  # substitute the chosen specialist's name
os.makedirs(f'{cache_root}/claude-agents', exist_ok=True)
with open(f'{plugin_root}/templates/subagent-overlay.md.tpl') as f:
    tpl = f.read()
with open(f'{cache_root}/claude-agents/{specialist}.md', 'w') as f:
    f.write(tpl.replace('{{SPECIALIST_NAME}}', specialist)
               .replace('{{ORG}}', org)
               .replace('{{CACHE_ROOT}}', cache_root))
```

Run once per specialist needed per session. Safe to re-run; the file is idempotent.
