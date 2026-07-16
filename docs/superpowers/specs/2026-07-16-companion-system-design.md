# Companion System — Design Spec

> **Layer 9, Spec 1 of 2.** Spec 1 = **Companion System** (cơ chế). Spec 2 = **Character Identity**
> (tên, lore, hình hài — brainstorm riêng, KHÔNG chặn spec này).
> **Status:** Approved brainstorm (2026-07-16) → feeds the Layer-9 implementation plan.
> **Related:** `CLAUDE.md` (§2 non-negotiables, §5 differentiators), `docs/product/business-model.md`
> (§1 six principles, §1.1 G1–G3, §2.1 Free/Premium rule, §4.2 cost defense), main spec §5.4
> (adaptive furigana — the mechanism the Companion voice reuses), `.claude/docs/workflow.md` (layers).

---

## 0. What this spec is — and what it is not

The **Companion** is the creature that accompanies the learner across all of Nihongo Cinema. This
document defines its **mechanism**: philosophy, principles, data model, presence architecture, the
AI boundary, scope, and extensibility. It does **not** define who the creature *is* or what it
*looks like* — that is **Spec 2 (Character Identity)** and is deliberately kept out so that art and
character work never block engineering.

The split, stated once, load-bearing everywhere below:

> **Spec 1 decides what the Companion does and when. Spec 2 decides who it is and how it looks.**
> The System never depends on the Identity.

---

## 1. Governing philosophy

Every design decision in the Companion System passes through one filter:

> **"Companion không tồn tại để làm người học hạnh phúc. Companion tồn tại để khiến người học cảm
> thấy hành trình của mình có ý nghĩa."**
> *(The Companion does not exist to make the learner happy. It exists to make the learner feel their
> journey has meaning.)*

An interaction that produces dopamine or engagement but does not make the journey more **meaningful**
should not exist. This is the deeper reason behind every "no": no loud level-up popup, no fireworks,
no FOMO, no engagement trick. Every appearance of the Companion must leave the learner feeling:

> *"Có một ai đó đã cùng mình đi qua chặng đường này."* — someone walked this road with me.

A second line summarizes the whole system in one image:

> **"Companion không phải nhân vật chính của câu chuyện. Nó là người sẽ còn nhớ câu chuyện ấy cùng bạn."**
> *(The Companion is not the story. It is the one who remembers the story with you.)*

This one sentence subsumes most of what follows: the learner is the protagonist (P4), the Companion
*keeps* memories rather than creating them (§4, §6.2), it is not the AI (P2), it grows alongside
(P8/P12), and it is present to make the journey meaningful, not to draw attention (P0/P5).

### 1.1 North Star (P0) — the axiom above all principles

P0 is **not a design principle — it is an axiom**. Everything in §2 is merely a *consequence* of it.

> **North Star.** The Companion exists **only** to make the learner feel their journey has meaning.
> Every principle below is merely a consequence of this statement.

This is the shortcut for every future argument. When someone asks *"should we add this animation / this
notification / this feature?"*, no one needs to re-read the spec. They ask one question:

> **Does it make the journey more meaningful?** If not — cut it.

Two ways to stress-test it:

- **Subtraction.** If tomorrow you deleted all gamification, streaks, XP, Premium, and leaderboards, the
  Companion must still have a reason to exist.
- **Dependency.** If the Companion's reason to exist depends on **retention**, the *Character* has
  failed; on **AI**, the *Architecture* has failed; on **UI**, the *Design* has failed. It must be
  strong enough that even if the entire product changes around it, it remains the learner's companion.

### 1.2 P8 — The Companion has its own journey

The learner is not the only one who grows; the Companion grows too — but **not along the same axis**.
(Numbered P8 because it emerged last, placed here because it is a *why*, not a *how*.)

- The learner grows through **knowledge**.
- The Companion grows through **the stories it is allowed to keep**.

It does not become stronger. It does not become smarter. It has simply **witnessed more journeys**. So
the final phase is not the strongest creature — it is the one that has **listened the most**:

> The last phase is not Evolution. The last phase is **Wisdom**.

The two paths run in parallel and **never compete**: the learner grows by learning, the Companion grows
by accompanying. Mechanically, the final phase selects a **different behavior profile** — *what that
profile looks like* (calmer, slower, quieter, or however Wisdom is rendered) is **Character Identity's
(Spec 2)** to decide, not the System's. The System knows only that the profile changes.

### 1.3 P12 — It is not the Companion that grows; the relationship grows

