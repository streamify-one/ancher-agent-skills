#!/usr/bin/env node
// Repo consistency gate — run in CI. Validates that every skill has the
// required frontmatter and matches its directory, that all three MCP config
// files agree on the endpoint, and that every manifest and marketplace file
// parses and points at a real plugin. Pure Node built-ins.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PLUGIN = join(ROOT, 'plugins', 'ancher')
const EXPECTED_URL = 'https://api.ancher.ai/mcp'

const errors = []
const err = m => errors.push(m)
// A missing/malformed JSON file becomes a path-specific error and an empty
// object, so every remaining check still runs and all problems report at once.
const readJson = p => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch (e) {
    err(`${relative(ROOT, p)}: ${e.message}`)
    return {}
  }
}

// 1. Skills: SKILL.md exists, has name + description, name == dir name.
const skillsDir = join(PLUGIN, 'skills')
const skills = []
if (existsSync(skillsDir)) {
  skills.push(...readdirSync(skillsDir).filter(d => statSync(join(skillsDir, d)).isDirectory()))
  if (!skills.length) err('no skills found')
} else {
  err(`${relative(ROOT, skillsDir)}: skills directory missing`)
}
for (const dir of skills) {
  const file = join(skillsDir, dir, 'SKILL.md')
  if (!existsSync(file)) {
    err(`${dir}: missing SKILL.md`)
    continue
  }
  const text = readFileSync(file, 'utf8')
  const fm = text.match(/^---\n([\s\S]*?)\n---/)
  if (!fm) {
    err(`${dir}: missing YAML frontmatter`)
    continue
  }
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim()
  const hasDesc = /^description:\s*(.+|>-?|\|)/m.test(fm[1])
  if (!name) err(`${dir}: frontmatter missing "name"`)
  else if (name !== dir) err(`${dir}: name "${name}" != directory "${dir}"`)
  if (!hasDesc) err(`${dir}: frontmatter missing "description"`)
}

// 2. MCP config files all point at the same endpoint, each in its native shape.
const claudeMcp = readJson(join(PLUGIN, '.mcp.json'))
if (claudeMcp.ancher?.url !== EXPECTED_URL) err(`.mcp.json url != ${EXPECTED_URL}`)
if (claudeMcp.ancher?.type !== 'http') err('.mcp.json: type must be "http"')

const cursorMcp = readJson(join(PLUGIN, 'mcp.json'))
if (cursorMcp.mcpServers?.ancher?.url !== EXPECTED_URL) err(`mcp.json url != ${EXPECTED_URL}`)
if (cursorMcp.mcpServers?.ancher?.type !== 'http') err('mcp.json (Cursor): type must be "http"')

const codexMcp = readJson(join(PLUGIN, '.mcp.codex.json'))
if (codexMcp.mcp_servers?.ancher?.url !== EXPECTED_URL)
  err(`.mcp.codex.json url != ${EXPECTED_URL}`)

// Auth defaults to OAuth (no static token). If a config opts into a bearer
// token instead, it must reference ANCHER_API_TOKEN — never a hard-coded secret.
const claudeAuth = claudeMcp.ancher?.headers?.Authorization ?? ''
const cursorAuth = cursorMcp.mcpServers?.ancher?.headers?.Authorization ?? ''
if (claudeAuth && !claudeAuth.includes('${ANCHER_API_TOKEN}'))
  err('.mcp.json: Authorization must use ${ANCHER_API_TOKEN}')
if (cursorAuth && !cursorAuth.includes('${env:ANCHER_API_TOKEN}'))
  err('mcp.json (Cursor): Authorization must use ${env:ANCHER_API_TOKEN}')
const codexBearer = codexMcp.mcp_servers?.ancher?.bearer_token_env_var
if (codexBearer && codexBearer !== 'ANCHER_API_TOKEN')
  err('.mcp.codex.json: bearer_token_env_var must be ANCHER_API_TOKEN')

// 3. Manifests parse and name the plugin "ancher".
for (const m of [
  '.claude-plugin/plugin.json',
  '.codex-plugin/plugin.json',
  '.cursor-plugin/plugin.json',
]) {
  const j = readJson(join(PLUGIN, m))
  if (j.name !== 'ancher') err(`${m}: name must be "ancher"`)
}

// 4. Marketplaces parse and their plugin source resolves to the plugin dir.
const claudeMkt = readJson(join(ROOT, '.claude-plugin', 'marketplace.json'))
const claudeSrc = claudeMkt.plugins?.[0]?.source
if (claudeSrc !== './plugins/ancher')
  err(`claude marketplace source "${claudeSrc}" != ./plugins/ancher`)

// The declared `skills` array exists for the `skills` CLI (vercel-labs/skills,
// `npx skills add`): it puts us on that CLI's documented plugin-manifest
// discovery instead of its recursive fallback scan, since plugins/ancher/skills
// is not one of its standard discovery roots. Claude Code would not notice the
// list going stale — for a non-marketplace-root `source` the field only ADDS to
// the default skills/ scan — so pin it to the directory listing here. Without
// this, a fifth skill lands invisible to `npx skills add` with nothing failing.
const declaredSkills = claudeMkt.plugins?.[0]?.skills
const expectedSkills = skills.map(d => `./skills/${d}`).sort()
if (!Array.isArray(declaredSkills)) {
  err('claude marketplace: plugin entry missing a "skills" array')
} else {
  // Compare structurally rather than on a delimiter-joined string: a directory
  // name may legally contain whatever delimiter we picked, which would let two
  // different lists compare equal.
  const sortedDeclared = [...declaredSkills].sort()
  if (JSON.stringify(sortedDeclared) !== JSON.stringify(expectedSkills))
    err(
      `claude marketplace skills ${JSON.stringify(sortedDeclared)} != on-disk ${JSON.stringify(expectedSkills)}`
    )
}

const agentsMkt = readJson(join(ROOT, '.agents', 'plugins', 'marketplace.json'))
const agentsSrc = agentsMkt.plugins?.[0]?.source?.path
if (agentsSrc !== './plugins/ancher')
  err(`.agents marketplace source "${agentsSrc}" != ./plugins/ancher`)

if (errors.length) {
  console.error('✗ check failed:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}
console.log(`✓ ok — ${skills.length} skills, 3 MCP configs, 3 manifests, 2 marketplaces consistent`)
