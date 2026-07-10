import { strict as assert } from 'node:assert'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const CLI = fileURLToPath(new URL('../bin/cli.mjs', import.meta.url))
const URL_EXPECTED = 'https://api.ancher.ai/mcp'

let dir
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'ancher-agent-skills-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

// Run the installer in --project mode (writes into `dir`), never touching $HOME.
// ANCHER_API_TOKEN is stripped unless a test opts in, so the default is OAuth.
function cli(args, env = {}) {
  const clean = { ...process.env }
  delete clean.ANCHER_API_TOKEN
  const r = spawnSync(process.execPath, [CLI, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...clean, ...env },
  })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  return r
}

const readJson = (p) => JSON.parse(readFileSync(join(dir, p), 'utf8'))

test('install --project writes OAuth MCP config (no token) for Cursor and Claude', () => {
  cli(['install', '--agent', 'cursor,claude', '--project', '-y'])

  const cursor = readJson('.cursor/mcp.json')
  assert.equal(cursor.mcpServers.ancher.url, URL_EXPECTED)
  assert.equal(cursor.mcpServers.ancher.type, 'http')
  assert.equal(cursor.mcpServers.ancher.headers, undefined, 'OAuth default: no auth header')

  const claude = readJson('.mcp.json')
  assert.equal(claude.mcpServers.ancher.url, URL_EXPECTED)
  assert.equal(claude.mcpServers.ancher.headers, undefined)
})

test('install copies all four skills to each agent dir', () => {
  cli(['install', '--agent', 'cursor,claude,codex', '--project', '-y'])
  for (const root of ['.cursor/skills', '.claude/skills', '.agents/skills']) {
    for (const s of ['ancher', 'save-to-ancher', 'research-with-ancher', 'organize-ancher']) {
      assert.ok(existsSync(join(dir, root, s, 'SKILL.md')), `${root}/${s} missing`)
    }
  }
})

test('--token switches to the bearer form with the right per-agent syntax', () => {
  cli(['install', '--agent', 'cursor,claude', '--project', '--token', '-y'])
  assert.equal(
    readJson('.cursor/mcp.json').mcpServers.ancher.headers.Authorization,
    'Bearer ${env:ANCHER_API_TOKEN}',
  )
  assert.equal(
    readJson('.mcp.json').mcpServers.ancher.headers.Authorization,
    'Bearer ${ANCHER_API_TOKEN}',
  )
})

test('ANCHER_API_TOKEN in the env auto-selects the bearer form', () => {
  cli(['install', '--agent', 'cursor', '--project', '-y'], { ANCHER_API_TOKEN: 'x' })
  assert.match(
    readJson('.cursor/mcp.json').mcpServers.ancher.headers.Authorization,
    /ANCHER_API_TOKEN/,
  )
})

test('install merges into an existing mcp.json without clobbering other servers', () => {
  mkdirSync(join(dir, '.cursor'), { recursive: true })
  writeFileSync(
    join(dir, '.cursor/mcp.json'),
    JSON.stringify({ mcpServers: { other: { url: 'https://e.com' } } }),
  )
  cli(['install', '--agent', 'cursor', '--project', '-y'])
  const cfg = readJson('.cursor/mcp.json')
  assert.deepEqual(Object.keys(cfg.mcpServers).sort(), ['ancher', 'other'])
})

test('install is idempotent (running twice keeps a single ancher entry)', () => {
  cli(['install', '--agent', 'cursor', '--project', '-y'])
  cli(['install', '--agent', 'cursor', '--project', '-y'])
  assert.equal(Object.keys(readJson('.cursor/mcp.json').mcpServers).length, 1)
})

test('uninstall removes the ancher server and skills but leaves others', () => {
  mkdirSync(join(dir, '.cursor'), { recursive: true })
  writeFileSync(
    join(dir, '.cursor/mcp.json'),
    JSON.stringify({ mcpServers: { other: { url: 'https://e.com' } } }),
  )
  cli(['install', '--agent', 'cursor', '--project', '-y'])
  cli(['uninstall', '--agent', 'cursor', '--project', '-y'])
  const cfg = readJson('.cursor/mcp.json')
  assert.deepEqual(Object.keys(cfg.mcpServers), ['other'])
  assert.equal(existsSync(join(dir, '.cursor/skills/ancher')), false)
})

test('--print makes no filesystem changes', () => {
  cli(['install', '--agent', 'cursor,claude', '--project', '--print'])
  assert.equal(existsSync(join(dir, '.cursor/mcp.json')), false)
  assert.equal(existsSync(join(dir, '.mcp.json')), false)
})

test('--help exits 0 and describes the auth default', () => {
  const r = spawnSync(process.execPath, [CLI, '--help'], { cwd: dir, encoding: 'utf8' })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /OAuth/)
})

test('install leaves an unparseable mcp.json untouched but still copies skills', () => {
  mkdirSync(join(dir, '.cursor'), { recursive: true })
  writeFileSync(join(dir, '.cursor/mcp.json'), '{ not json')

  cli(['install', '--agent', 'cursor', '--project', '-y'])

  assert.equal(readFileSync(join(dir, '.cursor/mcp.json'), 'utf8'), '{ not json')
  assert.ok(existsSync(join(dir, '.cursor/skills/ancher/SKILL.md')))
})

// User-scope Codex installs must land where Codex actually loads user skills:
// $CODEX_HOME/skills (default ~/.codex/skills) — NOT ~/.agents/skills, which
// is only the project-scope cross-agent standard dir.
test('codex user scope installs skills under ~/.codex, not ~/.agents', () => {
  // PATH is emptied so the `codex` binary is never found and the installer
  // takes the deterministic config.toml fallback inside the fake HOME.
  cli(['install', '--agent', 'codex', '-y'], { HOME: dir, PATH: '/nonexistent' })

  assert.ok(existsSync(join(dir, '.codex/skills/ancher/SKILL.md')))
  assert.ok(!existsSync(join(dir, '.agents')))
  assert.match(readFileSync(join(dir, '.codex/config.toml'), 'utf8'), /\[mcp_servers\.ancher\]/)
})

test('CODEX_HOME overrides the codex skills and config destination', () => {
  const codexHome = join(dir, 'custom-codex')
  cli(['install', '--agent', 'codex', '-y'], {
    HOME: dir,
    CODEX_HOME: codexHome,
    PATH: '/nonexistent',
  })

  assert.ok(existsSync(join(codexHome, 'skills/ancher/SKILL.md')))
  assert.match(readFileSync(join(codexHome, 'config.toml'), 'utf8'), /\[mcp_servers\.ancher\]/)
})