The four phases (Meeting → Companionship → Understanding → Storykeeper) are **not a pet levelling up**.
If only the Companion changed, this would be pet-raising. What actually matures is the **relationship**
between the learner and the Companion. This is already visible in three places at once, with **no new
data axis**: the learner's accumulating **Journal** (§4), the Companion's **relationship_phase** (§4.1), and the
**register** between them that shifts over time (§5.6 — how the two talk changes as the learner grows).
Both parties have changed; neither grows by competing with the other (P8).

---

## 2. Design principles

The principles split into two groups: the **why** (§1 — the **North Star** axiom (P0), plus **P8** and
**P12**) and the **how** (this section — **P1–P7, P9, P10, P11**). The North Star is not a principle but
the axiom the principles are consequences of. Numbering follows discovery order, not document order, so
the index below is the source of truth for what each principle is and where it lives. Same status as the
`business-model.md` principles and G1–G3: a **decision filter, not a guideline**. A feature that fails
one does not ship.

**Principle index**

| # | Principle | Group / where |
|---|---|---|
| P0 | **North Star** (axiom) — exists only to make the journey meaningful | why — §1.1 |
| P1 | A part of the world, not a feature | how — §2 |
| P2 | Represents the journey, not the AI | how — §2 |
| P3 | Reads data, does not own business logic | how — §2 |
| P4 | Never takes the learner's achievement | how — §2 |
| P5 | Protects the learner's focus | how — §2 |
| P6 | Never feels like talking to an AI | how — §2 |
| P7 | A living creature, not merely a reaction | how — §2 |
| P8 | Has its own journey (Wisdom, not Evolution) | why — §1.2 |
| P9 | Has its own bounded memory | how — §2 |
| P10 | Has its own preferences | how — §2 |
| P11 | Is not perfect — but only in the expressive layer | how — §2 |
| P12 | It is the relationship that grows | why — §1.3 |

Supporting principles: *Existence is free, address must be earned* · *A memory is what is memorable,
not what just happened* · *Each side records only what it truly knows*.
Violating a principle is a **defect of the Character Bible**, not merely a UX nit.

- **P1 — Companion is a part of the world, not a feature of the product.**
  The learner must never feel "I am opening the Companion" or "I am using a chatbot." They feel a
  creature is *always accompanying them*. The Companion may have a home (a Journal, a Companion Home)
  — but it is never *locked inside* that home; it lives in the whole world. What is forbidden is
  treating the Companion as an independent, standalone feature.

- **P2 — Companion represents the learner's journey, not the AI.**
  AI is a *capability* the Companion may borrow at Premium (reflection, coaching). The Companion
  itself — presence, growth, memory, voice, companionship — must exist **fully with AI turned off**
  (`AI_PROVIDER=none`, which is the real launch state at almostgone.vn). AI makes the Companion
  *deeper*; it never *creates* the Companion.

- **P3 — Companion reads data; it does not own business logic.**
  It consumes existing sources (§4.5) and interprets them. It never scores, never updates SRS, never
  grants XP, never decides difficulty. It is an interpretation layer on top of the backend that
  already exists.

- **P4 — Companion never takes the learner's achievement.**
  The learner is always the protagonist. The Companion is witness, keeper, and companion — never the
  source of the achievement. It never says "I helped you do this." It says "You did this, and I was
  there."

- **P5 — Companion protects the learner's focus; it never competes with learning.**
  During any learning loop it becomes nearly invisible. This is a *character trait*, not a config:
  *"It does not seek attention. It protects the learner's focus."*

- **P6 — Companion must never make the user feel they are talking to an AI.**
  Even when a reflection is AI-generated, the feeling must be "this is still my Companion," never
  "this is a chatbot." AI is the technology behind; the Companion is the character the user builds a
  relationship with. This governs all future prompt design, tone of voice, and UI.

- **P7 — Companion is a living creature, not merely a reaction.**
  It has its own rhythm of life — it may rest, observe, play, read, wander, or simply exist without
  reacting to the learner. Not every appearance is triggered by a user action; some moments exist only
  as evidence that the Companion is alive in this world. Its growth shows not only in appearance but in
  behavior, posture, and the quiet way it occupies the world. The learner is the protagonist; the
  Companion is another living being who chooses to walk beside them. This principle is made enforceable
  by the supporting principle below (existence vs address) — it is architecture, not just sentiment.

- **P9 — Companion has its own memory, and it is bounded.**
  The Journal keeps the *learner's* memories; P9 gives the Companion a small set of its **own** anchor
  memories — the same objective milestones (first meeting, first successful shadow, first completed
  anime, a JLPT milestone) held in the Companion's point of view: not "the user reached N4" but *"I
  still remember the day you practiced that line until it finally came out."* This is POV narration of
  an event that truly happened — it stays inside "each side records only what it truly knows" and P4
  ("you did this, I was there"), never invented feeling. Its memory is **not infinite**: a reflection
  reads a *bounded* set of anchor + recent memories, never the entire Journal — which keeps it feeling
  like a living creature rather than a database query, and respects the AI cost defense
  (`business-model.md` §4.2). Works fully with AI off: anchors are flagged existing rows, not a
  generated artifact (P2). Mechanism detail in §4.2 / §6.4.

