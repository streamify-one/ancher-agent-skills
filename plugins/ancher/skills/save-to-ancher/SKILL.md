---
name: save-to-ancher
description: >-
  Capture something into the user's Ancher note library — save free text, a URL
  or web page to fetch and parse, an assistant conversation, a single message,
  or an artifact. Trigger on "save this to Ancher", "add this to my notes",
  "clip this page/URL", "remember this", "save this conversation/answer". Covers
  the async parsing lifecycle, attaching a comment, and retrying failed parses.
license: Apache-2.0
compatibility: >-
  Requires the Ancher MCP server (`create_note_from_text`, `get_note`,
  `retry_note`) or the `ancher` CLI. See the `ancher` skill for how to reach
  the backend.
---

# Save to Ancher

Capture with the **`create_note_from_*`** tools — one per source:

| Source | Tool | Notes |
|---|---|---|
| Free text | `create_note_from_text(text=…)` | Plain text, markdown, or a bare **URL** — a URL is fetched and parsed as a web page. |
| Conversation | `create_note_from_conversation(conversation_id=…)` | Saves the whole assistant conversation. |
| One message | `create_note_from_message(conversation_id=…, message_id=…)` | Saves a single reply. |
| Artifact | `create_note_from_artifact(artifact_id=…)` | Saves an AI-generated artifact. |

Each optionally takes `comment="…"` — the user's remark saved alongside the
source.

```
create_note_from_text(text="https://example.com/article")
create_note_from_text(text="Meeting takeaways: …", comment="from standup")
create_note_from_message(conversation_id="…", message_id="…")
```

CLI fallback: `ancher api POST notes/text --data '{"text":"…"}'` (or the
`notes` resource group — `ancher help notes`).

## The parsing lifecycle — this is async

`create_note_from_*` returns quickly with `status='processing'` (or `queued`).
Content is parsed in the background. So:

1. `create_note_from_*(...)` → note id + `status='processing'`. The provisional
   `title` may change after parsing.
2. Don't assume content exists yet. Re-check later with
   `get_note(note_id)` — statuses are `queued` → `processing` → `ready` (or
   `error`).
3. If `status='error'`, read `error_message` (via `get_note`), then re-queue
   with `retry_note(note_id)`. **Re-parsing costs credits.**

To find everything that failed to parse: `list_notes(status={"eq": "error"})`.

## Tagging on save

The `create_note_from_*` tools don't take tags. To tag a freshly saved note:

1. Get or create the tag: `list_tags` / `create_tag(name="…", color="…")`.
2. `set_note_tags(note_id, tag_ids=[…])` — ⚠️ this **replaces all** tags on the
   note; read the current tags first (`get_note`) when adding incrementally.

See [organize-ancher](../organize-ancher/SKILL.md) for tags and collections.

## Cost & auth

- Parsing (fetching/extracting a URL, etc.) **costs the user credits**. A 402 /
  `API-BIS002` means they're out — tell them to top up in the Ancher app.
- Saving requires Ancher auth (OAuth login or `ANCHER_API_TOKEN`). A 401 means
  missing/expired auth. See the [ancher](../ancher/SKILL.md) skill.
