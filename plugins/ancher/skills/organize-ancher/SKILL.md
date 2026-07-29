---
name: organize-ancher
description: >-
  Organize the user's Ancher library — create and manage collections (folders)
  and tags (labels), move notes/artifacts into collections, tag notes, and
  delete items. Trigger on "make a collection", "tag this note", "move these to
  …", "organize my notes", "rename/recolor this tag", "delete this note/
  collection/tag". Covers the replace-all-tags gotcha, membership changes, and
  safe deletion.
license: Apache-2.0
compatibility: >-
  Requires the Ancher MCP server (collections/tags/`delete_*` tools) or the
  `ancher` CLI. See the `ancher` skill.
---

# Organize Ancher

## Collections (folders)

- Discover: `list_collections()` — always check before creating to avoid
  near-duplicates.
- Create: `create_collection(name=…, description?, color?)`. Update:
  `update_collection(collection_id, name?, description?, color?)`.
- Membership: `add_collection_note(collection_id, note_id)` /
  `remove_collection_note(collection_id, note_id)` — and the same pair for
  artifacts (`add_collection_artifact` / `remove_collection_artifact`). One
  item per call. Removing only **unlinks** from the collection; it never
  deletes the note/artifact.
- List a collection's members: `list_collection_notes(collection_id)` /
  `list_collection_artifacts(collection_id)`.
- Suggestions: `list_suggested_collections_for_note(note_id)` and
  `list_suggested_notes_for_collection(collection_id)` surface the
  classifier's filing suggestions.

## Tags (labels)

- Discover: `list_tags()`.
- Create: `create_tag(name=…, color=…)` — both required; `color` is a palette
  name (e.g. `slate`, `blue`, `emerald`). Rename/recolor:
  `update_tag(tag_id, name?, color?)`.
- Apply to a note: `set_note_tags(note_id, tag_ids=[…])`.

⚠️ **`set_note_tags` replaces ALL tags on the note.** To add a tag without
dropping the others: `get_note(note_id)` → read the current tag ids → send the
full desired set. To remove one, send the set minus that id.

## Deleting — the destructive actions

One tool per type: `delete_note(note_id)`, `delete_collection(collection_id)`,
`delete_tag(tag_id)`, `delete_artifact(artifact_id)`,
`delete_conversation(conversation_id)`.

- **Confirm with the user first.** Deletion is permanent and cannot be undone.
- Deleting a **collection or tag does not delete the notes** in/under it (it just
  removes the container/label). Deleting a **conversation** deletes all its
  messages.
- To take a note *out of* a collection without deleting it, use
  `remove_collection_note(collection_id, note_id)`, not `delete_note`.

## CLI fallback

Use the matching resource group or the raw passthrough:

```bash
ancher help collections            # discover actions
ancher api POST collections/ --body '{"name":"Reading list"}'
ancher api GET  "tags/?limit=100"
```

Making notes/artifacts public (`is_public`) shares the user's content — never
set it unless the user explicitly asks; prefer directing them to the Ancher app.
