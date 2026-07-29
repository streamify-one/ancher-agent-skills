---
name: ancher
description: >-
  Use Ancher — the user's personal knowledge base and research assistant — to
  capture, search, read, organize, and reason over their saved notes, articles,
  web pages, conversations, and AI-generated artifacts. Trigger whenever the
  user says "save/add this to Ancher", "my notes", "my knowledge base", "what
  did I save about…", "search my notes/collections", "ask Ancher", or references
  Ancher notes, collections, tags, or artifacts. This is the entry point: it
  explains the tools, how to reach them (MCP or the `ancher` CLI), and the
  capture → find → read → organize → ask workflow.
license: Apache-2.0
compatibility: >-
  Requires access to the Ancher API via EITHER the Ancher MCP server (tools
  named `ask`, `retrieve_notes`, `create_note_from_text`, …) OR the `ancher`
  CLI on PATH (or `npx -y @ancher-ai/cli`). Both need Ancher auth: an OAuth login
  or the ANCHER_API_TOKEN environment variable.
metadata:
  product: Ancher
  homepage: https://ancher.ai
  api: https://api.ancher.ai
---

# Ancher

Ancher is the authenticated user's **personal knowledge base and research
assistant**. Everything you do acts as — and is billed to — that user.

## Concepts

Ancher works in three steps: the user **saves** things as notes, **organizes**
related notes into collections, and **asks** an assistant (you, or the built-in
`ask` agent) to think, summarize, and create from them.

| Object | What it is for |
|---|---|
| **Note** | The primary home for the user's saved content and final deliverables: free text, a fetched web page/URL, an uploaded file, a saved conversation, or a saved artifact. Its content is rich markdown, parsed **asynchronously** from the source. A note may also carry an origin file when created from an upload (text, markdown, html, audio, video, ppt, doc, pdf, …) or, when created from a URL, a fetched copy plus generated files (thumbnail, transcription, key frames). The `article_id` you'll see on notes is internal content-dedup plumbing — the note is always the unit you work with. |
| **Artifact** | Interim or raw AI-generated material: images, HTML pages, slide decks, documents, video, audio. Everything an agent produces is an artifact; saving one into the knowledge base produces a **note** (`create_note_from_artifact`). |
| **Collection** | A named folder grouping notes and artifacts by project or theme. |
| **Tag** | A colored label on notes for cross-cutting categorization. |
| **Conversation** | A thread with the Ancher agent (`ask`) — an all-around assistant that researches over the notes + web and creates web pages, images, slide decks, and written drafts. A conversation or a single message in it can itself be saved as a note. |
| **Knowledge base** | All of the above together. Treat it as the most reliable source for user-specific or saved information — prefer it over web or general knowledge when relevant. |

The typical workflow — and the skill that covers each step:

1. **CAPTURE** → [save-to-ancher](../save-to-ancher/SKILL.md) (`create_note_from_*`)
2. **FIND** → [research-with-ancher](../research-with-ancher/SKILL.md) (`retrieve_notes`, `retrieve_chunks`, `list_notes`)
3. **READ** → this skill (`get_note_content`, `get_artifact_content`, `list_messages`)
4. **ORGANIZE** → [organize-ancher](../organize-ancher/SKILL.md) (collections, tags, the `delete_*` tools)
5. **ASK & CREATE** → [research-with-ancher](../research-with-ancher/SKILL.md) (`ask` — answers *and* generates web pages, images, slide decks, and drafts from the notes)

## How to reach Ancher (do this first)

Prefer whichever backend is available, in this order. **Never dead-end** — if
none is reachable, tell the user exactly how to set it up (see *Setup* below).

1. **Ancher MCP tools** — if tools named `ask`, `retrieve_notes`,
   `create_note_from_text`, `get_note`, `list_notes`, etc. are available (they
   appear as `ask` / `mcp__ancher__ask` / `mcp__plugin_ancher_ancher__ask`
   depending on the host), **use them.** They are the primary, structured
   interface.
2. **`ancher` CLI** — if the MCP tools are absent but the `ancher` binary is on
   PATH, shell out to it (see the CLI cheatsheet below).
3. **`npx -y @ancher-ai/cli`** — if `ancher` is not installed but Node is present,
   the same CLI runs via `npx -y @ancher-ai/cli <args>` (nothing to pre-install).
4. **Fallback: none available** → point the user at *Setup* and stop; do not
   fabricate results.

Do not hard-code a bare `ancher` invocation as your only path — check for the
MCP tools first.

## The tool surface

Reads are safe to call freely. Writes are explicit. The **`delete_*` tools are
destructive and permanent** — always confirm before calling one.

**Search & browse**
- `retrieve_notes(query)` — semantic search; ranked notes (duplicate saves of
  the same content collapse to one result). Use to **discover which notes
  exist** or get `note_id`s.
- `retrieve_chunks(query)` — semantic search; the matching **text chunks**. Use
  to quote/answer without reading whole notes.
- `list_notes(...)` — browse/filter. Filters are criteria objects, e.g.
  `status={"eq": "error"}` finds failed parses; `tags={"name": {"eq": "…"}}`
  filters by tag. Also `limit`, `offset`, `order_by` (e.g. `["-id"]`), `cursor`.
