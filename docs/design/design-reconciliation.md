# Design System Governance & Reconciliation

> **Status:** Canonical
> **Version:** 1.0 (2026-07-28)
> **Applies to:** `docs/design/patterns/*.md`, `docs/design/screens/*.md`, and every future design
> document in this repo.
> **Decision record:** `docs/superpowers/specs/2026-07-28-design-docs-reconciliation-design.md`

---

## 1. Source of Truth

Product specifications are authoritative on product truth and behavior.
Design documentation translates specifications into user experience (UX/UI rules).
Implementation is audited against both — it is evidence, not authority.

### Authority Order

When two documents disagree, resolve by this order (highest wins):

1. Product specification (`japanese-learning-app-spec.md`)
2. Layer/System specifications (`docs/superpowers/specs/*-l*-design.md`) — these define architecture,
   behavior, and product rules, not just implementation shape
3. Business model principles (`docs/product/business-model.md`)
4. Design system rules (this file and its children)
5. Screen specifications (`docs/design/screens/*.md`)
6. Implementation details (code, component comments)
7. Experimental drafts (anything not yet Approved — see §7)

---

## 2. Companion Rules

- Companion never interrupts learning loops (§4, Learning Loop Boundary).
- Companion presence is controlled by the Ambient Layer
  (`components/companion/ambient-provider.tsx`), never by an individual screen.
- Companion does not own gamification and never narrates it (§3).
- Companion does not replace progress systems — it sits beside them, not instead of them.

---

## 3. Gamification Rules

Gamification exists per **G1–G3** (`docs/product/business-model.md` §1.1) and is a real, shipped
product layer — XP, streak, leaderboard, badge. Design docs must not prohibit it.

```
Learning Journey
        |
        +---- Gamification Layer
        |       XP · Streak · Leaderboard · Badge
        |       (G1–G3: reinforces learning, self-vs-past-self first,
        |        social ranking only once a real social graph exists)
        |
        +---- Companion Layer
                Memory · Reflection · Meaning
                (Spec 1 P0–P12: never comments on scores, never
                 takes credit, speaks in accompaniment terms only)
```

### Layer Responsibility Rule

Every screen that shows both layers documents which layer owns which information:

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak/leaderboard changes |

Example — Dashboard:

- Không: *"Wow, bạn vừa nhận thêm 20 XP!"*
- Có: *"Hôm nay bạn đã quay lại với một đoạn hội thoại quen thuộc."*

---

## 4. Learning Loop Boundary

> Companion không tồn tại trong các active acquisition loop: Shadowing practice, Dictation, SRS
> review, Mining review session, Pronunciation evaluation, JLPT practice, Grammar practice,
> Vocabulary review, Kanji practice, Conversation drills.
>
> Không phải vì Companion "không muốn" — vì focus của learner là nhân vật chính trong loop đó.
> Companion xuất hiện **sau khi hoàn thành loop**, không phải **trong** loop.

**The boundary is conceptual, not route-based.** The list above is illustrative, not exhaustive. Any
future active acquisition loop inherits Hidden by default — a screen must justify an exception to
show Companion; it never needs to justify staying Hidden.

---

## 5. Companion Presence Mapping

| Design Concept | Runtime State | Meaning |
|---|---|---|
| Hidden | Dormant / No Anchor | Companion không tồn tại trên surface |
| Ambient | Idle | Companion hiện diện nhưng không tương tác |
| Observe | Observing | Companion notices context |
| Listening | Listening | Companion stays present while learner acts |
| Address | Speaking | Companion chủ động giao tiếp |
| Silent | Silent | Quyết định không nói (context đã emit nhưng Companion chọn im lặng) |

**Dormant ≠ Silent.** Two different axes:

- **Presence existence** — Dormant vs. Active. Dormant = no anchor declared, Companion cannot appear
  at all.
- **Interaction state** — Idle / Observing / Listening / Speaking / Silent. Only applies once Active.
  `Silent` = a context was emitted and evaluated, and Companion chose not to speak — a decision, not
  an absence.

---

## 6. Anchor Availability

Three states — do not collapse into two:

