# L9b — Companion Presence (Companion Plan 2) — Design Spec

> **Child spec of** `docs/superpowers/specs/2026-07-16-companion-system-design.md` (the Companion
> System spec, "Spec 1"). That document owns the philosophy, principles (P0–P12), semantics of the
> presence architecture (§5), and the test obligations (§8). **This document decides only what Spec 1
> deliberately left open: the concrete implementation shape for the L9b build.** Where the two ever
> appear to disagree, Spec 1 wins.
> **Status:** Approved brainstorm (2026-07-24) → feeds the L9b Companion Presence implementation plan.
> **Prereqs shipped:** Companion Core (merged `9f09cf2`) — migration #15 `companion_memories`,
> `lib/companion/*` (phase, dedupe, types), capture gate + producers (`companion_grew`,
> `mining_saved`, `jlpt_passed`), `POST /api/companion/memories`, `GET /api/companion/journal`.
> L9a all three plans merged (i18n vi/en + design system + full string extraction).

---

## 1. Scope

**In:** everything the Companion Core ledger deferred to "Plan 2", plus five small carried cleanups.

1. **Presence architecture** (Spec 1 §5): Ambient Layer, per-surface anchors, context bus,
   state machine, arbitration + experience cooldown, the 4-verb Companion API.
2. **Journal UI** at `/journal` + navigation entry + sprite-as-door.
3. **Gifted-pin UI** in the shadowing and dictation transcript surfaces.
4. **Placeholder sprite** (MASCOT.md-leaning; still a placeholder under the §7 contract).
5. **Three remaining discovered-memory producers**: `first_shadow`, `line_mastered`,
   `first_video_completed` — plus a new **`first_meeting`** producer (see §6).
6. **Cleanups folded in** (§10).

**Out (has a home elsewhere):** adaptive voice (modular-sentence i+1), real AI reflection, moving
stored-title templates into i18n → Companion Plan 3 · tutorial + landing anchors → L9b Plan 4 ·
Contextual Discovery → L8 · rich idle behaviors, preferences content, name/lore/final art → Spec 2
(Character Identity) · seasonal layer → future.

## 2. Decisions locked during brainstorm

