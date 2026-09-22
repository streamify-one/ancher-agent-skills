#!/usr/bin/env node
// Ancher agent-skills installer.
//
// Configures the Ancher MCP server and installs the Ancher skills for the
// coding agents found on this machine (Claude Code, OpenAI Codex, Cursor).
// Each agent gets its config in ITS OWN native shape — the MCP field names and
// env-var syntax differ across the three. Pure Node built-ins, no dependencies.
//
//   npx @ancher-ai/agent-skills install [--agent claude,codex,cursor] [--project] [--print] [--yes]
//   npx @ancher-ai/agent-skills uninstall [--agent ...] [--project]
//
// Default scope is the user's home config; --project writes into the current
// directory so the setup can be committed to a repo.

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER = 'ancher'
const URL = 'https://api.ancher.ai/mcp'
const TOKEN_ENV = 'ANCHER_API_TOKEN'
const AGENTS = ['claude', 'codex', 'cursor']

const HERE = dirname(fileURLToPath(import.meta.url))
const SKILLS_SRC = join(HERE, '..', 'plugins', 'ancher', 'skills')
const HOME = homedir()
// Codex resolves its user config/skills under $CODEX_HOME (default ~/.codex).
const codexHome = () => process.env.CODEX_HOME || join(HOME, '.codex')

const c = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s)
const ok = s => console.log(`${c('32', '✓')} ${s}`)
const info = s => console.log(`  ${s}`)
const warn = s => console.log(`${c('33', '!')} ${s}`)
const head = s => console.log(`\n${c('1', s)}`)

// ---- args ------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { agent: null, project: false, print: false, yes: false, auth: null }
  let cmd = 'install'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === 'install' || a === 'uninstall') cmd = a
    else if (a === '--agent' || a === '-a') flags.agent = argv[++i]
    else if (a === '--project' || a === '-p') flags.project = true
    else if (a === '--print' || a === '--dry-run') flags.print = true
    else if (a === '--yes' || a === '-y') flags.yes = true
    else if (a === '--oauth') flags.auth = 'oauth'
    else if (a === '--token') flags.auth = 'token'
    else if (a === '--help' || a === '-h') cmd = 'help'
    else warn(`Ignoring unknown argument: ${a}`)
  }
  // Default: OAuth (browser login, no token). Use the bearer-token form only
  // when explicitly asked, or when ANCHER_API_TOKEN is already in the env (CI).
  flags.useToken = flags.auth ? flags.auth === 'token' : Boolean(process.env[TOKEN_ENV])
  return { cmd, flags }
}

function selectedAgents(flags) {
  if (flags.agent) {
    const chosen = flags.agent.split(',').map(s => s.trim().toLowerCase())
    const bad = chosen.filter(a => !AGENTS.includes(a))
    if (bad.length) fail(`Unknown agent(s): ${bad.join(', ')}. Valid: ${AGENTS.join(', ')}`)
    return chosen
  }
  const detected = AGENTS.filter(detect)
  if (!detected.length) {
    warn('No Claude Code / Codex / Cursor install detected.')
    info(`Pass --agent to target one anyway, e.g. --agent cursor`)
  }
  return detected
}

const has = bin => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0
const detect = agent =>
  ({
    claude: () => existsSync(join(HOME, '.claude')) || has('claude'),
    codex: () => existsSync(join(HOME, '.codex')) || has('codex'),
    cursor: () => existsSync(join(HOME, '.cursor')),
  })[agent]()

// ---- fs / json helpers -----------------------------------------------------

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    warn(`Could not parse ${path} — leaving it untouched.`)
    return null
  }
}