- **P10 — Companion has its own preferences.**
  A living creature has likings that serve no goal. The System defines only the **mechanism** — a
  preference profile that can bias idle-behavior and light dialogue selection. The **concrete**
  preferences (what it likes, what it shies from) belong to Character Identity (Spec 2) and are not
  written here (§9). Preferences manifest only as Idle Life flavor (§5.7): they never create a task,
  never optimize a metric, and never enter a learning loop (P5). They exist so the learner believes the
  Companion truly lives in this world — nothing more.

- **P11 — Companion is not perfect — but only in the expressive layer.**
  A flawless creature quickly becomes a system; small harmless imperfections make it trustworthy. It
  may misjudge a light preference, wait in the Journal while the learner is off studying Kanji, or
  expect a line to be saved that the learner skips. These are **character, not bugs**. **Hard
  boundary:** imperfection is permitted *only* in the expressive / ambient layer (idle behavior, light
  non-factual dialogue). It must **never** touch anything factual — memory capture, growth / XP, data
  integrity, scoring, or learning correctness. The Journal still records only what truly happened
  (§4.3); the capture gate is never "charmingly wrong." Imperfection is a flavor of presence, never an
  excuse for a defect.

**Supporting principles:**

- **Existence is free. Address must be earned.**
  The Companion is always allowed to *exist* in the world of Nihongo Cinema — to rest, read, observe,
  play, watch the rain, or simply sit still on any surface where the Ambient Layer is already present.
  These moments demand no attention, create no task, drive no behavior, and never enter a learning
  loop; they are only evidence that the Companion is a living creature. **Address** is the opposite:
  every time the Companion speaks, initiates an interaction, or actively reaches toward the learner, it
  must be genuinely meaningful. If its presence does not make the learning better or the journey more
  meaningful, the Companion must choose silence. *Existence is free; address must be earned.*
- **A memory is what is memorable, not what just happened.** The Journal must stay *sparse* enough
  that opening it feels like revisiting a keepsake, never reading a log.
- **Each side records only what it truly knows.** The system records objective facts; the learner
  marks emotional ones. The Companion is humble enough never to pretend it can read the learner's
  feelings.

---

## 3. Vision & Charter

### 3.1 Why the Companion exists

To make the learning journey *accompanied* — to turn a sequence of disconnected exercises into a
story someone witnessed with you. It serves `business-model.md`'s decision framework (improves the
personal learning experience, principle 4), never an engagement trick (G1/G3).

### 3.2 Boundary — Companion System ↔ Character Identity

| Companion System (this spec) | Character Identity (Spec 2) |
|---|---|
| Growth & Memory tracks | Name, written lore |
| Discovered vs Gifted memories | Visual / shape / color / animation language |
| Adaptive voice via `user_vocab_progress` | Expression set, gestures |
| Appearance & silence rules | The *appearance* of the 4 phases |
| 4 phases (mechanism + hidden thresholds) | — |
| Free/Premium two-tier | — |

### 3.3 Architectural responsibility — and hard limits

> **Companion reads data; it does not own business logic (P3).**

- **May:** exist idly in the world (§5.7 — existence is free), reflect progress, capture/keep memories,
  speak at rest points, adapt its language, open the Journal.
- **May not:** interrupt a learning loop (P5 / `CLAUDE.md` §2.4), pretend to understand emotion,
  compete for attention, grant its own rewards (P4), push FOMO notifications (G3), or speak about
  infrastructure (§6.3).

### 3.4 Where it appears, where it vanishes

- **Appears** at *rest points*: onboarding, tutorial, pre/post-session, empty state, milestone,
  Companion Journal/Home, Contextual Discovery (as a boundary — §5.5), celebration, special
  occasions. Subject to "presence must be earned" — a rest point with nothing meaningful to say gets
  silence, not a scripted greeting.
- **Vanishes** inside *learning loops*: shadowing, SRS review, dictation, JLPT, pronunciation
  practice, transcript reading. No animation, no popup, no praise. Enforced structurally (§5.4).

---

## 4. Data model — Companion Memory / Journal

### 4.1 Growth track — no new table

The relationship phase is a pure function of existing XP: `relationship_phase = f(user_stats.xp)`,
**4 phases**, thresholds in **code config, never surfaced to the user**. No new column, no user-visible
progress bar.