| # | Decision | Choice |
|---|---|---|
| D1 | Plan shape | Full Companion Plan 2 in one plan + 5 cleanups (too interwoven to split; cleanups too small to live alone) |
| D2 | Identity in placeholder | **Leaning-placeholder**: simple SVG in MASCOT.md's visual direction (cream / pale teal / amber + a small orbiting "memory orb"), **no name anywhere** — copy says generic companion terms. Spec 2 stays a separate future brainstorm; Character Swap Invariant intact |
| D3 | Anchor scope | **Narrow**: Dashboard, `/journal`, videos empty state, mining-deck empty state. Every other surface dormant (no anchor declared). Broad rollout later = just declaring anchors (Spec 1 §10) |
| D4 | Journal entry points | **Both**: clicking/activating the sprite (`openJournal()`) **and** a quiet "Journal" item in AppNav. Route is **`/journal`** (the learner's book — not `/companion`, which would misplace ownership, P4) |
| D5 | "Target score" for producers | **Score-only, honest**: `pronunciation_score ≥ 80` (`TARGET_SCORE`), `line_mastered` needs ≥3 attempts (`MASTERY_ATTEMPTS`) on the same line, the current attempt ≥80, and at least one earlier attempt <80. Constants live in code config next to `PHASE_THRESHOLDS`, never surfaced in UI. Environments with speech scoring off simply never produce these two memory types — the Journal records only what truly happened |
| D6 | Gifted-pin UI | **In scope**: per-line pin control in shadowing + dictation transcript surfaces (the API shipped in Core has zero callers; a Journal without it launches half a book) |
| D7 | Architecture | **Pure core + thin React shell** (see §3) |
| D8 | `first_meeting` trigger | **Domain event, not UI observation**: *the learner opens the Journal* → `POST /api/companion/meet`, idempotent server-side. Every Journal begins with a first-meeting page whose `occurred_at` is the moment the book was first opened |
| D9 | Empty-state writing rule | Companion copy **looks forward, never apologizes for the present**. Never "no memories yet / journal is empty"; always the stories still waiting ("Trang đầu tiên đang chờ những câu chuyện chúng ta sẽ cùng khám phá."). This is a standing content rule for all future Companion copy, not just this plan |

## 3. Module map (D7)

```
lib/companion/presence/            # PURE TS — no React, no I/O. Deterministic (§12.2).
  contexts.ts      # ExperienceContext union + the priority class of each context
  state-machine.ts # CompanionState (Idle|Observing|Listening|Speaking|Silent)
                   # + transition(state, event) → state   (Spec 1 §5.8)
  arbitration.ts   # resolve(pending[], cooldown, now) → Address | Silence  (§5.10)
  speech.ts        # (context, phase) → companion.* i18n key
  config.ts        # COOLDOWN_WINDOW_MS (~90s, tuning constant), TARGET_SCORE = 80,
                   # MASTERY_ATTEMPTS = 3

components/companion/              # thin React shell
  ambient-provider.tsx  # "use client"; mounted in app/[locale]/(app)/layout.tsx
                        # wrapping <main>. Holds reducer state (machine + cooldown +
                        # pending contexts); exposes the 4-verb API via context.
                        # Survives client-side navigation — a context emitted on a
                        # dormant loop surface is still pending on the next
                        # anchored surface.
  use-companion.ts      # hook exposing EXACTLY the four verbs (Spec 1 §5.9):
                        # getCurrentState / emitContext / openJournal /
                        # requestReflection (stub: resolves "unavailable"; the
                        # Companion then simply says nothing — §6.3)
  companion-anchor.tsx  # slot: a surface that invites the Companion renders this
                        # with a pose ("sitting"|"standing"|"reading"). Renders
                        # sprite + bubble from provider state. Takes NO dialogue
                        # props — surfaces announce, never script (§5.12).
  companion-sprite.tsx  # placeholder SVG per D2. Focusable button, translated
                        # aria-label, activate = openJournal(). Light CSS idle
                        # motion behind the existing prefers-reduced-motion
                        # kill switch; randomness allowed here ONLY (expressive
                        # rendering, §12.2).
  speech-bubble.tsx     # renders the chosen companion.* template. aria-live=
                        # "polite". Dismiss on click/Esc; may auto-fade (~8s) —
                        # ending a finished address is presentation, not a
                        # timer-initiated behavior, so §5.7's no-fixed-timer rule
                        # is not violated.
```

**Core rules:**

- Every *meaningful* decision (speak/stay silent, what, when) lives in the pure modules —
  deterministic-replay tests are plain unit tests, no RTL.
- **§5.4 is enforced structurally by a scan test**: no `CompanionAnchor` may appear under a
  learning-loop route (shadowing, dictation, kanji/vocab/mining review, jlpt runner + `/jlpt-test`,
  `reading/[id]`, conversation). Same mechanism as L9a's logical-properties scan. `emitContext`
  is callable anywhere — emitting is not appearing.
- **No new read endpoints**: phase = `GET /api/user/stats` (xp → `relationshipPhaseForXp`), memories
  = `GET /api/companion/journal`. The provider fetches stats once, only when an anchor actually
  mounts (dormant surface = zero requests). It does **not** diff the journal to detect new
  memories — event speech comes from client-emitted contexts; losing them on full reload is by
  design (dialogue is ephemeral, non-canon, Spec 1 §6.2).

## 4. Anchors (D3)

| Surface | Pose | Notes |
|---|---|---|
| Dashboard | sitting — beside the level/progress card | where post-session contexts usually land |
| `/journal` | reading — beside the header | quiet presence; emits `entering_journal` |
| Videos empty state | standing — centre of the emptiness | existing empty-state feature copy stays; the Companion adds one short line of its own (D9 rule) |
| Mining deck empty state | standing | same pattern |

A surface with no anchor leaves the Companion dormant (Spec 1 §5.2) — dormant ≠ reset; provider
state persists (§5.11).

## 5. Journal UI + gifted pin

**`/journal`** (`app/[locale]/(app)/journal/page.tsx` + `components/companion/journal-*.tsx`):

- Vertical timeline strictly by **`occurred_at`** (API already sorts). Each memory is a "page":
  title (template or the learner's own) · date · `line_text_jp` when present · gifted note ·
  a *subtle* kind marker (discovered vs gifted). Sparse and calm — a keepsake, never a log.
- **"Return to the moment"**: memories with a video pointer link to
  `/videos/[id]/shadowing?line=<id>`; the shadowing page gains minimal query-param handling
  (select + scroll to that line on mount). Nothing more.
- **Nav**: add `nav.journal` (en+vi + pin-test update; existing namespace, no 5-step registration).
- **Empty journal**: anchor pose "reading" + a D9-rule line. (In practice the first open
  also fires `first_meeting` — §6 — so the empty state is a single-moment sight.)

**Gifted pin** ("this line gave me chills"):

- Per-line pin control in the shadowing **and** dictation transcript panes, next to the existing
  mine control. Activate → small dialog (L9a `components/ui/dialog` primitive): shows the line,
  optional note textarea → `POST /api/companion/memories` (shipped: `pinMemorySchema`, `PIN_LIMIT`).
- This is ordinary learner UI, **not** Companion speech: errors show translated states
  (reuse `common.errors.network` — record the +1 consumer per L9a convention #5); 429 handled.
  Pinning inside a learning loop does not violate §5.4 — the learner writing in their own book is
  not the Companion appearing; the Companion stays dormant there.
- Success → `emitContext("memory_created")`; the Companion may acknowledge it later on an anchored
  surface (low priority class — ambient flavor).

## 6. Producers & data flow

Server-side, inside the existing capture gate (best-effort, never-throw — the shipped pattern):

| Producer | Trigger | `is_anchor` | Dedupe |
|---|---|---|---|
| `first_shadow` | the pronunciation-score **write** (`scorePronunciation`, `lib/data/pronunciation.ts`) persists `pronunciation_score ≥ TARGET_SCORE` onto a session — scores do not exist at session creation (Azure fills them in later), so the score write is the real domain event | ✅ | once per lifetime |
| `line_mastered` | a write reaching 80 **and** the same `transcript_line_id` has ≥`MASTERY_ATTEMPTS` attempts **and** at least one earlier attempt scored <80 (it *finally* got there — first-try success is `first_shadow`'s territory, not mastery-through-struggle) | — | per line |
| `first_video_completed` | progress write marking the first-ever completed video | ✅ | once per lifetime |
| `first_meeting` | the Journal page's server render calls `recordFirstMeeting()` (best-effort, idempotent — the first open wins). Planning-time simplification of D8's `POST /api/companion/meet`: same domain event ("the learner opens the Journal"), same idempotent server-side capture, but no extra HTTP round-trip and the first view already contains the page. Precedent: L5's lazy furigana cache writes on read | ✅ | once per lifetime |

- `first_shadow`/`line_mastered` hook the score write in `scorePronunciation` (NOT `recordActivity`,
  which fires at session creation before any score exists — verified at planning time).
- `line_mastered` queries line history **only when** the current attempt reaches 80 (cheap guard).
- The video-progress write path is verified at plan time; if it does not pass through
  `recordActivity`, the capture call hooks that write path directly with the same never-throw
  pattern.
- `/api/companion/meet`: thin route — `requireUser`, rate-limited (repo convention for writes),
  idempotent via the dedupe key.

**Client flow:** anchor mounts → provider fetches phase (once) → contexts arrive
(`emitContext`) → `arbitration.resolve` picks at most one address (or silence) → state machine
enters Speaking → bubble renders the `speech.ts`-chosen template → dismissed/faded → Silent → Idle.
Cooldown is by experience window, not per route (§5.10).

## 7. Degradation & failure isolation

Any Companion fetch/write failure → the Companion simply stays Idle or dormant. No toast, no error
state, no infrastructure vocabulary anywhere near the learner (Spec 1 §6.3); `console.error` for
developers (L9a convention #4). `requestReflection()` in this plan always resolves "unavailable" →
perfect silence. The pin dialog is the one exception by design: it is learner UI and shows
translated error states. Nothing in this plan can block the core loop (§6.5).

## 8. i18n

New keys in `companion.*` (speech templates, keyed by context; phase passed through `speech.ts` for
future register shifts) and `nav.journal` — en + vi with identical key trees, ICU placeholders
identical per key, vi plural = CLDR `other` only, pin tests updated from pre-extraction copy.
All per the L9a permanent invariants. All Companion copy obeys D9 (forward-looking rule).

## 9. Testing (maps Spec 1 §8 → this build)

- **Pure core**: state-machine transition table; arbitration determinism (same inputs → same
  decision), priority order, burst-of-contexts → exactly one address, cooldown window; config
  constants exported for tests.
- **Structural scan (§5.4)**: no `CompanionAnchor` under learning-loop routes.
- **Producers**: qualifying event creates the memory / sub-threshold does not / double-fire is
  idempotent / `line_mastered` requires all three conditions / anchor flags correct — on the
  existing `supabase-mock` harness. `meet`: 401/429/idempotency.
- **Journal UI (RTL)**: `occurred_at` order, gifted note rendering, D9 empty-state copy,
  return-to-moment href; swap-proof assertions for type-interchangeable pairs (L9a convention #3).
- **Pin UI**: dialog flow, payload, 401/429, translated errors, keyboard.
- **Sprite/a11y**: focusable, translated aria-label, reduced-motion strips idle animation.
- **Mutation reporting in TWO layers** (catalog vs wiring) per the L9a standing conventions.
- **e2e**: one Playwright smoke — nav → `/journal` renders (joins the existing 5 specs).

## 10. Cleanups folded in

1. `lib/companion/dedupe.ts` — add the `never`-guard to the switch.
2. `lib/companion/phase.ts` — drop the redundant `!`.
3. `lib/companion/companion.test` — remove the dead `@/lib/supabase/service` mock.
4. `pinMemory` — add 400/401/429 unit coverage.
5. ~~**`companion_grew` stored-title template**~~ — **already repaid during L9a Plan 3** (found at
   planning time): discovered memories now persist `title: null`; `memoryTitleFor()` returns an
   i18n descriptor rendered at READ time in the reader's locale, and the `companionGrew.*` catalog
   copy contains no phase index (a pin test guards this). Nothing to do.