function writeJson(path, obj, print) {
  if (print) return info(`would write ${path}`)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(obj, null, 2)}\n`)
}

function copySkills(destRoot, print) {
  if (print) return info(`would copy skills → ${destRoot}/`)
  mkdirSync(destRoot, { recursive: true })
  cpSync(SKILLS_SRC, destRoot, { recursive: true })
}

function removeSkills(destRoot, print) {
  for (const name of ['ancher', 'save-to-ancher', 'research-with-ancher', 'organize-ancher']) {
    const dir = join(destRoot, name)
    if (!existsSync(dir)) continue
    if (print) info(`would remove ${dir}`)
    else rmSync(dir, { recursive: true, force: true })
  }
}

const fail = s => {
  console.error(`${c('31', 'error')} ${s}`)
  process.exit(1)
}

// ---- per-agent install -----------------------------------------------------

// Cursor: dedicated small mcp.json we can safely merge; ${env:VAR} syntax.
function installCursor(flags) {
  head('Cursor')
  const mcpPath = flags.project
    ? join(process.cwd(), '.cursor', 'mcp.json')
    : join(HOME, '.cursor', 'mcp.json')
  const skillsRoot = flags.project
    ? join(process.cwd(), '.cursor', 'skills')
    : join(HOME, '.cursor', 'skills')
  const cfg = readJson(mcpPath, {})
  if (cfg === null) {
    warn(`Skipping the MCP config — fix or remove ${mcpPath} and re-run.`)
  } else {
    cfg.mcpServers = cfg.mcpServers || {}
    cfg.mcpServers[SERVER] = flags.useToken
      ? { type: 'http', url: URL, headers: { Authorization: `Bearer \${env:${TOKEN_ENV}}` } }
      : { type: 'http', url: URL }
    writeJson(mcpPath, cfg, flags.print)
    ok(`MCP server "${SERVER}" → ${mcpPath}`)
  }
  copySkills(skillsRoot, flags.print)
  ok(`skills → ${skillsRoot}/`)
}

// Claude Code: prefer the CLI (owns ~/.claude.json); ${VAR} syntax.
function installClaude(flags) {
  head('Claude Code')
  const skillsRoot = flags.project
    ? join(process.cwd(), '.claude', 'skills')
    : join(HOME, '.claude', 'skills')
  copySkills(skillsRoot, flags.print)
  ok(`skills → ${skillsRoot}/`)

  const serverJson = JSON.stringify(
    flags.useToken
      ? { type: 'http', url: URL, headers: { Authorization: `Bearer \${${TOKEN_ENV}}` } }
      : { type: 'http', url: URL }
  )
  if (flags.project) {
    const mcpPath = join(process.cwd(), '.mcp.json')
    const cfg = readJson(mcpPath, {})
    if (cfg === null) {
      return warn(`Skipping the MCP config — fix or remove ${mcpPath} and re-run.`)
    }
    cfg.mcpServers = cfg.mcpServers || {}
    cfg.mcpServers[SERVER] = JSON.parse(serverJson)
    writeJson(mcpPath, cfg, flags.print)
    ok(`MCP server "${SERVER}" → ${mcpPath} (project scope)`)
    return
  }
  if (flags.print) return info(`would run: claude mcp add-json ${SERVER} -s user '${serverJson}'`)
  if (has('claude')) {
    const r = spawnSync('claude', ['mcp', 'add-json', SERVER, '-s', 'user', serverJson], {
      stdio: 'ignore',
    })
    if (r.status === 0) return ok(`MCP server "${SERVER}" added at user scope`)
  }
  warn('Could not add the MCP server automatically. Run this yourself:')
  info(`claude mcp add-json ${SERVER} -s user '${serverJson}'`)
}

// Codex: prefer the CLI (owns ~/.codex/config.toml); references the token env
// var by NAME (bearer_token_env_var), it does not interpolate into a header.
function installCodex(flags) {
  head('Codex')
  // Project scope uses the cross-agent `.agents/skills` standard dir; user
  // scope must be Codex's own skills dir — Codex loads user skills from
  // $CODEX_HOME/skills (default ~/.codex/skills), not ~/.agents/skills.
  const skillsRoot = flags.project
    ? join(process.cwd(), '.agents', 'skills')
    : join(codexHome(), 'skills')
  copySkills(skillsRoot, flags.print)
  ok(`skills → ${skillsRoot}/`)

  const bearerLine = flags.useToken ? `\nbearer_token_env_var = "${TOKEN_ENV}"` : ''
  const tomlBlock = `\n[mcp_servers.${SERVER}]\nurl = "${URL}"${bearerLine}\n`
  const addArgs = [
    'mcp',
    'add',
    SERVER,
    '--url',
    URL,
    ...(flags.useToken ? ['--bearer-token-env-var', TOKEN_ENV] : []),
  ]
  const addCmd = `codex ${addArgs.join(' ')}`
  const loginNote = () => {
    if (!flags.useToken) info(`Log in once with:  codex mcp login ${SERVER}`)
    info('Restart Codex to pick up the new server.')
  }
  // Codex MCP servers are user-scoped (~/.codex/config.toml) — there is no
  // project-local MCP config. In --project mode, don't touch the user's global
  // config silently; hand them the command instead.
  if (flags.project) {
    warn('Codex has no project-scoped MCP config; add the server globally with:')
    info(addCmd)
    if (!flags.useToken) info(`then:  codex mcp login ${SERVER}`)
    return
  }
  if (flags.print) return info(`would run: ${addCmd}`)
  if (has('codex')) {
    const r = spawnSync('codex', addArgs, { stdio: 'ignore' })
    if (r.status === 0) {
      ok(`MCP server "${SERVER}" added to ~/.codex/config.toml`)
      return loginNote()
    }
  }
  // Fallback: append the block to config.toml if not already present.
  const tomlPath = join(codexHome(), 'config.toml')
  const existing = existsSync(tomlPath) ? readFileSync(tomlPath, 'utf8') : ''
  if (existing.includes(`[mcp_servers.${SERVER}]`)) {
    ok(`MCP server "${SERVER}" already in ${tomlPath}`)
  } else {
    mkdirSync(dirname(tomlPath), { recursive: true })
    writeFileSync(tomlPath, existing + tomlBlock)
    ok(`MCP server "${SERVER}" → ${tomlPath}`)
  }
  loginNote()
}

// ---- per-agent uninstall ---------------------------------------------------

function uninstall(agents, flags) {
  for (const agent of agents) {
    head(agent)
    if (agent === 'cursor') {
      const mcpPath = flags.project
        ? join(process.cwd(), '.cursor', 'mcp.json')
        : join(HOME, '.cursor', 'mcp.json')
      dropMcpJson(mcpPath, flags.print)
      removeSkills(
        flags.project ? join(process.cwd(), '.cursor', 'skills') : join(HOME, '.cursor', 'skills'),
        flags.print
      )
    } else if (agent === 'claude') {
      if (flags.project) dropMcpJson(join(process.cwd(), '.mcp.json'), flags.print)
      else if (has('claude') && !flags.print)
        spawnSync('claude', ['mcp', 'remove', SERVER, '-s', 'user'], { stdio: 'ignore' })
      else info(`run: claude mcp remove ${SERVER} -s user`)
      removeSkills(
        flags.project ? join(process.cwd(), '.claude', 'skills') : join(HOME, '.claude', 'skills'),
        flags.print
      )
    } else if (agent === 'codex') {
      if (has('codex') && !flags.print)
        spawnSync('codex', ['mcp', 'remove', SERVER], { stdio: 'ignore' })
      else
        info(
          `run: codex mcp remove ${SERVER}  (or delete [mcp_servers.${SERVER}] from ~/.codex/config.toml)`
        )
      removeSkills(
        flags.project ? join(process.cwd(), '.agents', 'skills') : join(codexHome(), 'skills'),
        flags.print
      )
    }
    ok('removed')
  }
}

function dropMcpJson(path, print) {
  const cfg = readJson(path, null)
  if (!cfg?.mcpServers?.[SERVER]) return
  if (print) return info(`would remove "${SERVER}" from ${path}`)
  delete cfg.mcpServers[SERVER]
  writeJson(path, cfg, false)
}

// ---- main ------------------------------------------------------------------

const HELP = `Ancher agent-skills installer

