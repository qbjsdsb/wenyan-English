/** Produce a complete, secret-free deploy payload. This does not deploy or authenticate. */
import fs from 'node:fs'
import path from 'node:path'
const entrypoint = 'supabase/functions/wenyan-english-mcp/index.ts'
const importMap = 'supabase/functions/wenyan-english-mcp/deno.json'
const files = new Map()
function include(name) {
  if (files.has(name)) return
  if (!name.startsWith('src/') && !name.startsWith('supabase/functions/wenyan-english-mcp/')) throw new Error(`Unexpected source path: ${name}`)
  const content = fs.readFileSync(name, 'utf8')
  files.set(name, content)
  if (name.endsWith('.json')) return
  for (const match of content.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), match[1]))
    const resolved = [target, `${target}.ts`, `${target}.js`, `${target}/index.ts`].find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile())
    if (!resolved) throw new Error(`Unresolved relative dependency: ${name} -> ${match[1]}`)
    include(resolved)
  }
}
include(entrypoint)
include(importMap)
process.stdout.write(JSON.stringify({
  project_id: 'cmjhxvpkdeheujuteqoi', name: 'wenyan-english-mcp',
  entrypoint_path: entrypoint, import_map_path: importMap,
  // Existing OAuth resource server verifies its own JWT; do not enable legacy gateway verification.
  verify_jwt: false,
  files: Array.from(files, ([name, content]) => ({ name, content })).sort((a, b) => a.name.localeCompare(b.name)),
}, null, 2) + '\n')
