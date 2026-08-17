# Ancher Agent Skills

[![npm](https://img.shields.io/npm/v/@ancher-ai/agent-skills)](https://www.npmjs.com/package/@ancher-ai/agent-skills)

Give your coding agent access to your **[Ancher](https://ancher.ai)** knowledge base. Ancher needs two things inside an agent:

- **Skills** — instructions that tell the AI when and how to save, search, research, and organize Ancher content.
- **A way to reach Ancher** — the `ancher` CLI, or the hosted Ancher MCP server.

## Start here

Run this on the computer where you use your coding agent:

```bash
npx -y skills add streamify-one/ancher-agent-skills
```

The [`skills`](https://github.com/vercel-labs/skills) CLI installs the Ancher skills into whichever agent you use — Claude Code, Codex, Cursor, OpenCode, Zed, Windsurf, Gemini CLI, GitHub Copilot, and 70 more.

It installs skills and nothing else, so give the agent a way to reach Ancher. The CLI requires **Node 24+**:

```bash
npm install -g @ancher-ai/cli
ancher login
```

`ancher login` runs a browser sign-in once and saves the session locally; the skills call the CLI from then on. Confirm it worked with `ancher whoami`.

Open a new agent session, then ask something like:

> Search my Ancher notes for the decisions about this project.

`skills` is a third-party tool maintained by Vercel Labs, not by Ancher.

### What `-y` means

`npx` normally asks permission before temporarily downloading a package it has not installed yet. `-y` answers that **npx download prompt** automatically — here and for `@ancher-ai/agent-skills` below.

It does **not** approve Ancher actions, grant the AI access to your content, or send a token. Omit it if you prefer to confirm the download yourself:

```bash
npx skills add streamify-one/ancher-agent-skills
```

## What you and your AI can do

| You ask for | The AI can use Ancher to |
|---|---|
| “Save this discussion” | Create a note from text, a URL, or an artifact. |
| “Find my notes about X” | Search notes and retrieve the relevant source material. |
| “Research this using my knowledge base” | Reason over your Ancher content and cite the sources it used. |
| “Organize these notes” | Work with collections and tags. |

The AI selects the right Ancher skill when your request matches it. You can also invoke a skill directly: Claude Code and Cursor use `/skill-name`; Codex uses `$skill-name`.

## Install with MCP tools instead

On Claude Code, Codex, and Cursor you can have the agent talk to the hosted Ancher MCP server directly — structured tools rather than shelling out to the CLI. This package configures both halves in one command:

```bash
npx -y @ancher-ai/agent-skills install
```

The installer finds Claude Code, Codex, and Cursor, then configures the ones it finds. It does not install a local server or require an API token. Then sign in to Ancher for the agent you use — see [sign in to Ancher](#sign-in-to-ancher) below.

Do not run both installers. They write the same skill directories (`~/.claude/skills`, `~/.codex/skills`, `~/.cursor/skills`) under the same skill names, so whichever runs last wins.

### Install options

```bash
# Configure only specific agents.
npx -y @ancher-ai/agent-skills install --agent claude,codex

# Preview every file and command without changing anything.
npx -y @ancher-ai/agent-skills install --print

# Add skills to the current repository instead of your user profile.
npx -y @ancher-ai/agent-skills install --project

# Remove Ancher skills and MCP configuration again.
npx -y @ancher-ai/agent-skills uninstall
```

The default installation is user-wide. It writes each agent's skills to its native global directory and configures the hosted MCP server. With `--project`, skills are written into the current repository; Codex MCP configuration remains user-wide, so the installer prints the one command you need to run.

## Sign in to Ancher

These steps apply when you installed with `@ancher-ai/agent-skills` above; the `skills` CLI path signs in once with `ancher login` instead. The default is browser-based OAuth. You do not need an API token. First sign in to your Claude Code, Codex, or Cursor account as usual, then connect that agent to your Ancher account once.

### Claude Code

1. Start Claude Code in any project:

   ```bash
   claude
   ```

2. In the Claude Code session, run `/mcp`.
3. Select **ancher**, choose its authentication option, and finish the browser sign-in.
4. Return to Claude Code and ask it to search or save an Ancher note.

If the browser does not open, copy the displayed URL into a browser. Confirm that the server is configured with:

```bash
claude mcp list
```

[Claude Code’s MCP authentication guide](https://docs.anthropic.com/en/docs/claude-code/mcp) explains the `/mcp` OAuth flow.

### Codex

Run the following after the installer finishes:

```bash
codex mcp login ancher
```

Complete the browser sign-in, restart Codex, and start a new session. Check that the server is available with:

```bash
codex mcp list
```

### Cursor

Open Cursor and start an Agent chat. The first Ancher tool use prompts you to connect and complete the browser sign-in. Approve the request, return to Cursor, and retry your request.

If you use the Cursor Agent CLI instead, authenticate the configured MCP server directly:

```bash
cursor-agent mcp login ancher
cursor-agent mcp list
```

[Cursor’s MCP documentation](https://docs.cursor.com/context/model-context-protocol) covers OAuth connections and MCP configuration.

### CI and non-interactive environments

For CI or other non-interactive environments, create an API token in **Ancher → Settings → API**, set it as `ANCHER_API_TOKEN`, then install with `--token`. The installer references the environment-variable name in each agent's configuration; do not place a token directly in a command.

```bash
export ANCHER_API_TOKEN=...
npx -y @ancher-ai/agent-skills install --agent codex --token
```

## CLI and agent skills are independent

The [recommended install](#start-here) uses the CLI as the agent's backend. This package is the alternative: it configures the hosted MCP server, so the agent works without the Ancher CLI installed at all.

Either way, install the CLI when **you** want to work from a terminal yourself:

```bash
npm install -g @ancher-ai/cli
ancher login
```

You can also install this installer globally if you prefer a persistent command:

```bash
npm install -g @ancher-ai/agent-skills
ancher-agent-skills install
```

## Native plugin installation

You may instead install the native plugin marketplace entry.

### Claude Code

```text
/plugin marketplace add streamify-one/ancher-agent-skills
/plugin install ancher@ancher-agent-skills
```

### OpenAI Codex

```bash
codex plugin marketplace add streamify-one/ancher-agent-skills
```

Then start `codex`, open `/plugins`, install **ancher**, and begin a new session.

## Included skills

| Skill | Use it for |
|---|---|
| `ancher` | The overall Ancher workflow and tool map. |
| `save-to-ancher` | Saving text, URLs, conversations, and files. |
| `research-with-ancher` | Retrieving sources and researching with Ancher. |
| `organize-ancher` | Collections, tags, membership, and safe deletion. |

## Development and releases

The source of truth is a private monorepo; this repository is a read-only public mirror.

```bash
pnpm install
pnpm run validate
pnpm run assert-pack
```

Publishing uses GitHub Actions with npm trusted publishing. Maintainers release a matching `skills-vX.Y.Z` GitHub Release. See [docs/RELEASING.md](docs/RELEASING.md) for details.

## License

Apache-2.0.
