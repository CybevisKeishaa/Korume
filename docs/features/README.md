# Nihongo Cinema — Feature Registry

This document serves as the master index for all feature specifications. Each feature has its own detailed spec file in this directory.

| ID    | Feature                         | Priority | Layer | Status    | Dependencies              | Effort |
|-------|---------------------------------|----------|-------|-----------|---------------------------|--------|
| F-001 | Active Listening Mode           | High     | 3     | 🟡 Planned | F-002, F-010              | M      |
| F-002 | Unknown Word Heatmap            | High     | 3     | 🟨 Partial | SRS data (Layer 2)        | S/M    |
| F-003 | Learning Journey                | High     | 6     | 🟡 Planned | SRS data, video progress  | S      |
| F-004 | Difficulty Timeline             | Medium   | 6     | 🟨 Partial | F-002, i+1 engine         | S      |
| F-005 | Learn Before Watching           | High     | 3     | 🟡 Planned | F-002, SRS, transcript    | M      |
| F-006 | Shadowing Replay Timeline       | Medium   | 3     | 🟨 Partial | Shadowing sessions        | M      |
| F-007 | Personalized Weakness           | High     | 6     | 🟡 Planned | Grammar/Vocab stats       | M      |
| F-008 | Vocabulary Network              | Medium   | 2     | 🟡 Planned | Vocab relationships       | M      |
| F-009 | Shadowing Challenge             | Medium   | 6     | 🟡 Planned | Shadowing engine          | M      |
| F-010 | Review by Context               | High     | 2/3   | 🟨 Partial | Sentence mining, SRS      | L      |
| F-011 | Progress on Real Content        | Medium   | 6     | 🟡 Planned | Video tags, comprehension | S/M    |
| F-012 | Smart Review Queue              | High     | 2     | 🟡 Planned | SRS, video playlist       | M      |
| F-013 | Accent Dictionary               | Medium   | 2     | 🟡 Planned | Pitch data, vocab         | L      |
| F-014 | Multi-video Mining              | Medium   | 3     | 🟡 Planned | Transcript index          | M      |
| F-015 | Immersion Dashboard             | High     | 6     | 🟡 Planned | All progress data         | M      |
| F-016 | Goal-based Learning Paths       | Medium   | 1/6   | 🟡 Planned | Onboarding, tags          | L      |

**Layers reference** (from main spec):
- Layer 1: Foundation (DB, auth, layout)
- Layer 2: Static Content (Kanji, Vocab, Grammar, SRS)
- Layer 3: Video & Shadowing (core)
- Layer 4: AI Features
- Layer 5: JLPT & Reading
- Layer 6: Gamification & Dashboard
- Layer 7: Community & Admin
- Layer 8: Monetization & Polish

**Status**: 🟡 Planned | 🟨 Partial (foundation shipped, full feature — usually UI — pending) | 🟢 In Progress | ✅ Done

> **Registry authored after Layer 4 shipped.** Several features' *foundations* already exist in the L3/L4
> codebase even though the full feature is still planned — marked 🟨 **Partial**:
> - **F-002** — known-words + adaptive-furigana colouring exist; the heatmap endpoint/UI is pending.
> - **F-004** — the i+1 difficulty engine (`lib/difficulty`) + `GET /api/videos/[id]/difficulty` are built; the catalog timeline/badge UI is pending.
> - **F-006** — `shadowing_sessions` + pitch overlay/scoring are built; the per-line history-timeline UI is pending.
> - **F-010** — sentence mining (`/mining`, `/api/mining`) + `vocab_examples` are built; the in-context SRS review card is pending.
>
> **Free vs Premium** classification of every feature lives in `docs/product/business-model.md` §2.1
> (rule: *computed-from-your-data* = free; *AI-authored-over-it* = premium). See also Serena memory
> `project_status` for the authoritative build state.