> **Naming rule.** In code this is `relationship_phase`, **never `stage`** — "stage" imports a game /
> levelling mindset (`stage 2 unlocked`) that P12 explicitly rejects. This doc says *phase*.

The 4 phases are chapters of a *relationship*, not levels — it is the relationship that matures, not
just the creature (**P12**). Working names; final names are Spec 2:

1. **Meeting** (Gặp gỡ)
2. **Companionship** (Đồng hành)
3. **Understanding** (Thấu hiểu)
4. **Storykeeper** (Người lưu giữ câu chuyện)

This is **P8's axis, not power**. Each phase has *listened to more* of the learner's journey than the
last — the final phase is the creature that has heard the most, not the strongest one; **Wisdom, not
Evolution**. Each phase selects a **behavior profile** (its concrete look is Spec 2's, §1.2). XP is only
the mechanism that measures how far the two have walked together — never a power score the user
optimizes.

Transitions are **organic**: no "phase unlocked" screen, no fireworks. A phase change is recorded only
as a quiet Journal page (`companion_grew`, §4.4). Growth reflects *all* valid learning (SRS, kanji, JLPT
included — no serious study feels "uncounted"), because XP already encodes G1 ("XP for completed
learning outcomes, not app activity").

### 4.2 Memory track — one table: `companion_memories`

> **Ownership.** Although presented *through* the Companion, the Journal **belongs to the learner**. The
> Companion is only its keeper (P4). **Persistence scope:** the Companion exists **per learner account**,
> not per device or session — logging out and back in on another device restores the same Companion, the
> same memories, and the same `relationship_phase`.

The only new data the system needs. One table holds **both kinds**, distinguished by `kind`:

| Column | Meaning | §2 note |
|---|---|---|
| `id`, `user_id` | ownership | RLS owner-only (repo pattern) |
| `kind` | `discovered` \| `gifted` | two kinds, one table |
| `memory_type` | event class (§4.3) | |
| `title` | short book-chapter line (§4.4) | template or user-set — **never AI** |
| `video_id`, `transcript_line_id`, `timestamp_seconds` | **pointer** to the moment | pointer only — **no media stored** |
| `line_text_jp` | snapshot of the dialogue line | study text, allowed — NOT a scene image |
| `note` | learner's own words (`gifted` only) | |
| `is_anchor` | the Companion's **own** memory (P9) | a bounded few; drives reflection context (§6.4) |
| `occurred_at`, `created_at` | when it happened / when recorded | |

**Timeline order.** The Journal always sorts by **`occurred_at`**, never `created_at`. A memory belongs
where the moment *happened* in the learner's journey, not when the row was written — so a later backfill
or data migration can never reorder the story.

**§2 no-media, made structural.** Rendering a "film keepsake" = seek the YouTube IFrame to
`timestamp_seconds` + show `line_text_jp` + an optional YouTube thumbnail *reference*. No media byte
ever leaves YouTube; the schema has nowhere to store one.

**Anchor memories (P9).** A small subset of `discovered` memories — the relationship's milestones
(first meeting, first successful shadow, first completed anime, JLPT milestones) — carry `is_anchor`.
These are the Companion's *own* memory: a bounded set it always holds. They are ordinary flagged rows
(no new table, no AI), so the Companion's memory exists intact with AI off (P2).

New memory kinds later (Seasonal, Event…) add a `kind`/`memory_type`, never a new table.

### 4.3 Capture Gate — what keeps the Journal from becoming a log

Discovered memories are **not** produced on every event — only on a small set of **rare transitions**,
each scarce *by construction*. Producers run **server-side** when the source event is written, and are
**idempotent** (never double-capture). The Companion *reads* the result of the backend it does not own
(P3) and *decides whether it is worth keeping*.

Candidate discovered `memory_type`s:
- `first_shadow` — first shadowing line ever to reach the target score (once in a lifetime).
- `line_mastered` — a line practiced repeatedly that *finally* reaches target (score trend up across
  ≥N attempts on the same `transcript_line_id`).
- `mining_saved` — the learner *deliberately* creates a sentence-mining card.
- `first_video_completed`, `jlpt_passed`.
- `companion_grew` — XP crossed a `relationship_phase` threshold (a quiet Journal page, never a popup).

Frequent events (each correct review, each finished shadow, each XP tick) **never** auto-create a
memory. *"A memory is what is memorable, not what just happened."*

**Gifted** memories are the inverse: created only when the learner **actively pins** a transcript line
("this line gave me chills"). The system never guesses this kind.

### 4.4 The `title` field — a book, not a list

Every memory carries a short title so the Journal reads like a book with chapters:
- **Discovered** → a **template** the system fills from the rule ("Câu thoại đầu tiên bạn shadowing
  thành công.", "Ngày [name] bắt đầu bước sang giai đoạn Đồng hành."). Not AI.
- **Gifted** → the learner's own line, or blank if they prefer. Not AI.

Because titles are template-based, the Journal reads as a living diary **even with AI off** — this
directly upholds P2.

### 4.5 Data reuse map

Consumed, never owned: `xp_events` / `user_stats.xp` (growth), `shadowing_sessions`,
`dictation_attempts`, `sentence_mining_cards`, `user_video_progress`, `user_vocab_progress`,
`lib/difficulty`, `lib/japanese`. New storage: **only** `companion_memories`.

---

## 5. Presence architecture

### 5.1 Ambient Layer — a resident, not a component

The Companion is an **ambient presence** owned by the app shell, not mounted per-page. To the user it
is always the **same single creature**; only its state changes with context.

> Surfaces do not own the Companion. The Companion visits surfaces.

### 5.2 Ambient state + per-surface anchors (resolving "ambient" vs "not an overlay")

The Companion is **not** a floating widget. It lives *in* the world:

- **Ambient Layer** owns the creature's *existence and state* (which `relationship_phase`, state-machine
  state, is it speaking).
- Each surface declares an **anchor**: where the creature stands and a nominal pose — sitting beside
  the progress card on the Dashboard, standing center in an empty state, reading beside the learner in
  the Journal, running across and off the Landing, walking ahead to guide in the Tutorial.

> The Ambient Layer decides the Companion is *alive*. The surface decides *where it stands*.

Every surface keeps its own character while the user always feels there is exactly one Companion.

**Presence resolution.** A surface that declares **no anchor** simply leaves the Companion **dormant**
there — Settings, Admin, Billing, and every learning-loop route (§5.4). The Companion **never creates
its own anchor**: if a surface has not invited it, it is not there. Dormant is not gone — its state
persists (§5.11); it is only unrendered.

### 5.3 Context Bus — experience contexts, not business data

Surfaces emit **experience contexts**, never business payloads (upholds P3). Examples:
`entering_dashboard`, `finished_shadowing`, `first_movie_completed`, `empty_library`,
`onboarding_started`, `onboarding_finished`, `memory_created`, `companion_stage_changed`. The
Companion only knows *"something just happened"*; detail is read from existing sources when needed.

### 5.4 The focus boundary is structural

Learning-loop routes are **outside the Ambient Layer's active scope** — the Companion *cannot* appear
there, rather than "remember not to show it." This makes `CLAUDE.md` §2.4 and P5 an architectural
invariant, not a discipline.

### 5.5 Contextual Discovery — a boundary, not a loop

Contextual Discovery sits on the edge between loop and rest. The Companion speaks only at the
*transition after a session ends* ("Có một điều thú vị về cách diễn đạt này…"), then opens Discovery.
It never interrupts mid-focus. Keeps P5 while keeping Discovery connected to the Companion.

### 5.6 Adaptive voice

All Companion speech runs through the **modular-sentence system**: a fixed meaning frame where words
the learner already knows (`user_vocab_progress`) surface in Japanese — reusing `lib/japanese` +
`lib/difficulty`, the same mechanism as adaptive furigana (main spec §5.4). Principle:

> The Companion always communicates at the level the learner can currently understand, and that
> communication itself matures with the learner's journey (comprehensible input / i+1).

Sentences are **composed from reusable parts**, never duplicated per level — this keeps i+1 while
minimizing localization and maintenance load.

### 5.7 Idle Life

Outside learning loops, the Companion is allowed to simply exist. These idle behaviors are ambient
world-building, not interactions: they never request attention, never interrupt the learner, and never
imply a task. They are the concrete expression of **P7** and the "existence is free" principle — the
proof that a living creature is here, not a widget waiting for input.

Growth is expressed not only through appearance but through changes in **posture**, **behavior
profile**, and the quiet way the Companion occupies the world. The Companion System defines only the
*mechanism* that such behavior exists — that a `relationship_phase` selects a behavior profile, and that
the Ambient Layer may render idle states on non-learning surfaces. The **concrete** behaviors,
animations, expressions, and motion language belong to **Character Identity (Spec 2)**: Spec 1 says the
Companion has a life; Spec 2 says what that life looks like.

**Frequency.** Idle behaviors should feel **incidental, not periodic**. No deterministic timer ("every
N seconds") may drive them — a fixed cadence reads as mechanical and breaks the illusion of a living
creature. Idle behavior is occasional and non-rhythmic; the concrete scheduling feel is Spec 2's, but
the *no-fixed-timer* rule is a System constraint.

Idle Life is bound by §5.4 — it exists only where the Ambient Layer is already active, never inside a
learning loop — and by `CLAUDE.md` §2.4: idle motion must stay light and must never become
focus-stealing autoplay.

### 5.8 Companion state machine

The Companion has a small, explicit **state machine** — no animation, just state. Motion (Spec 2) later
maps each state to a look; the System only owns the states and the transitions between them.

```
Idle → Observing → Listening → Speaking → Silent → (Idle)
```

- **Idle** — simply existing (the default; §5.7).
- **Observing** — aware of a context that just arrived on the bus (§5.3), not yet addressing.
- **Listening** — the learner is acting / speaking and the Companion attends without interrupting.
- **Speaking** — addressing the learner (only when *address is earned*).
- **Silent** — deliberately quiet after/instead of speaking (P5; "knowing when to stay silent").

Transitions are driven by the context bus and the address rules, never by a fixed timer. All five states
exist **only** on non-learning surfaces — inside a learning loop the Ambient Layer is inactive (§5.4), so
there is no state at all. `getCurrentState()` (§5.9) returns the current state alongside the
`relationship_phase`.

### 5.9 Companion API

Surfaces never touch Companion data directly. The System exposes exactly **four** capabilities — a
narrow, stable surface so future screens (§10) consume the Companion instead of querying its internals:

| Capability | Purpose |
|---|---|
| `getCurrentState()` | read-only: current `relationship_phase` + state-machine state (§5.8) |
| `emitContext(context)` | a surface reports an experience context onto the bus (§5.3) |
| `openJournal()` | navigate to the Journal |
| `requestReflection()` | ask for an AI reflection — subject to Premium + quota + graceful degradation (§6.3) |

> **No surface accesses Companion data (memories, XP, phase thresholds) directly** — only through these
> four. This keeps the frontend from growing ad-hoc queries into Companion internals, and lets the
> System change its storage or logic without touching a single surface.

### 5.10 Context arbitration & experience cooldown

Many contexts can arrive at once — e.g. `finished_shadowing` **+** `companion_stage_changed` **+** a new
Journal memory **+** "today is Tanabata." The Companion speaks **at most once**; it resolves competing
contexts through a **deterministic priority policy**, never by speaking several times.

Priority order (highest first):

1. **learner milestone** — a real learning achievement
2. **relationship milestone** — a `relationship_phase` change
3. **reflection** — Premium, when earned
4. **seasonal event**
5. **ambient flavor** — idle

Lower-priority contexts may be **delayed or silently discarded** — never queued into a monologue. The
policy is deterministic so every surface resolves identically; it is **not** left to each screen to
invent.

**Cooldown — by experience, not by screen.** Addresses are rate-limited by *experience*, not per route.
Once the Companion has addressed the learner, further eligible contexts within a short experience window
are **suppressed** unless their priority is significantly higher. So a burst of `finish_shadow →
memory_created → dashboard → journal → home` yields **one** address, not five. No fixed number is fixed
here — the window is a tuning constant, consistent with §5.7's no-mechanical-timer rule.

### 5.11 Surface lifecycle contract

A surface's contract with the Companion is minimal and uniform:

```
enter → emitContext() → Companion decides → leave → state persists
```

- On **enter**, the surface declares its anchor (§5.2) and emits its context (§5.3).
- The **Companion decides** whether to observe, speak, or stay silent (§5.10) — the surface never
  decides for it.
- On **leave**, the surface tears down **its own anchor only**; it does **not** reset Companion state.
- Companion state (`relationship_phase`, state machine, cooldown) lives in the Ambient Layer and
  **persists across navigation** — it is never per-surface, and cleanup of it is never a surface's job.

---

## 6. Free / Premium & the AI boundary

### 6.1 The value line

Per `business-model.md` §2.1 (*computed-from-your-data = free; AI-authored-over-it = premium*):

| Capability | Free (no AI) | Premium — AI Sensei (a capability the Companion *borrows*) |
|---|---|---|
| Presence, 4 phases, adaptive voice | ✅ | |
| Journal: discovered + gifted memories, template titles | ✅ | |
| Re-reading, seeking back to a moment | ✅ | |
| AI Reflection (commentary over the Journal) | | ✅ |
| AI Coaching / Personalized Advice | | ✅ |
| AI Weekly Review | | ✅ |

The Companion **is** the left column. The right column is capability it *borrows* with Premium — not a
different entity. Same creature, "speaking more deeply." **Premium never creates the Companion**: it
does not unlock it, make it appear, make it grow, or open more Journal. It only adds depth to the
mid-journey conversation.

### 6.2 AI reads the Journal; it never writes it

AI reflection is **present-tense conversation**, not a Journal entry. Memories are earned events (P4);
if AI could author entries, the Companion would start taking the spotlight and the Journal would stop
being "only what truly happened." Reflections render as in-place voice and are **never** written to
`companion_memories`. AI may read the Journal; AI may not write the Journal.

**Canon rule.** Companion dialogue is **ephemeral** — a reflection said today may be gone tomorrow, and
that is fine. Only **recorded memories** (`companion_memories`) are **canon**. This is exactly what makes
it safe to change prompts, models, or the whole reflection layer later: nothing the Companion *says* is
load-bearing; only what the learner and the capture gate *record* is.

### 6.3 Graceful degradation (P2 and P6 in practice)

Three states stop AI: `AI_PROVIDER=none` (launch), quota exhausted (`business-model.md` §4.2 cost
defense), or unconfigured. In **all three** the Companion must not break:

- It silently returns to its normal templates. **No mention, no apology, no explanation.**
- It **never speaks about infrastructure** (provider, quota, timeout, rate limit, backend errors) —
  the creature lives in the world of Nihongo Cinema and does not know an API exists (P6).
- It **never lies** — no fabricated emotional excuse ("I thought with you a lot today"). It simply has
  nothing extra to say today.
- Free users and quota-exhausted Premium users see the **same intact Companion**, only without the
  reflection layer.

AI Reflection is a **rate-limited, per-user-quota'd** endpoint (`CLAUDE.md` §6, spec §8,
`business-model.md` §4.2), speaking the AI port (`lib/ai`) — never an SDK directly.

### 6.4 Bounded reflection context (P9)

A reflection **never reads the entire Journal**. Its context is a *bounded* set of exactly three layers:

> **Anchor + Recent + Current Session.**

- **Anchor** — the Companion's own milestone memories (`is_anchor`, §4.2).
- **Recent** — a small recent window of memories.
- **Current Session** — what the learner is doing *right now* (e.g. just studied 逃げる), so the
  reflection speaks to the present moment, not only the past.

Three layers, nothing more. This is P9 made concrete: the Companion has a memory, but a finite one, so
it feels like a creature that *remembers what matters* rather than a query over a database. It also
protects the AI cost defense (`business-model.md` §4.2): reflection token cost stays bounded as the
Journal grows, instead of climbing with every memory the learner accumulates.

### 6.5 Failure isolation

The Companion and its subsystems are **optional to the act of learning**. Failure of *any* optional
subsystem — reflection, memory capture, Journal read, ambient rendering — must **never** prevent the
learner from continuing to study. The core loop (Video → Shadowing → Dictation → SRS → Mining) does not
depend on the Companion; if a Companion subsystem errors, it fails **silently and locally** (P6 — no
infrastructure talk to the user) while study continues untouched. This is the runtime form of the North
Star: the Companion serves the journey; it never stands in its way.

---

## 7. Placeholder-first contract

Placeholder is not just a temporary image — it is the **interface contract** between the Companion
System and Character Identity.

- The System, the surfaces, and the motion layer **must not depend on assets**.
- Real assets are merely an *implementation* of that contract; replacing the entire Character Design
  must not change the Companion System.

Minimum to unblock all of L9b without waiting on art:
1. a **placeholder sprite** (neutral shape holding the correct anchor/size);
2. a **template voice** sufficient for every surface;
3. **anchors** declared per surface (position + nominal pose).

Everything else (both tracks, capture gate, Journal, context bus, AI degradation) is built and tested
on the placeholder. When Spec 2 + assets arrive, they swap the sprite and pour expression/animation
into the existing anchors — **no logic changes**. This turns "we don't yet know who draws it" from a
blocker into an ordinary schedule item.

**Character Swap Invariant.** Replacing the *entire* Character Identity (Spec 2) — name, look, every
asset, expression set, behavior-profile rendering — must require **zero** migration of Companion data or
behavior logic. Identity plugs into the placeholder contract; the System's schema, state machine, capture
gate, arbitration policy, and API stay byte-for-byte the same. This is an architectural promise, not an
aspiration — and it is what lets Spec 2 be brainstormed, redesigned, or replaced at any time without ever
touching Spec 1.

---

## 8. Testing (TDD, deterministic — `CLAUDE.md` §7)

- **Each capture-gate rule** → unit tests: a qualifying event *does* create a memory, a frequent event
  *does not*, and capture is **idempotent**. Most fragile part — test first.
- **AI degradation** → tests: `AI_PROVIDER=none` / quota exhausted → Journal intact, no error, no
  infrastructure leak (verifies P2 + P6).
- **RLS** → owner-only on `companion_memories` (repo pattern).
- **Presence Consistency** (experience test, not just UI) → across surfaces the Companion is always the
  **same individual**; only position, pose, expression, and dialogue change. Identity is continuous —
  the Dashboard, the Journal, and the Tutorial are never three different Companions.
- **Idle Life Boundary** (P7 + §5.7) → idle behaviors occur **only** on non-learning surfaces and
  **never** inside learning loops; idle behaviors never trigger focus-stealing animation, dialogue,
  notifications, or interactions; a `relationship_phase` transition changes the *selected behavior profile*, while the
  concrete animation assets remain Character Identity's (Spec 2) responsibility.
- **Anchor memory + bounded reflection** (P9 + §4.2/§6.4) → anchors are a bounded set of `discovered`
  milestones; a reflection's context is exactly Anchor + Recent + Current Session and **never** the whole
  Journal; anchors exist and render with AI off.
- **Journal timeline order** (§4.2) → the Journal sorts by `occurred_at`, never `created_at`; a row
  inserted late (backfill) lands at its `occurred_at` position, not the end.
- **Phase function + naming** (§4.1) → `relationship_phase = f(xp)` is pure with exact threshold
  boundaries; the identifier is `relationship_phase`, never `stage`.
- **State machine** (§5.8) → states exist only on non-learning surfaces; no transition is driven by a
  fixed timer; `getCurrentState()` returns state + `relationship_phase`.
- **Companion API surface** (§5.9) → surfaces reach Companion only via the four capabilities; no surface
  reads memories/XP/thresholds directly.
- **Imperfection boundary** (P11) → intentional imperfection is confined to the expressive/ambient
  layer; it **never** alters memory capture, growth/XP, scoring, or any stored data. Property-style
  check: no code path in the capture gate, phase function, or data writes has a deliberate-inaccuracy
  branch — the Journal records only what truly happened regardless of expressive state.
- **Context arbitration + cooldown** (§5.10) → given several simultaneous contexts the Companion
  addresses **at most once**, resolving by the fixed priority order (deterministic — same inputs, same
  choice); a burst of eligible contexts inside one experience window yields a single address unless a
  much higher priority arrives; discarded contexts never queue into a monologue.
- **Presence resolution + persistence** (§5.2/§5.11) → a surface with no anchor leaves the Companion
  dormant and never auto-anchors; Companion state survives navigation and is restored per account on a
  new device/session, not per device.
- **Failure isolation** (§6.5) → with reflection, memory capture, Journal read, or ambient rendering
  forced to error, the core loop still completes and no error surfaces to the learner.
- **Character Swap Invariant** (§7) → swapping every Character-Identity asset requires no schema
  migration and no change to capture gate / state machine / arbitration / API.
- **Seasonal is additive** (§10) → a seasonal layer can alter expression/dialogue but a test asserts it
  cannot write `relationship_phase`, memories, or any learning data.

---

## 9. Scope fence — mechanism, not content

Spec 1 decides **mechanism**, never **content**. It does **not** contain:

- real dialogue, tutorial scripts, onboarding scripts, celebration copy, or AI Reflection prompts;
- name, written lore, the 4-phase appearance, visual/shape/color/animation language, expression set,
  and the **concrete preference list** (P10 — what it likes / shies from) → **Spec 2 (Character
  Identity)**;
- real asset production (illustrator / SVG / AI-prototype) → **after Spec 2**, once resourcing is known.

Spec 1 defines only: **when** the Companion appears, **how** it is allowed to speak, **where** it reads
data, and **what** it must not do. Concrete content belongs to each surface's own later spec — this
keeps Spec 1 from swelling into a UX-writing document.

---

## 10. Extensibility — designed for the whole future, not just L9

The Companion System must let future surfaces join **without architectural change**. A new surface —
Live Event, Community, Reading Mode, Mobile app, Apple Vision Pro, Watch companion — participates by:

1. declaring an **anchor** (§5.2),
2. emitting **context** on the bus (§5.3 / `emitContext`),
3. consuming the **Companion API** (§5.9) — never touching Companion data directly.

No rewrite of the system.

**Seasonal / event behavior is additive only.** A seasonal layer (Christmas, Tanabata, New Year) may
affect **expression or dialogue** only. It must **never** touch `relationship_phase`, memories, or any
learning logic. An event *dresses* the Companion; it never changes who it is or what it has recorded — so
no seasonal feature can corrupt the character or the canon (§6.2).

> **The Companion is not a Layer 9 feature. Layer 9 is simply the first place where the Companion
> becomes visible.** It always belonged to the world; L9 is only where the learner first sees it.

So that Character Identity, UI, Motion, Asset, AI Reflection, or any later feature all bind to one
foundation instead of redefining the Companion their own way.

---

## 11. Build placement

Companion System lands in **L9b**, on top of **L9a** (i18n for the modular-sentence voice; design
system for the anchors). It runs in parallel with the other L9b surfaces and does not depend on Spec 2.
