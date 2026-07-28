# Design Docs Reconciliation — Design Spec

> **Status:** LOCKED (brainstorm approved, 2026-07-28, after two revision rounds) → feeds the doc-fix
> implementation plan. Further changes to the *decisions* in this spec go through a new revision, not
> an edit in place.
> **Trigger:** `docs/design/patterns/*.md` (9 files) and `docs/design/screens/*.md` (13 files, 1 empty)
> were drafted as a standalone UI/UX layer *after* the product spec and the Companion System specs
> already existed. They were written without full cross-reference to `japanese-learning-app-spec.md`,
> `docs/product/business-model.md`, or `docs/superpowers/specs/2026-07-16-companion-system-design.md`
> (Spec 1) + its child `2026-07-24-l9b-companion-presence-design.md` (L9b). This produced real
> contradictions between the new design docs, the product spec, and shipped code.
> **Does not itself change product behavior or code.** This is a documentation-reconciliation pass.
> Restyling `components/companion/speech-bubble.tsx` (visual chrome only, see §6) is an explicit
> follow-up, not part of this plan.

---

## 1. Problem

Three layers exist in this repo and were drifting apart:

```
Product Spec (japanese-learning-app-spec.md, business-model.md, Companion System spec)
        ↓
Design Docs (docs/design/patterns/*, docs/design/screens/*)
        ↓
Implementation (app/, components/)
```

The audit (prior turns, this conversation) found:

- The new design docs impose a **blanket ban on gamification** (XP/streak/leaderboard/badge) that
  contradicts `japanese-learning-app-spec.md` §3.9, `business-model.md` §1.1 (G1–G3), and the
  already-shipped Layer 7 `/leaderboard` + Dashboard `StreakCard`.
- Two screen docs (`screen-shadowing-detail.md`, `screen-review.md`) and one pattern doc
  (`study-modes.md`, Review Mode section) describe Companion notes appearing **inside** Shadowing
  and Review — directly contradicting their own sibling doc `companion-patterns.md` (which lists
  both under "Learning Boundary" / Level 0 Hidden) and the L9b structural scan-test that forbids
  `CompanionAnchor` on learning-loop routes.
- `companion-patterns.md` calls the current `speech-bubble.tsx` wrong; it is only wrong about
  **visual language** — the interaction behavior (auto-fade, dismiss, keyboard, live region) is a
  deliberate accessibility decision from L9b and must not be removed.
- `companion-patterns.md`'s "Presence Levels" (Hidden/Ambient/Observe/Address) and the real
  `CompanionState` (`Idle|Observing|Listening|Speaking|Silent`) are two vocabularies for the same
  thing, undocumented as such — a future reader (designer or engineer) would reasonably assume they
  are two different systems.
- Several Companion mentions (Video Detail, Video Library, Mining browse) describe anchors that are
  **not implemented** — L9b (D3) shipped exactly four anchors (Dashboard, `/journal`, videos empty
  state, mining empty state). Nothing marks these sections as future/unbuilt.
- Several cross-references between design docs point at files that don't exist under the stated name
  (`companion-system.md`, `character-bible.md`, `screen-library.md`, `screen-settings.md`).

**Root cause governing all of the above:** the reconciliation must flow spec → design docs →
implementation, never the reverse. Code is evidence for the audit, not authority. Where code and the
new design docs disagree, the product spec decides — not whichever one was written more recently.

---

## 2. Source-of-truth principle (locked)

> Product specifications are authoritative on product truth and behavior.
> Design documentation translates specifications into user experience (UX/UI rules).
> Implementation is audited against **both** — it is evidence, not authority.

Concretely, later/deeper specs override earlier/shallower ones on the *same* question (e.g. L9b's
concrete anchor list overrides Spec 1's open-ended "surfaces declare anchors" only insofar as L9b says
*which* anchors exist **today**; Spec 1 still owns the *architecture*). This principle itself becomes
the opening section of the new `docs/design/design-reconciliation.md` (§8).

**Authority Order.** When two documents disagree, resolve by this order (highest wins):

1. Product specification (`japanese-learning-app-spec.md`)
2. Layer/System specifications (`docs/superpowers/specs/*-l*-design.md`, e.g. L9b) — these define
   architecture, behavior, and product rules, not just implementation shape
3. Business model principles (`docs/product/business-model.md`)
4. Design system rules (`docs/design/design-reconciliation.md` and its children)
5. Screen specifications (`docs/design/screens/*.md`)
6. Implementation details (code, component comments)
7. Experimental drafts (anything not yet approved/merged)