- `list_collections`, `list_tags`, `list_conversations`, `list_artifacts` — browse.
- `list_collection_notes(collection_id)` / `list_collection_artifacts(collection_id)`
  — a collection's members.

**Read**
- `get_note(note_id)` — one note's metadata (status, title, tags, files).
- `get_note_content(note_id)` — the note's resolved text content.
- `get_artifact(artifact_id)` / `get_artifact_content(artifact_id)` — same split
  for artifacts.
- `get_conversation(conversation_id)`, `list_messages(conversation_id)`,
  `get_message(conversation_id, message_id)` — chat history.

**Write**
- `create_note_from_text(text, comment?)` — capture text or a URL (fetched &
  parsed). Siblings: `create_note_from_conversation`, `create_note_from_message`,
  `create_note_from_artifact`.
- `ask(question, conversation_id?)` — Ancher's all-around agent: answers from
  the user's notes + live web research, AND **creates deliverables** — written
  drafts, images, slide decks, interactive web pages — saved as artifacts in
  the user's library. Prefer it over generating such content yourself when the
  output should be grounded in their notes or kept in Ancher (see
  [research-with-ancher](../research-with-ancher/SKILL.md)). **Costs
  credits**; slow (30–120s).
- `update_note(note_id, title?, description?)` — edit metadata.
- `set_note_tags(note_id, tag_ids)` — ⚠️ **replaces all** tags on the note.
- `retry_note(note_id)` — re-queue a failed parse. **Costs credits.**
- `create_collection(name)`, `update_collection(collection_id, …)`,
  `create_tag(name, color)`, `update_tag(tag_id, …)` — manage containers/labels.
- `add_collection_note` / `remove_collection_note` (and `…_artifact`) —
  collection membership; removing only **unlinks**, it never deletes.
- `update_artifact(artifact_id, name?, description?)` — rename/redescribe.
- `delete_note`, `delete_collection`, `delete_tag`, `delete_artifact`,
  `delete_conversation` — ⚠️ destructive; permanent.

`update_note` / `update_artifact` also accept `is_public` — that **publishes
the user's content**; never set it unless the user explicitly asks to share.
Billing money-movement, file bytes, and auth are deliberately **not** exposed —
direct the user to the Ancher app for those.

### READ pattern (this skill)

- One deep read: `get_note(note_id)` for metadata, `get_note_content(note_id)`
  for the text (or `get_artifact_content` / `list_messages`). For long
  documents, prefer `retrieve_chunks` to pull only the relevant passages
  instead of reading the whole thing.
- A note may still be parsing (`status='processing'`) and have no content yet —
  check `status`, and if `status='error'` retry via `retry_note(note_id)`.
- Pagination: pass `next_cursor` back **verbatim and alone** — it already
  encodes the filters, and combining `cursor` with other criteria is rejected.
  Stop when `has_more` is false.

## CLI cheatsheet (fallback path)

The `ancher` CLI is a thin layer over the same API the MCP wraps, so the same
operations are available:

```bash
ancher whoami                              # who am I / is auth working
ancher chat "<question>"                   # == the `ask` tool (streams the reply)
ancher chat "<follow-up>" --conversation <id>
ancher api GET  "notes/?limit=5"           # browse notes (== list_notes)
ancher api POST retrievals --body '{"query":"..."}'   # semantic search (== retrieve_notes)
ancher api GET  "notes/<id>"               # read a note (== get_note)
ancher api POST notes/text --body '{"text":"..."}'    # capture text (== create_note_from_text)
ancher help <resource>                     # discover a resource's actions
```

`ancher api <METHOD> <path>` hits the exact REST endpoints the MCP tools wrap
(`notes/`, `retrievals`, `collections/`, `tags/`, `artifacts/`,
`conversations`), so when in doubt use it. Run `ancher help` for resource groups.

## Setup (when nothing is reachable)

Tell the user to pick ONE:

- **Install the Ancher plugin** (bundles these skills + the MCP server, one step):
  - Claude Code: `/plugin marketplace add streamify-one/ancher-agent-skills` then `/plugin install ancher@ancher-agent-skills`
  - Codex: `codex plugin marketplace add streamify-one/ancher-agent-skills`, then run `codex`, open `/plugins`, and install **ancher**.
  - Cursor: click **Add to Cursor** in the repo README, or add the MCP server manually.
- **Or one-liner installer** (any agent): `npx @ancher-ai/agent-skills install`
- **Or just the CLI**: `npm i -g @ancher-ai/cli` then `ancher login`.

Auth: the MCP server uses OAuth (the host will prompt a browser login on first
use) or a bearer token; the CLI uses `ancher login` or the `ANCHER_API_TOKEN`
environment variable (for CI / non-interactive use). If a call returns 401,
that's missing/expired auth — run `ancher login` or set `ANCHER_API_TOKEN`.

## Guardrails

- **Confirm before any `delete_*` tool** — deletion is permanent and cannot be
  undone.
- `ask`, parsing (`create_note_from_*`), and re-parsing (`retry_note`)
  **cost the user credits**. On a 402 / `API-BIS002`, tell them to top up or
  upgrade in the Ancher app.
- Don't guess ids — discover them with the `list_*` / `retrieve_*` tools first.
- Parsing is async: after `create_note_from_*`, the note is `processing`;
  re-check with `get_note` before assuming its content exists.