Usage:
  npx @ancher-ai/agent-skills install   [options]   Configure Ancher for your agents
  npx @ancher-ai/agent-skills uninstall [options]   Remove it again

Options:
  -a, --agent <list>   Comma-separated: claude,codex,cursor (default: auto-detect)
  -p, --project        Write into the current directory instead of your home config
      --oauth          Use MCP OAuth (browser login, no token) — the default
      --token          Use a bearer token (${TOKEN_ENV}) instead — good for CI
      --print          Show what would happen without changing anything
  -y, --yes            Don't prompt
  -h, --help           This help

Auth (default OAuth): your agent logs in via browser on first use — no token
needed, since Ancher supports MCP OAuth with dynamic client registration. For
CI/non-interactive, set ${TOKEN_ENV} (or pass --token) for bearer auth.
MCP server: ${URL}.`

function main() {
  const { cmd, flags } = parseArgs(process.argv.slice(2))
  if (cmd === 'help') return console.log(HELP)

  const agents = selectedAgents(flags)
  if (!agents.length) return

  console.log(
    `${cmd === 'install' ? 'Installing' : 'Uninstalling'} Ancher for: ${c('1', agents.join(', '))}${
      flags.project ? ' (project scope)' : ''
    }${flags.print ? c('33', '  [print only]') : ''}`
  )

  if (cmd === 'uninstall') {
    uninstall(agents, flags)
  } else {
    const install = { cursor: installCursor, claude: installClaude, codex: installCodex }
    for (const agent of agents) install[agent](flags)
    head('Next steps')
    if (flags.useToken)
      info(`1. Ensure ${TOKEN_ENV} is set:  export ${TOKEN_ENV}=<your Ancher API token>`)
    else
      info(
        '1. First use opens a browser to log in to Ancher — no token needed (Codex: run `codex mcp login ancher`).'
      )
    info(
      '2. Restart the agent if needed (Codex requires a restart; Claude Code hot-reloads skills).'
    )
    info('3. Ask it to "search my Ancher notes" to confirm the tools are live.')
  }
}

main()