Without an explicit order, the same category of argument (which doc is "more current") resurfaces
every time two docs disagree. This list is what ends that argument going forward — it is not a
one-time ruling for the conflicts already found in §3–§7.

---

## 3. Resolved conflict: Gamification

**Wrong framing (current design docs):** gamification is harmful to learning and must be excluded
(literal "Avoid: XP, Levels, Streak reminders..." lists in `screen-architecture.md`,
`screen-dashboard.md`, `feedback-patterns.md`, `screen-video-library.md`, `screen-review.md`,
`screen-mining.md`).

**Correct framing (per spec):** gamification is a real, ratified, shipped layer (G1–G3 in
`business-model.md`; §3.9 in the base spec; Layer 7 leaderboard, weekly + opt-in + self-comparison
first). It sits **beside** the Companion layer, not inside it:

```
Learning Journey
        |
        +---- Gamification Layer
        |       - XP
        |       - Streak
        |       - Leaderboard
        |       - Badge
        |       (governed by G1–G3: reinforces learning, self-vs-past-self first,
        |        social ranking only once a real social graph exists)
        |
        +---- Companion Layer
                - Memory
                - Reflection
                - Meaning
                (governed by Spec 1 P0–P12: never comments on scores, never
                 takes credit, speaks in accompaniment terms only)
```

The two layers are complementary, addressed to different moments:

- Dashboard (Gamification Layer): *"Bạn đã duy trì 12 ngày học liên tục."*
- Companion (Companion Layer): never *"Bạn đã đạt 500 XP!"* — it does not narrate the Gamification
  Layer's numbers at all, per its own boundary (P4: never takes the learner's achievement).

Design docs must stop prohibiting XP/streak/leaderboard/badge outright. Instead they define
*placement, tone, and the relationship with learning* — and keep Companion silent about the numbers.

**Layer Responsibility Rule** (not "Screen Ownership" — the rule doesn't say a screen owns a layer, it
says each layer owns a category of information, on any screen where both appear). Every screen that
carries both layers must state, explicitly, what each layer is responsible for. Example (Dashboard):

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP change |

Concretely:

- Không: *"Wow, bạn vừa nhận thêm 20 XP!"* (Companion narrating a Gamification-Layer event)
- Có: *"Hôm nay bạn đã quay lại với một đoạn hội thoại quen thuộc."* (Companion narrating its own
  layer — memory/journey — regardless of what the XP counter did)

This table becomes a required subsection (§3 of `design-reconciliation.md`, one per screen that shows
both layers) rather than a one-off note.

---

## 4. Resolved conflict: Companion Presence mapping

Keep "Presence Levels" as the design-facing vocabulary — it is not a competing model, it is a
translation of the real state machine that was never written down. Add this table verbatim to
`companion-patterns.md`:

| Design Concept | Runtime State | Meaning |
|---|---|---|
| Hidden | Dormant / No Anchor | Companion không tồn tại trên surface |
| Ambient | Idle | Companion hiện diện nhưng không tương tác |
| Observe | Observing | Companion notices context |
| Listening | Listening | Companion stays present while learner acts |
| Address | Speaking | Companion chủ động giao tiếp |
| Silent | Silent | Quyết định không nói (context đã emit nhưng Companion chọn im lặng) |

Without this table a designer reads "Presence Level" and an engineer reads "State Machine" as two
unrelated systems. The table is the fix, not a redesign.

**Why Listening gets its own row instead of folding into Observe:** today the two look identical in
UI (nothing distinguishes them on screen), which is why the first draft of this table merged them.
But `Listening` is reserved for a different situation — Companion staying present *while the learner
is actively doing something* (voice practice, conversation, speaking mode), as opposed to `Observing`,
which is Companion noticing a context that already happened. Collapsing them now would erase a
distinction the state machine already models, right before voice/conversation surfaces are built out.
Keep both rows even though they render the same way today.

**Dormant is not Silent.** These read as similar ("Companion isn't saying anything") but are two
different axes and must not be collapsed into one idea:

- **Presence existence** — Dormant vs. Active. Dormant means no anchor was declared on this surface;
  the Companion has no way to appear here at all (§7's "Not Supported"/no-anchor case).
- **Interaction state** — Idle / Observing / Listening / Speaking / Silent. All five only apply once
  presence is Active. `Silent` specifically means: a context was emitted, the Companion evaluated it,
  and *chose* not to speak (§5.10 arbitration in Spec 1) — a decision, not an absence.

A surface that is Dormant never reaches the interaction-state axis at all. A surface that is Active and
`Silent` had a real decision made and rejected. Documenting both under "Hidden" would erase that
distinction and make silence look like a bug instead of a deliberate P0 outcome.

---

## 5. Resolved conflict: Learning Loop Boundary (Shadowing / Review)

This is the most serious defect found — the new docs contradict *themselves*, not just the spec.
`companion-patterns.md` already states Shadowing and Review are Level-0/Hidden ("Learning Boundary"
section), and L9b's scan test structurally forbids `CompanionAnchor` on those routes — yet
`screen-shadowing-detail.md`, `screen-review.md`, and `study-modes.md` (Review Mode section) each
added their own "# Companion" section describing notes appearing inside those exact flows.

**Rule to state explicitly** (new, added to `design-reconciliation.md` and referenced by every screen
doc that touches a learning-loop surface):

> **Learning Loop Boundary.** Companion không tồn tại trong: Shadowing practice, Dictation, SRS review,
> Mining review session, Pronunciation evaluation, JLPT practice, Grammar practice, Vocabulary review,
> Kanji practice, Conversation drills.
> Không phải vì Companion "không muốn" — vì focus của learner là nhân vật chính trong loop đó.
> Companion xuất hiện **sau khi hoàn thành loop**, không phải **trong** loop.
>
> **General form (covers screens not yet built):** Companion does not appear inside active
> acquisition loops. **The boundary is conceptual, not route-based** — the named list (Shadowing,
> Dictation, SRS review, Mining review session, Pronunciation evaluation, JLPT practice, Grammar
> practice, Vocabulary review, Kanji practice, Conversation drills) is illustrative, not exhaustive.
> **Any future active acquisition loop inherits Hidden by default.** A screen must justify an
> exception to appear; an exception does not need to justify staying Hidden. This exists specifically
> so a new route that isn't on the list is never read as "therefore Companion is allowed" — the test
> is "is this an active acquisition loop," not "is this route named in the boundary doc."

Action: replace the "# Companion" sections in `screen-shadowing-detail.md` and `screen-review.md`,
and the Review Mode "Companion Behavior" subsection in `study-modes.md`, with a short "✕ Not
Supported" statement per §7 — i.e. don't just delete the section, state *why* Companion is absent
(Learning Loop Boundary) so the reason stays documented rather than only the silence. `screen-mining.md`'s
Companion mention stays as-is — it describes the Mining *browse/collection* surface, not the Mining
*Review Session* route (`components/video-player/mining-review-session.tsx`), which is a distinct,
already-excluded learning-loop route.

---

## 6. Resolved conflict: Speech Bubble

**Correction to the prior report's framing** (per user): do not say "speech bubble is wrong." Say:

> Speech bubble hiện tại **đúng về interaction behavior**, **sai về visual language**.

| Keep (interaction behavior — accessibility-driven, do not touch) | Change (visual language only) |
|---|---|
| Auto-fade (~8s) | Chat-assistant bubble chrome (border/shadow/rounded card) |
| Dismiss button (click/Esc) | → Handwritten companion note styling |
| Keyboard accessibility | |
| Persistent live region (`role="status"`, always mounted) | |

Removing the dismiss control to look more like a "note" would break the accessibility contract
documented directly in `speech-bubble.tsx`'s own comments (screen readers need a persistent live
region whose *text* changes, not a conditionally-mounted bubble). `companion-patterns.md`'s
"Không có nút OK" line is about *not requiring confirmation to proceed* (true today — the note
already auto-fades, nothing blocks on it) — it is not license to remove the optional early-dismiss
affordance.

> **Handwritten Note is a visual pattern, not a replacement interaction pattern.**
> It is a skin. It changes border/shadow/font treatment; it does not change what mounts, when it
> dismisses, or how it announces to assistive tech. State this explicitly in
> `companion-patterns.md`, or a future engineer reading "Handwritten Note" will reasonably assume
> "Handwritten Note = drop the dismiss button" and regress accessibility while trying to match the
> new visual spec.
>
> **Visual simplification must not remove semantic functionality.** The dismiss affordance, the
> accessibility behavior, the live region, and keyboard support are the interaction *contract* — they
> stay fixed under any future restyle. Only the visual treatment is free to change.

**Scope note:** actually restyling `speech-bubble.tsx` (CSS/visual only) is *not* part of this
reconciliation pass — it's a follow-up implementation task once the doc correction ships.

---

## 7. Resolved conflict: Anchor availability (now vs. future)

Design docs must visibly separate what L9b shipped from what the architecture merely allows — and
from what the Learning Loop Boundary (§5) permanently forbids. Two states ("Future Concept" /
everything-else) aren't enough, because "not built yet" and "not allowed to exist" need to read
differently. Three states:

- **Available** — L9b (D3) shipped this anchor today.
- **Planned** — architecture allows it (Spec 1 §5.2, any surface may declare an anchor), simply not
  built in L9b yet. A future plan can add it by declaring the anchor — no architecture change needed.
- **Not Supported** — forbidden by the Learning Loop Boundary (§5). Not a backlog item; adding an
  anchor here would need the *boundary rule itself* to change, not just a build.

| Surface | Status | Reason |
|---|---|---|
| Dashboard | Available | L9b shipped this anchor (D3) |
| `/journal` | Available | L9b shipped this anchor (D3) |
| Video Library (empty state) | Available | L9b shipped this anchor (D3) |
| Mining deck (empty state) | Available | L9b shipped this anchor (D3) |
| Video Detail | Planned | Architecture allows it (Spec 1 §5.2); not yet built |
| Mining Browse (non-empty) | Planned | Architecture allows it (Spec 1 §5.2); not yet built |
| Video Library (non-empty) | Planned | Architecture allows it (Spec 1 §5.2); not yet built |
| Shadowing | Not Supported | Active acquisition loop (Learning Loop Boundary, §5) |
| Review | Not Supported | Active acquisition loop (Learning Loop Boundary, §5) |
| Dictation / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (Learning Loop Boundary, §5) |

**Not Supported is a restriction, not a status.** Unlike Planned, it does not mean "not built yet" —
it means the Learning Loop Boundary forbids the anchor from existing at all. Moving a row from Not
Supported to Available requires changing the boundary rule itself (§5), not just shipping a feature.

Companion mentions in `screen-video-detail.md`, `screen-video-library.md`, and the non-empty part of
`screen-mining.md` get an explicit "○ Planned — chưa implement (L9b chỉ có 4 anchor)" marker so a
future reader doesn't assume L9b already supports it. `screen-shadowing-detail.md` and
`screen-review.md` get "✕ Not Supported" instead of being silently deleted (§9), so the *reason*
Companion is absent stays documented, not just the absence itself.

---

## 8. New artifact: `docs/design/design-reconciliation.md`

Its H1 is **"Design System Governance & Reconciliation"**, not just "Reconciliation" — the file's job
extends past fixing today's 9+13 files: it is the standing law any *new* screen or pattern doc must
follow. The filename stays `design-reconciliation.md` (no rename needed, only the title changes).

Created **before** any of the 9+13 files are edited, so every subsequent fix references one shared
set of rules instead of each screen doc re-deriving its own. Contents (sections only — full prose
written when the file is created):

1. **Source of Truth** — the §2 principle above, verbatim, including the Authority Order list.
2. **Companion Rules** — never interrupts learning loops; presence controlled by Ambient Layer; does
   not own gamification; does not replace progress systems.
3. **Gamification Rules** — exists per G1–G3; design docs must not prohibit XP/streak/leaderboard/
   badge; they define placement, tone, relationship with learning instead; every screen carrying both
   layers documents a Layer Responsibility table (§3 above).
4. **Screen Documentation Rules** — every screen spec must define: Purpose, User state, Primary
   action, Secondary actions, Empty states, Loading states, **Success states** (distinct from empty —
   completing a video, finishing shadowing, hitting a milestone, unlocking content), Error states,
   Companion behavior, Gamification behavior, Accessibility considerations.
5. **Companion Documentation Rules** — every mention of Companion must specify: Presence level
   (§4 table, including Listening), Anchor availability (Available / Planned / Not Supported, §7),
   Context trigger, Learning boundary.
6. **Design Evolution Principle** — closing section, applies to every future edit of every design doc,
   not just this reconciliation pass:

   > New design documentation may improve: clarity, usability, emotional quality, consistency.
   > It may not silently redefine: product goals, business rules, learning philosophy, system
   > architecture.
   >
   > A change to *how something is presented* is a design-doc edit. A change to *what is true about
   > the product* is a spec edit — proposed against the Authority Order (§1), not slipped into a
   > pattern or screen file.

7. **Design Document Lifecycle** — every design document (pattern or screen doc) declares exactly one
   of four states, stated at the top of the file next to its version:

   | State | Meaning |
   |---|---|
   | Draft | Exploration only. Cannot override existing rules; cannot be cited by other docs as settled. |
   | Approved | Defines UX behavior for its scope. Citable by other docs. |
   | Canonical | Referenced by other docs as source of truth for its topic (e.g. `companion-patterns.md` for Companion presence). |
   | Deprecated | Historical reference only; superseded content, kept for context, not followed. |

   This is the mechanism that caused the original problem: `docs/design/patterns/*` and
   `docs/design/screens/*` were created and read as settled the moment they existed, with no marker
   distinguishing "someone's draft" from "the team's ratified rule" — so a Draft-quality document
   silently outranked the product spec in practice. Every design doc touched in Phases 2–3 gets a
   state header; every new doc in Phase 4 starts at Draft and is promoted explicitly, never by default.

