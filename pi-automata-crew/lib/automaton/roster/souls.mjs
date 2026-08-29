import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export function loadRoster(name) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const filePath = join(__dirname, 'souls', `${name}.md`);
  if (!existsSync(filePath)) {
    throw new Error(`Soul file not found: ${filePath}`);
  }
  const content = readFileSync(filePath, 'utf8');
  const metadata = parseSoulContent(content)
  return { name, ...metadata }
}
function parseSoulContent(content) {
  const frontmatterMatch = content.match(/^---[\s\S]*?---/s)
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[0]
    const result = {}
    const lines = frontmatter.split('\n')
    for (const line of lines) {
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()
        result[key] = value
      }
    }
    return result
  }
  const roleMatch = content.match(/^#s+(.+)$/m)
  const role = roleMatch ? roleMatch[1] : ''
  return { role }
}
