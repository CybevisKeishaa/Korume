# Domain Model Glossary

> **Status:** Canonical
> **Applies to:** Entire product — `docs/design/**`, `docs/product/**`, `docs/features/**`,
> `docs/superpowers/specs/**`.
> **Decision record:** `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
> §1, §5, §6.1.

---

Every document uses these terms exactly as defined here. If a document needs a term this glossary
doesn't define, add it here first — don't coin a new synonym for an existing term in a single file.

## Core entities

| Term | Meaning |
|---|---|
| **Video** | The YouTube source (`youtube_video_id`). An internal/technical concept only — never a learner-facing entity, never the DB table's product-facing name (the `videos` table itself is a deferred rename, see spec §1.1). |
| **Lesson** | The canonical learning object, deduplicated by `youtube_video_id`. Aggregates transcript, vocabulary, grammar, shadowing sessions, dictation attempts, and progress. Everything else in this glossary is a *projection* of a Lesson — never a fork or copy of its data. |
| **My Lessons** | The learner's own `PRIVATE`-tier Lessons — created via Create Lesson, or dedup-joined from someone else's. A top-level, always-visible section of the Shadowing Hub, not a filter. |
| **Library** | The full set of `FREE`/`PLUS`-tier published Lessons, visible in the Shadowing Hub. `library_access` (`PRIVATE`\|`FREE`\|`PLUS`) is a *publishing state*, not a permission system or a tag — it answers exactly one question, "where is this Lesson published?" |
| **Collection** | An editorial or computed grouping of Lessons for discovery/curation (Featured, Anime, JLPT N3, Continue Learning, Recently Added, …), entirely separate from `library_access`. A Lesson can belong to any number of Collections at once. |

## Lesson Workspace (inside a Lesson)

| Term | Meaning |
|---|---|
| **Learning Mode** | *What skill am I practicing?* One of Shadowing / Pronunciation / Dictation / Summary. Each is a full route inside the Lesson (`/shadowing/[id]`, `/shadowing/[id]/pronunciation`, …), sharing one transcript, one timeline, one progress record. |
| **View Mode** | *How do I want to see it?* Exists only inside the Shadowing Learning Mode: Reading / Normal / Immersion. |
| **Reading Settings** | *How should the UI behave?* Font, subtitle size/color, speed, auto-pause, repeat count, etc. — persisted per learner, not a mode. |
| **Analysis** | A per-sentence utility (select text → Analyze), not a mode at any layer — not a View Mode option, not a Learning Mode, not a tab. |

## Explicitly not part of this model

- **Review** (`screen-review.md`) — the SRS review workspace. A separate surface entirely, not a Learning Mode or View Mode inside a Lesson.
- **Focus Mode** — a general concentration-density axis shared across several screens (`screen-architecture.md` § Focus States, `adaptive-layouts.md` § Focus Modes, `study-modes.md` § Focus Mode). Related in spirit to View Mode but not the same concept and not scoped to Lessons — see `design-reconciliation.md` §13, "Naming Is Local, Not Global."

## The one-sentence test

> **Lesson is the canonical learning object. Everything else is a projection of a Lesson.**

Before adding a new top-level concept anywhere in the product, check it against this sentence
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0, principle 1). If
it's really just another way of listing, grouping, or practicing Lessons, it's a projection or a new
Learning Mode — not a new entity, and not a new row in this glossary's top table.
