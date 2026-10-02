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
| **Situation** | A learner-facing context taxonomy for a Lesson, such as restaurant, conversation, or travel. Current storage is one provisional `situation_id` FK per Lesson; consumers use the data-layer boundary so a future many-to-many assignment changes one implementation, not screen code. Its localized label is `shadowing.situations.*`, never a database display field. |
| **Source** | A learner-facing origin taxonomy for a Lesson, such as NHK, podcast, drama, anime, or vlog. It is independent of Situation and of the technical `transcript_source` field. Current storage is one provisional `source_id` FK; labels are `shadowing.sources.*` catalog entries, never database display fields. |

## Lesson Workspace (inside a Lesson)

| Term | Meaning |
|---|---|
| **Learning Mode** | *What skill am I practicing?* One of Shadowing / Pronunciation / Dictation / Summary. Each is a full route inside the Lesson (`/shadowing/[id]`, `/shadowing/[id]/pronunciation`, …), sharing one transcript, one timeline, one progress record. **⚠ Superseded** — "Dictation" was restructured into "Listening Practice"; see `docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §1 and `docs/design/screens/screen-shadowing-practice.md` § Learning Modes for the current definition. |
| **View Mode** | *How do I want to see it?* Exists only inside the Shadowing Learning Mode: Reading / Normal / Immersion. **⚠ Superseded** — View Mode was retired outright, not merely renamed; see `docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §2 and `docs/design/screens/screen-shadowing-practice.md` § Two-Layer Model for the current model. |
| **Reading Settings** | *How should the UI behave?* Font, subtitle size/color, speed, auto-pause, repeat count, etc. — persisted per learner, not a mode. |
| **Look-up** | A per-sentence utility (select a word, or Enter on Live Sentence → a word card; a kanji → the Inspector), not a mode at any layer — not a Learning Mode, not a tab. It replaced **Analysis** (select text → Analyze); per-sentence AI explanation is not part of Shadowing (`docs/superpowers/specs/2026-10-02-shadowing-workspace-part-1b-reframe-design.md`). |
| **Inspector** | A transient state of the Shadowing Utility Drawer showing a kanji (QuickInspect) or a common word's card, with Back / Close. Not a tab; it never changes the drawer's target. |
| **Sentence Note** | A learner's private note on one transcript line (`sentence_notes`, one row per learner and line). Exported and erased with the account. |
| **Lesson Note** | A learner's private note on a whole Lesson (`lesson_notes`, one row per learner and lesson). Same rules as a Sentence Note. |
| **Sentence Mark** | A learner's per-line bookmark or difficult flag. It is not a Pin, Mining, My Lessons (library), or a Playlist. |
| **Lesson Bookmark** | A learner's flag on a whole Lesson. It is not a Pin, Mining, My Lessons (library), or a Playlist. |

## Dictionary and knowledge (server-side)

| Term | Meaning |
|---|---|
| **Dictionary Snapshot** | One versioned import of JMdict, KANJIDIC2 and KanjiVG (`dict_snapshots`, `dict_entries`, `dict_kanji`). Exactly one is active; a new one is staged, then activated in one step; retired ones are garbage-collected. JMdict and KANJIDIC2 are © EDRDG, CC BY-SA 4.0; KanjiVG is © Ulrich Apel, CC BY-SA 3.0 — the attribution ships with the data. |
| **Knowledge Entry** | A cached AI section about a sentence (or span), keyed by the sentence text's fingerprint, section, locale, context, schema and generator version, and content variant (full / preview). Shared by every learner; holds no learner state. |
| **AI Reservation** | The budget hold taken before a generation (`ai_reservations`): reserved, then settled at the real cost or released. It is how the hard global USD budget and per-learner quotas stay exact under concurrency. |
| **AI Generation** | One provider call that produced (or failed to produce) a Knowledge Entry (`ai_generations`), with model and tokens. |
| **AI Charge** | The settled cost of a generation attributed to a learner's quota (`ai_usage_charges`). Prices never reach the client. |

The Knowledge core is dormant in Shadowing after the 1b reframe: no Shadowing surface calls it; Korume
Companion and Summary will be its first product callers.

## Explicitly not part of this model

- **Review** (`screen-review.md`) — the SRS review workspace. A separate surface entirely, not a Learning Mode or View Mode inside a Lesson.
- **Focus Mode** — a general concentration-density axis shared across several screens (`screen-architecture.md` § Focus States, `adaptive-layouts.md` § Focus Modes, `study-modes.md` § Focus Mode). Related in spirit to View Mode (now-retired, see above) but not the same concept and not scoped to Lessons — see `design-reconciliation.md` §13, "Naming Is Local, Not Global."

## The one-sentence test

> **Lesson is the canonical learning object. Everything else is a projection of a Lesson.**

Before adding a new top-level concept anywhere in the product, check it against this sentence
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0, principle 1). If
it's really just another way of listing, grouping, or practicing Lessons, it's a projection or a new
Learning Mode — not a new entity, and not a new row in this glossary's top table.