- **Available** — shipped today (L9b D3: Dashboard, `/journal`, Video Library empty state, Mining
  deck empty state).
- **Planned** — architecture allows it (Spec 1 §5.2, any surface may declare an anchor), not yet
  built. Adding it later needs no architecture change.
- **Not Supported** — forbidden by the Learning Loop Boundary (§4). Not a backlog item — moving out
  of this state requires changing the boundary rule itself, not just shipping a feature.

| Surface | Status | Reason |
|---|---|---|
| Dashboard | Available | L9b shipped this anchor |
| `/journal` | Available | L9b shipped this anchor |
| Video Library (empty state) | Available | L9b shipped this anchor |
| Mining deck (empty state) | Available | L9b shipped this anchor |
| Video Detail | Planned | Architecture allows it; not yet built |
| Mining Browse (non-empty) | Planned | Architecture allows it; not yet built |
| Video Library (non-empty) | Planned | Architecture allows it; not yet built |
| Shadowing / Review / Dictation / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4) |

---

## 7. Design Document Lifecycle

Every design document declares exactly one state at the top of the file:

| State | Meaning |
|---|---|
| Draft | Exploration only. Cannot override existing rules; cannot be cited by other docs as settled. |
| Approved | Defines UX behavior for its scope. Citable by other docs. |
| Canonical | Referenced by other docs as source of truth for its topic. |
| Deprecated | Historical reference only; superseded content, kept for context, not followed. |

A Draft never outranks a spec, a Layer spec, or an Approved/Canonical design doc — regardless of how
recently it was written.

---

## 8. Screen Documentation Rules

Every screen spec must define:

- Purpose
- User state
- Primary action
- Secondary actions
- Empty states
- Loading states
- **Success states** (distinct from empty — completing a video, finishing shadowing, hitting a
  milestone, unlocking content)
- Error states
- Companion behavior (§4, §5, §6)
- Gamification behavior (§3)
- Accessibility considerations

---

## 9. Companion Documentation Rules

Every mention of Companion in any design doc must specify:

- Presence level (§5)
- Anchor availability: Available / Planned / Not Supported (§6)
- Context trigger (what `emitContext()` call, if named)
- Learning boundary status (§4)

---

## 10. Visual vs. Interaction Changes

A restyle (border, color, font, shape — e.g. "Handwritten Note" replacing chat-bubble chrome) is a
**visual pattern**, not a replacement **interaction pattern**. Visual simplification must never
remove semantic functionality: dismiss affordance, accessibility behavior, live region, and keyboard
support are the interaction *contract* and stay fixed under any restyle.

---

## 11. Design Evolution Principle

> New design documentation may improve: clarity, usability, emotional quality, consistency.
> It may not silently redefine: product goals, business rules, learning philosophy, system
> architecture.
>
> A change to *how something is presented* is a design-doc edit. A change to *what is true about the
> product* is a spec edit — proposed against the Authority Order (§1), not slipped into a pattern or
> screen file.

---

## 12. Backlog

Screen documents not yet written. Each, when written, starts at Draft (§7) and must follow the
Screen Documentation Rules (§8) and the Learning Loop Boundary general form (§4) from creation —
not retrofitted later.

- `screen-journal.md`
- `screen-leaderboard.md`
- `screen-community.md`
- `screen-conversation.md`
- `screen-kanji.md`
- `screen-vocabulary.md`
- `screen-grammar.md`
- `screen-jlpt.md`
- `screen-playlists.md`
- `screen-profile.md`
- `screen-settings.md`

**§8 compliance for existing screen docs.** The seven screen docs edited during the initial
reconciliation pass (`screen-architecture.md`, `screen-dashboard.md`, `screen-video-library.md`,
`screen-review.md`, `screen-shadowing-detail.md`, `screen-mining.md`, `screen-video-detail.md`)
predate the full §8 checklist and do not yet define every required state (Loading, Success, Error
states in particular). §8 is mandatory for every *new* screen doc from the moment it's created.
Bringing the seven existing docs into full compliance is a separate, deferred follow-up — not done
in this pass — tracked here so the gap is visible rather than silently assumed.
