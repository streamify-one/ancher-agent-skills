# Ancher Agent Skills

[![npm](https://img.shields.io/npm/v/@ancher-ai/agent-skills)](https://www.npmjs.com/package/@ancher-ai/agent-skills)

Teach your coding agent to use **[Ancher](https://ancher.ai)** — your personal
knowledge base and research assistant. This one repo is, at the same time, a
**Claude Code** plugin marketplace, an **OpenAI Codex** plugin marketplace, and a
**Cursor** plugin — bundling a small set of skills with the hosted Ancher MCP
server. Installing it gives the agent both the *know-how* (skills) and the
*tools* (MCP), in one step.

- **Skills** teach the agent when and how to capture, search, read, organize, and
  reason over your Ancher notes, collections, tags, and artifacts.
- **The MCP server** (`https://api.ancher.ai/mcp`) gives it the tools to actually
  do it — `ask`, `retrieve_notes`, `create_note_from_text`, and more. It's hosted, so there's
  nothing to run locally.

The Ancher [CLI](https://www.npmjs.com/package/@ancher-ai/cli) (`@ancher-ai/cli`) and
[SDK](https://www.npmjs.com/package/@ancher-ai/sdk) (`@ancher-ai/sdk`) are the
human/programmatic layers; this repo is the *agent* layer.

## Install

Pick your agent. Every path below is free of any local server — the MCP is
hosted. You'll need Ancher auth (see [Authentication](#authentication)).

### Claude Code

```bash
/plugin marketplace add streamify-one/ancher-agent-skills
/plugin install ancher@ancher-agent-skills
```

### OpenAI Codex

```bash
codex plugin marketplace add streamify-one/ancher-agent-skills
# then run `codex`, open `/plugins`, and install "ancher"
```

Or just the MCP server:

```bash
codex mcp add ancher --url https://api.ancher.ai/mcp
codex mcp login ancher      # browser OAuth (or use a token — see Authentication)
```

### Cursor

One click (adds the MCP server; you'll be prompted to log in):

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=ancher&config=eyJ1cmwiOiJodHRwczovL2FwaS5hbmNoZXIuYWkvbWNwIn0%3D)

For the skills too, install the plugin from **Cursor → Settings → Plugins**
(point it at this repo), or use the cross-agent installer below.

### Any agent (cross-agent installer)

Configures whichever of Claude Code / Codex / Cursor it finds, each in its native
format:

```bash
npx @ancher-ai/agent-skills install            # auto-detect installed agents
npx @ancher-ai/agent-skills install --agent cursor,codex
npx @ancher-ai/agent-skills install --project  # write into ./ (commit to a repo)
npx @ancher-ai/agent-skills install --print    # dry run
npx @ancher-ai/agent-skills uninstall
```

## Authentication

**Default: OAuth — no token needed.** The Ancher MCP server supports OAuth with
dynamic client registration, so your agent logs you in through the browser on
first use, with nothing to pre-provision. Claude Code and Cursor run the flow
automatically; Codex needs one command, `codex mcp login ancher`.

**CI / non-interactive: a bearer token.** Create an API token in the Ancher app
(**app.ancher.ai → Settings → API**), set `export ANCHER_API_TOKEN=…`, and use
the bearer-token config variant. The installer picks this form automatically when
`ANCHER_API_TOKEN` is set (or pass `--token`); it injects `${ANCHER_API_TOKEN}`
into the `Authorization` header for Claude/Cursor and references it via
`bearer_token_env_var` for Codex.

## What's inside

Four skills (`plugins/ancher/skills/`), authored once in the portable
[Agent Skills](https://agentskills.io) format and read verbatim by Claude Code,
Codex, and Cursor:

| Skill | Covers |
|---|---|
| **ancher** | Overview, the full tool map, MCP↔CLI routing, auth, and the capture → find → read → organize → ask workflow. The entry point. |
| **save-to-ancher** | Capturing text, URLs, conversations, and artifacts; the async parsing lifecycle; retrying failed parses. |
| **research-with-ancher** | `retrieve_notes`/`retrieve_chunks` (fast, free) vs the `ask` agent (reasons over notes + web and creates web pages, images, slide decks, and drafts; costs credits); when to delegate generation to Ancher; quoting sources. |
| **organize-ancher** | Collections and tags, the replace-all-tags gotcha, membership changes, safe deletion. |

## Repository layout

```
agent-skills/
├── .claude-plugin/marketplace.json     # Claude Code marketplace catalog
├── .agents/plugins/marketplace.json    # Codex + Cursor marketplace catalog
├── plugins/ancher/                     # the plugin (shared by all three agents)
│   ├── .claude-plugin/plugin.json
│   ├── .codex-plugin/plugin.json
│   ├── .cursor-plugin/plugin.json
│   ├── skills/<name>/SKILL.md          # one skill set, read by all three
│   ├── .mcp.json                       # Claude shape  (type/url/headers, ${VAR})
│   ├── mcp.json                        # Cursor shape  (mcpServers, ${env:VAR})
│   └── .mcp.codex.json                 # Codex shape   (url + bearer_token_env_var)
├── .cursor/{mcp.json,rules/ancher.mdc} # project-scoped Cursor templates
├── bin/cli.mjs                         # the npx cross-agent installer
└── scripts/check.mjs                   # consistency gate (run in CI)
```

Why three MCP files? The three agents genuinely disagree on the format — field
names and env-var syntax differ — so each gets its own. The skills, by contrast,
are byte-identical across all three. See
[docs/DESIGN.md](https://github.com/streamify-one/ancher-agent-skills/blob/main/docs/DESIGN.md)
for the full rationale.

## Development

Development happens in a private monorepo (this repository is its read-only
mirror — see *Contributing* below), where CI runs the package gates on every
change. The package itself uses **pnpm** and plain Node:

```bash
pnpm install        # installs Biome (the only devDependency)
pnpm run validate   # domain check + tests + Biome (what CI runs)

pnpm run check      # scripts/check.mjs: skills, MCP configs, manifests, marketplaces
pnpm test           # node --test (installer + validator)
pnpm run lint       # Biome (read-only)      | pnpm run fix formats + autofixes
pnpm run assert-pack # assert the npm tarball ships exactly the intended files
```

The domain validator fails if a skill is missing frontmatter, the three MCP
configs disagree on the endpoint, or a marketplace source doesn't resolve to
the plugin.

## Releasing

Publishing to npm happens from the monorepo via GitHub Actions + **OIDC
trusted publishing** (no long-lived token): maintainers cut a release tagged
`skills-vX.Y.Z`, and the publish workflow verifies the version, re-runs the
gates, and publishes with provenance. Details in
[docs/RELEASING.md](https://github.com/streamify-one/ancher-agent-skills/blob/main/docs/RELEASING.md).

## License

Apache-2.0.

## Contributing

This repository is a **read-only mirror**: the source of truth lives in a
private monorepo, and every push here is an identity-scrubbed snapshot
published by CI. Issues and discussions are welcome right here; pull requests
can't be merged directly, but maintainers will import patches — open the PR to
propose the change and it will be applied upstream.
