# Design

Why this repo is shaped the way it is, and what to verify before a wide release.

## Goal

One open-source artifact that lets any coding agent use Ancher agentically,
covering the three agents our users actually run: **Claude Code**, **OpenAI
Codex**, and **Cursor**. "Use Ancher" means two things the agent needs together:

1. **Knowledge** — *when* to reach for Ancher and *how* its tools compose (skills).
2. **Tools** — the actual capability to act (the Ancher MCP server).

## The central decision: bundle the MCP with the skills

The load-bearing dependency is the **MCP server, not the CLI.** Ancher's MCP is
**hosted** (`https://api.ancher.ai/mcp`, streamable-HTTP, OAuth2 or bearer
token), so bundling it in each plugin means *installing the skills also installs
a working, authenticated tool path* — with nothing to run locally and no CLI
required. This is what dissolves the "installed the skills but the `ancher` CLI
isn't on PATH" problem: the skills drive MCP tools, and the MCP travels with
them.

The skills still degrade gracefully when the MCP isn't present: each one carries
a routing ladder — **prefer the Ancher MCP tools → else the `ancher` CLI on PATH
→ else `npx -y @ancher-ai/cli` → else print the exact setup command.** They never
dead-end, and they never hard-code a bare `ancher` invocation.

The CLI (`@ancher-ai/cli`) and SDK (`@ancher-ai/sdk`) remain the human and programmatic
layers. This repo is deliberately *only* the agent layer.

## Distribution model

The proven pattern (PostHog, Sentry, Stripe, GitHub, Neon, …) is a **git-based
plugin marketplace per agent**, not an npm package and not a CLI subcommand. So:

- **Primary:** each agent's native plugin + marketplace, installed straight from
  this git repo. Zero npm.
