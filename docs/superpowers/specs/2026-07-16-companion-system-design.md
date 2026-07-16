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

---

## 2. Design principles

Six pillars (**P1–P6**) plus three supporting principles. Same status as the `business-model.md`
principles and G1–G3: a **decision filter, not a guideline**. A feature that fails one does not ship.
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

**Supporting principles:**

- **Presence must be earned.** *"Companion không xuất hiện vì hệ thống có cơ hội. Nó chỉ xuất hiện
  khi sự hiện diện của nó làm trải nghiệm có ý nghĩa hơn."* The Companion does not appear because the
  system has an opportunity; only when its presence makes the experience more meaningful.
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
| Appearance & silence rules | The *appearance* of the 4 stages |
| 4 stages (mechanism + hidden thresholds) | — |
| Free/Premium two-tier | — |

### 3.3 Architectural responsibility — and hard limits

> **Companion reads data; it does not own business logic (P3).**

- **May:** reflect progress, capture/keep memories, speak at rest points, adapt its language, open
  the Journal.
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

Stage is a pure function of existing XP: `stage = f(user_stats.xp)`, **4 stages**, thresholds in
**code config, never surfaced to the user**. The UI renders the creature for the current `stage`.
No new column, no user-visible progress bar.

The 4 stages are chapters of a *relationship*, not levels (working names; final names are Spec 2):

1. **Meeting** (Gặp gỡ)
2. **Companionship** (Đồng hành)
3. **Understanding** (Thấu hiểu)
4. **Storykeeper** (Người lưu giữ câu chuyện)

Transitions are **organic**: no "Stage 2 unlocked" screen, no fireworks. A stage change is recorded
only as a quiet Journal page (`companion_grew`, §4.4). Growth reflects *all* valid learning (SRS,
kanji, JLPT included — no serious study feels "uncounted"), because XP already encodes G1 ("XP for
completed learning outcomes, not app activity").

### 4.2 Memory track — one table: `companion_memories`

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
| `occurred_at`, `created_at` | when it happened / when recorded | |

**§2 no-media, made structural.** Rendering a "film keepsake" = seek the YouTube IFrame to
`timestamp_seconds` + show `line_text_jp` + an optional YouTube thumbnail *reference*. No media byte
ever leaves YouTube; the schema has nowhere to store one.

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
- `companion_grew` — XP crossed a stage threshold (a quiet Journal page, never a popup).

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

- **Ambient Layer** owns the creature's *existence and state* (which stage, current expression, is it
  speaking).
- Each surface declares an **anchor**: where the creature stands and a nominal pose — sitting beside
  the progress card on the Dashboard, standing center in an empty state, reading beside the learner in
  the Journal, running across and off the Landing, walking ahead to guide in the Tutorial.

> The Ambient Layer decides the Companion is *alive*. The surface decides *where it stands*.

Every surface keeps its own character while the user always feels there is exactly one Companion.

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

---

## 6. Free / Premium & the AI boundary

### 6.1 The value line

Per `business-model.md` §2.1 (*computed-from-your-data = free; AI-authored-over-it = premium*):

| Capability | Free (no AI) | Premium — AI Sensei (a capability the Companion *borrows*) |
|---|---|---|
| Presence, 4 stages, adaptive voice | ✅ | |
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

---

## 8. Testing (TDD, deterministic — `CLAUDE.md` §7)

- **Stage function** `f(xp)` → pure unit tests, exact threshold boundaries.
- **Each capture-gate rule** → unit tests: a qualifying event *does* create a memory, a frequent event
  *does not*, and capture is **idempotent**. Most fragile part — test first.
- **AI degradation** → tests: `AI_PROVIDER=none` / quota exhausted → Journal intact, no error, no
  infrastructure leak (verifies P2 + P6).
- **RLS** → owner-only on `companion_memories` (repo pattern).
- **Presence Consistency** (experience test, not just UI) → across surfaces the Companion is always the
  **same individual**; only position, pose, expression, and dialogue change. Identity is continuous —
  the Dashboard, the Journal, and the Tutorial are never three different Companions.

---

## 9. Scope fence — mechanism, not content

Spec 1 decides **mechanism**, never **content**. It does **not** contain:

- real dialogue, tutorial scripts, onboarding scripts, celebration copy, or AI Reflection prompts;
- name, written lore, the 4-stage appearance, visual/shape/color/animation language, expression set
  → **Spec 2 (Character Identity)**;
- real asset production (illustrator / SVG / AI-prototype) → **after Spec 2**, once resourcing is known.

Spec 1 defines only: **when** the Companion appears, **how** it is allowed to speak, **where** it reads
data, and **what** it must not do. Concrete content belongs to each surface's own later spec — this
keeps Spec 1 from swelling into a UX-writing document.

---

## 10. Extensibility — designed for the whole future, not just L9

The Companion System must let future surfaces join **without architectural change**. A new surface —
Live Event, Community, Reading Mode, Mobile app, Apple Vision Pro, Watch companion — participates by:

1. declaring an **anchor**,
2. emitting **context** on the bus,
3. consuming the **Companion API**.

No rewrite of the system.

> Companion is not designed for Layer 9. Companion is designed for the whole future of Nihongo Cinema.

So that Character Identity, UI, Motion, Asset, AI Reflection, or any later feature all bind to one
foundation instead of redefining the Companion their own way.

---

## 11. Build placement

Companion System lands in **L9b**, on top of **L9a** (i18n for the modular-sentence voice; design
system for the anchors). It runs in parallel with the other L9b surfaces and does not depend on Spec 2.