This file becomes the doc that `companion-patterns.md`, `feedback-patterns.md`, and every `screens/*`
file link back to, instead of restating the rules inline each time.

---

## 9. File change list (four phases, executed in order)

### Phase 1 — Governance

1. **Create** `docs/design/design-reconciliation.md` (§8). Every later phase links back to this file
   instead of restating rules inline.

### Phase 2 — Foundation patterns

2. `docs/design/patterns/companion-patterns.md` — fix broken references
   (`companion-system.md` → `docs/superpowers/specs/2026-07-16-companion-system-design.md`;
   `character-bible.md` → `MASCOT.md`); add the Presence mapping table incl. Listening (§4); add the
   Learning Loop Boundary rule incl. the general form (§5) as the canonical statement other docs link
   to; correct the Speech Bubble framing (§6 — "correct behavior, wrong visual language," plus the
   "visual pattern, not a replacement interaction pattern" line).
3. `docs/design/patterns/feedback-patterns.md` — remove the blanket rankings/leaderboard ban; replace
   with the Gamification Layer / Companion Layer split + Layer Responsibility table (§3).
4. `docs/design/patterns/study-modes.md` — replace the Review Mode "Companion Behavior" subsection
   with a "✕ Not Supported" statement (§5, §7); link to Learning Loop Boundary.
5. `docs/design/patterns/empty-states.md` — fix reference `screen-library.md` →
   `screen-video-library.md`.
6. `docs/design/patterns/settings-patterns.md` — mark explicitly: no `/settings` route exists yet in
   code; this file is roadmap, not current state.

### Phase 3 — Screen specs

7. `docs/design/screens/screen-architecture.md` — fix the "Avoid: gamification/achievement/streak"
   line per §3.
8. `docs/design/screens/screen-dashboard.md` — fix the "# Progress" section (currently "Avoid XP/
   Level/Streak") to match the shipped `StreakCard`; add the Layer Responsibility table (§3).
9. `docs/design/screens/screen-video-library.md` — same Progress-section fix as #8, plus mark its
   Companion section "○ Planned" (§7) in the same pass.
10. `docs/design/screens/screen-review.md` — replace the "# Companion" section with "✕ Not
    Supported" + reason (§5, §7).
11. `docs/design/screens/screen-shadowing-detail.md` — replace the "# Companion" section with "✕ Not
    Supported" + reason (§5, §7).
12. `docs/design/screens/screen-mining.md` — clarify the existing Companion section applies to
    browse/collection only, not the Mining Review Session route (§5); mark non-empty-state anchor
    "○ Planned" (§7).
13. `docs/design/screens/screen-video-detail.md` — mark its Companion section "○ Planned" (§7).

### Phase 4 — Missing screens backlog (not executed in this plan)

Recorded here so it isn't lost, not scheduled: `screen-journal.md`, `screen-leaderboard.md`,
`screen-community.md`, `screen-conversation.md`, `screen-kanji.md`, `screen-vocabulary.md`,
`screen-grammar.md`, `screen-jlpt.md`, `screen-playlists.md`, `screen-profile.md`,
`screen-settings.md`. Each, when written, must follow the Screen Documentation Rules (§8.4) and the
Learning Loop Boundary general form (§5) from day one — this is what makes Phase 4 a follow-on rather
than another reconciliation pass.

Every item in this backlog is, until written: **Not implemented** (no corresponding doc exists) and
**Not reviewed** (no reconciliation pass has looked at it, unlike the Phase 2/3 files).
`screen-settings.md` in particular is not "an existing feature that lacks documentation" — there is no
`/settings` route in code at all (confirmed during the audit) — it is a **design concept awaiting
implementation**. Whoever picks up Phase 4 must not treat any backlog item as already-approved just
because it's named here; it inherits the governance rules current at the time it's written, and goes
through the same Draft → Approved → Canonical lifecycle as any other design doc (§8.7).

Also out of scope for this plan: restyling `speech-bubble.tsx` (visual chrome only, §6). An explicit
follow-up, not silently folded in here.

---

## 10. Verification

These are markdown documentation edits — no unit tests apply. Verification is a re-read pass per file
against the rules in §2–§8, plus confirming every internal cross-reference (`[[...]]`-style or
relative-path links) in the edited files resolves to a real file. No code changes are made in this
plan, so no build/test/lint run is required; `docs/design/design-reconciliation.md` and the edited
files should simply be committed together with a message describing the reconciliation.