- **Secondary (reach/convenience):** the `npx @ancher-ai/agent-skills` installer for
  people who'd rather run one command, and for the ~40 other agents that read
  `.agents/skills` / `.mcp.json`. npm is a *reach layer with capability attached*
  (it also writes the MCP config) — **never** a bare skills package, and **never**
  a `postinstall` that mutates `~/.claude` or `~/.codex` (a documented security
  anti-pattern that's also silently skipped under pnpm≥10 / Bun / `--ignore-scripts`).
- **Optional:** an `ancher init` subcommand *in the CLI repo* (not here) for users
  who already have the CLI — the Neon pattern. Out of scope for this repo.

## One skill set, three plugin manifests, three MCP files

**Skills are byte-identical across agents.** Claude Code, Codex, and Cursor all
read the same `SKILL.md` (Agent Skills spec — only `name` + `description` are
required). We author each skill once in `plugins/ancher/skills/`; all three
plugin installs read it in place. No generation, no per-agent skill copies.
(Claude Code understands extra frontmatter — `allowed-tools`, `context: fork`,
etc. — that Codex/Cursor ignore; we keep the skill bodies portable and avoid
depending on those.)

**The MCP config is *not* portable** — the three agents disagree:

| Agent | File | Server-map shape | Auth field | Env syntax |
|---|---|---|---|---|
| Claude Code | `.mcp.json` | bare map `{ "ancher": {…} }` | `headers.Authorization` | `${ANCHER_API_TOKEN}` |
| Cursor | `mcp.json` | `{ "mcpServers": { "ancher": {…} } }` | `headers.Authorization` | `${env:ANCHER_API_TOKEN}` |
| Codex | `.mcp.codex.json` | `{ "mcp_servers": { "ancher": {…} } }` | `bearer_token_env_var` (name only) | n/a — references the env-var name |

So each agent gets its own MCP file, all pointing at the same endpoint.
`scripts/check.mjs` enforces that they stay in agreement on URL and token.

**Two marketplace catalogs.** Claude Code reads `.claude-plugin/marketplace.json`
(string `source`, `owner`); Codex and Cursor both read
`.agents/plugins/marketplace.json` (`source: {source:"local", path}`, `policy`,
`interface`). The per-entry schemas differ enough that one file can't serve both,
so we ship both. The plugin itself lives once at `plugins/ancher/`.

## Layout choices

- **Nested `plugins/ancher/`** (marketplace at the repo root, plugin in a subdir)
  rather than a root-level plugin — it's the unambiguous, Anthropic-official
  shape, and it leaves room to add sibling plugins later without moving anything.
- **`.mcp.json` is a separate file**, never inline `mcpServers` in `plugin.json`
  — inline is silently stripped by Claude Code
  ([anthropics/claude-code#16143](https://github.com/anthropics/claude-code/issues/16143)).
- **Bare server map** in the Claude `.mcp.json` to match the real shipped official
  plugins (context7, github). The `{ "mcpServers": … }` wrapper also works there;
  the bare map is the shorthand those plugins use.

## Auth — OAuth-first

The default is **MCP OAuth with no pre-provisioned token**: the agent opens a
browser on first use, and the whole discovery → registration → consent → token
flow happens automatically. This is verified end-to-end in the API:

- `GET /.well-known/oauth-protected-resource/mcp` (RFC 9728) — returned in the
  `WWW-Authenticate` header on a 401 from `/mcp`; points at the auth server.
- `GET /.well-known/oauth-authorization-server` (RFC 8414) — advertises
  `authorization_endpoint`, `token_endpoint`, and `registration_endpoint`
  (`/oauth2/register`).
- `POST /oauth2/register` (RFC 7591) — **open Dynamic Client Registration**,
  defaulting to `token_endpoint_auth_method: "none"` (public/PKCE — "the default
  for MCP/CLI"). So agents self-register; no client needs to be pre-provisioned.

Because DCR works, the bundled configs carry **no static token** — cleanest
install, nothing to obtain. Claude Code and Cursor run the OAuth flow
automatically on connect; Codex needs one command, `codex mcp login ancher`.

The MCP middleware *also* accepts an API key / session / OAuth bearer token, so
for **CI / non-interactive** use, set `ANCHER_API_TOKEN` and use the bearer-token
config variant. The installer switches to that form automatically when
`ANCHER_API_TOKEN` is present, or on `--token`:

| Agent | Bearer form |
|---|---|
| Claude Code | `headers: { "Authorization": "Bearer ${ANCHER_API_TOKEN}" }` |
| Cursor | `headers: { "Authorization": "Bearer ${env:ANCHER_API_TOKEN}" }` |
| Codex | `bearer_token_env_var = "ANCHER_API_TOKEN"` |

## Open questions to verify before a wide release

1. ~~Does the MCP OAuth path support Dynamic Client Registration?~~ **Confirmed**
   — `POST /oauth2/register` is open DCR (RFC 7591) and the RFC 8414 metadata
   advertises it (see *Auth* above). Worth a live smoke test of the full
   401 → discovery → register → PKCE → token flow from each agent before launch,
   but the server side is in place.
2. **Is the full Ancher surface reachable through the MCP alone?** If some
   capabilities only exist in the CLI, the skills must route those specific tasks
   to the CLI with an install prompt. Today the skills assume MCP-first with a CLI
   fallback for everything.
3. **Codex remote-MCP-in-plugin JSON shape** (`.mcp.codex.json`: `url` +
   `bearer_token_env_var`) is inferred from Codex's `config.toml` field names, not
   byte-verified against a shipped Codex plugin. Verify with the installed Codex
   version; the standalone `codex mcp add … --url … --bearer-token-env-var …`
   one-liner *is* verified and is the reliable fallback.
4. **Non-interactive `codex plugin add <name>`** isn't confirmed in the official
   docs (only the interactive `/plugins` browser is). The README uses the
   interactive flow; script it only after checking `codex plugin --help`.
5. **Version floors.** Cursor streamable-HTTP MCP needs Cursor ≥ 0.48; Cursor
   plugins and Codex plugins are recent additions. Pin minimums once known.
6. **GitHub org/repo slug.** Manifests and the README assume
   `streamify-one/ancher-agent-skills`; update if the repo lands elsewhere (it's
   referenced in `plugin.json` `repository`, both marketplace files' install
   commands, and the README).
