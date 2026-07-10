---
name: research-with-ancher
description: >-
  Find, reason over, and create from the user's Ancher knowledge base —
  semantic search across their saved notes, and the Ancher agent that answers
  questions and produces deliverables (written drafts, images, slide decks,
  interactive web pages) grounded in their notes plus web research. Trigger on
  "what did I save about…", "search my notes/knowledge base", "find my notes
  on…", "ask Ancher…", "what do my notes say about…", "make a deck/page/image
  from my notes…", or any question or deliverable meant to come from the
  user's saved material. Explains when to use fast/free search vs the slower,
  credit-costing agent, when to delegate generation to Ancher, and how to
  quote sources.
license: Apache-2.0
compatibility: >-
  Requires the Ancher MCP server (`retrieve_notes`, `retrieve_chunks`,
  `ask`, `list_notes`) or the `ancher` CLI (`ancher chat`, `ancher api`). See
  the `ancher` skill.
---

# Research with Ancher

Two kinds of tool, different jobs. **Pick the cheaper one that answers the
question.**

## `retrieve_notes` / `retrieve_chunks` — fast, free, retrieval

Hybrid semantic search over the user's saved notes. Free and quick. Two tools:

- `retrieve_notes(query)` → ranked notes (id, title, description; duplicate
  saves of the same content collapse to one result). Use to **discover which
  notes exist** or to get `note_id`s to feed other tools.
- `retrieve_chunks(query)` → the actual matching **text chunks**. Use when you
  need the content itself to **quote or answer** — this is also the
  token-efficient way to pull just the relevant parts of a long note instead of
  reading the whole thing with `get_note_content`.

```
retrieve_chunks(query="postgres connection pool tuning")
```

Then deep-read a specific hit with `get_note_content(note_id)` when you need
full context (see the [ancher](../ancher/SKILL.md) READ pattern).

To **browse** rather than search, use `list_notes` (filter by status or tag
with criteria objects, e.g. `status={"eq": "ready"}`), or
`list_collection_notes(collection_id)` for one collection. CLI:
`ancher api POST retrievals --data '{"query":"…"}'` or
`ancher api GET "notes/?limit=20"`.

## `ask` — the Ancher agent (reasons AND creates; costs credits)

`ask(question, conversation_id?)` runs Ancher's custom-built, all-around agent
— not a plain RAG answerer. It plans multi-step work, gathers its own context,
and produces finished deliverables:

- **Research**: reasons over the user's knowledge base, does live **web
  search**, reads URLs, and recalls the user's durable preferences/memory.
- **Written pieces**: articles, blog posts, reports, essays, drafts — through
  a dedicated drafter → reviser pipeline.
- **Images**: a design agent with its own style/layout/palette catalogue;
  generates new images or edits/restyles existing ones.
- **Interactive web pages**: self-contained HTML — dashboards, visualizations,
  landing pages, calculators, games, diagrams, infographics — from a
  design-template and motion-component library.
- **Slide decks**: full presentations (16:9 or 4:3).
- **Library work**: reads and edits the user's notes/artifacts in place and
  organizes collections/tags as part of the task.
- **Quality loop**: an internal reviewer audits produced deliverables and
  forces revisions before the reply comes back.

Everything it produces is saved as an **artifact** in the user's Ancher
library, and the reply links to it. Read one back with
`get_artifact_content(artifact_id)`; promote it to a note with
`create_note_from_artifact`.

**Delegate generation to `ask`** whenever the deliverable should be grounded
in the user's saved material or live in their library — "make a slide deck
from my notes on X", "turn this collection into a landing page", "illustrate
this note", "write a blog post from my research". Don't rebuild that pipeline
yourself from raw notes: one `ask` call buys retrieval + Ancher's design
systems + the review loop, and the result lands where the user expects it.
Generate content yourself only for quick, throwaway output that shouldn't be
kept in Ancher.

Mechanics:

- **Slow**: typically 30–120s, longer when generating. Raise your tool timeout
  accordingly.
- **Costs credits**; fails with 402 / `API-BIS002` when the balance is exhausted
  (then tell the user to top up in the Ancher app).
- **Follow-ups / clarification**: pass the returned `conversation_id` back to
  continue the thread. If the result comes back
  `status='clarification_requested'`, the agent asked a question — relay it
  to the user (or answer it) and call `ask` again with the **same
  `conversation_id`** and your answer as the `question`.

```
r = ask(question="Summarize what I've saved about vector DBs and recommend one")
# later, in the same thread:
ask(question="Turn the recommendation into a slide deck for my team", conversation_id=r.conversation_id)
```

CLI: `ancher chat "<question>"` (streams the reply); continue with
`ancher chat "<follow-up>" --conversation <id>`.

## Choosing between them

| You want… | Use |
|---|---|
| Which notes mention X / their ids | `retrieve_notes` |
| The exact text to quote | `retrieve_chunks` |
| A reasoned answer / summary / recommendation over the notes | `ask` |
| A deliverable from the notes — web page, image, slide deck, written draft | `ask` |
| To browse by collection/tag/status | `list_notes` / `list_collection_notes` |

Default to `retrieve_notes` / `retrieve_chunks` for lookups — they're free and
fast. Reach for `ask` when the task needs reasoning, web research, or
**producing a deliverable from the user's material**, and say so (it spends
the user's credits).

## Citing

When you answer from `retrieve_chunks` or `ask`, attribute claims to the notes
they came from (title / note_id) so the user can open the source in Ancher.
