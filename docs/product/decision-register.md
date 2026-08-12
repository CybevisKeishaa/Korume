# Korume — Product Decision Register

**Every binding product ruling made during Phase 0, in one place.** Built 2026-08-12 because the
rulings had spread across three documents plus memory, and reconstructing them by hand is exactly
how one gets silently dropped.

> ⚠️ **This file is an INDEX, not a source of truth.** Each row states the decision in one line and
> points at where the reasoning, evidence and consequences actually live. **If this file and the
> referenced section ever disagree, the referenced section wins** — and this file is the one to fix.
> Never argue a decision from this page alone; never record a *new* decision only here.

**Status vocabulary:** `LOCKED` = decided, do not re-litigate · `PROPOSED` = written down, awaiting
the user's approval · `OPEN` = not decided.

---

## 1. Product model — `LOCKED`

| # | Decision | Where the reasoning lives |
|---|---|---|
| P1 | **Sensei is a Companion *mode*, not a second entity.** One intelligent presence | `capability-map.md` §3.1 |
| P2 | **Companion's name is `Korume`** — fixed and branded, not learner-chosen. `Storykeeper` is a *screen* name | `screen-inventory.md` §15.5, §20 |
| P3 | **Skill taxonomy is two tiers.** T1 (scoreable, comparable): Listening · Speaking · Reading · Grammar · Vocabulary · Kanji. T2 (diagnostic, **never summed**): Pronunciation · Pitch Accent · Particles… **Conversation is a context, not a skill** | `capability-map.md` §3.2 |
| P4 | **Both kanji surfaces ship** — discovery *and* curriculum | `capability-map.md` §3.4 |
| P5 | **`Certification Practice` is the module; JLPT · BJT · Tokutei Ginou are exam families.** Repo implements one | `screen-inventory.md` §10 |
| P6 | **Lesson workspace has FOUR Learning Modes** — Shadowing · Pronunciation · Listening Practice · Summary. The 8-tab row was a misread | `screen-inventory.md` §9.0 |
| P7 | **Dictation: typing is the mode, the word bank is a hint** | `screen-inventory.md` §9.3 |
| P8 | **Recommendation *reasons* are required** — an output of learning intelligence, not copy | `screen-inventory.md` §7.0 |
| P9 | **Answer revisions are recorded**, and power an insight family (7 variants + 2 honesty guards) | `screen-inventory.md` §10.9 |
| P10 | **Roadmap write-back is real** — results rewrite the plan | `screen-inventory.md` §10.5–10.6 |
| P11 | **`Favorites` is the mining family**, not a new capability | `screen-inventory.md` §7.2 |
| P12 | **Import pipeline + failure state: keep as drawn.** A progress narrative; failure's main cause is quota exhaustion | `screen-inventory.md` §7.0 |
| P13 | **Payment is PayOS.** No Stripe, no Visa, no Apple Pay | `screen-inventory.md` §19.3, §20 |
| P14 | **Auth = email + Google + Apple.** GitHub: no | `capability-map.md` §3.5 |
| P15 | **Native mobile apps are planned** — store badges are a roadmap statement | `capability-map.md` §3.5 |
| P16 | **No landing/gateway page exists yet** — known and accepted, user will design it later | `screen-inventory.md` §19.0 |

## 2. Information architecture — `PROPOSED`, awaiting approval

⚠️ **Nothing in this section is locked.** It is the content of `ia-proposal.md`, listed here only so
the review has a checklist. **Approving the IA locks this whole block at once.**

| # | Decision | Where |
|---|---|---|
| A1 | Five nav groups: `learn · practice · remember · journey · account` | `ia-proposal.md` §2 |
| A2 | **Companion is ONE destination** over six screens (home · diary · sensei · memory · growth) | §3.1 |
| A3 | **Memory is one surface, two types** (`Learning` / `Conversations`) | §3.2 |
| A4 | **Statistics → Dashboard.** **Achievements → summary on Dashboard, gallery on Profile** | §3.3 |
| A5 | **`/challenges` → Roadmap/Mission**, no nav row | §3.4 |
| A6 | **Pronunciation gets its own nav row** despite being a T2 sub-skill | §3.5 |
| A7 | **`/mining` → `Collection`** (label only; the feature needs its own spec) | §3.6 |
| A8 | **`Journey` label moves to `/roadmap`**; `/journal` becomes the Diary under Companion | §3.3 of `capability-map.md` |
| A9 | **`/jlpt` → `/certification`** — carries a migration ⇒ **Phase 2** | §5 |
| A10 | **HIDE (code kept, row removed):** `/vocab` · `/reading` · `/community` · `/leaderboard` | §5 · ruled 2026-08-11 |
| A11 | **`/playlists` stays its own screen** — not folded into Explore | §5 |
| A12 | **Loading + error catalogues go to `/admin/style-guide`**, not the registry | §4 |
| A13 | **No route for:** search palette · create-conversation wizard · lesson preview · reflection · suggestion drawer | §4 |

## 3. Method rules — `LOCKED`, and they bind future passes

These cost real effort to learn. Breaking one repeats a mistake already paid for.

| # | Rule | Where |
|---|---|---|
| M1 | **Four layers, never collapsed:** A product intent (user) · B UX representation (the frame) · C implementation (measured code) · D constraint (`CLAUDE.md` §2) | `screen-inventory.md` § Governing Method |
| M2 | **B splits: B-design is authoritative; B-content may be wrong** | § Amendment A |
| M3 | ⭐ **B-content splits again: identity content → report it; sample content (numbers, names, dates, `&apos;`) → never report it.** The signal is the label, never the value | § Refinement A-bis |
| M4 | ⭐ **The slot is design; the contents of the slot are content.** Never delete a region because its sample contents are wrong (Checkout) | § Refinement A-bis · §20 |
| M5 | **Layer C is NOT a baseline.** A capability with no endpoint means the design is larger, not wrong. Never phrase a finding as "conflicts with the API" | § Amendment B |
| M6 | **Layer D binds absolutely** — `CLAUDE.md` §2 is not something the design outgrows | § Amendment B |
| M7 | **Never infer a frame's identity from its name, id, or canvas size.** Look at it | § Method rule (cost: a wrong "duplicate" call) |
| M8 | **Read `docs/design/screens/<module>.md` before treating any Figma detail as product intent** — a frame is a layer-B snapshot and can lag a ruling by months | § Method rule 3 |
| M9 | ⭐ **`Capability ≠ screen ≠ destination ≠ nav item.`** Do not create a destination because Figma has a frame; do not keep one because the repo has a route | `ia-proposal.md` §1, §3.4 |
| M10 | ⭐ **`Taxonomy ≠ Navigation.`** Position in the data model does not determine position in the navbar — in either direction | `ia-proposal.md` §1 |
| M11 | **A user's "I fixed it" is a claim about intent, not file state.** Read it back when cheap | `L-003` · `screen-inventory.md` §20 |
| M12 | **`public/demo/**` is not a design source.** Only a live Figma screenshot is authoritative | `mem:phase0_figma_inventory_run_state` |

## 4. Still `OPEN`

**Structure — must be answered before or during the IA review:** none. All four IA blockers and all
three round-2 gaps are ruled.

**Scope — answerable after the IA is locked** (`capability-map.md` §3.5): Vimeo / multi-platform
import · `JLPT Speaking` as a Certification↔Conversation edge · `AI Coach` = flag or paid tier ·
theme & accent vs the dark-only token system · camera permission · the social graph behind
`Friends` visibility · the **L1 (native language)** field the Companion's *"without thinking in
Vietnamese"* depends on.

**Model / schema, deferred to their own specs:** conversation scenario model (8 wizard dimensions +
6 trait dials vs one text column) · save-everywhere → one collection surface (F-010/F-014) · curated
kanji collections (no schema) · the four new kanji domain nouns (learning path · course · kanji
lesson · study material).

---

## 5. Where each document's authority begins and ends

| Document | Holds | Does **not** hold |
|---|---|---|
| `CLAUDE.md` §2 | **law** — breaking it is a defect | experience, product decisions |
| `docs/lessons.md` | **process experience** under stable `L-NNN` ids | product decisions |
| `docs/design/screens/*.md` | **layer-A** written product authority per module | anything Figma-current |
| `docs/product/screen-inventory.md` | per-frame observation + the method rules | design; it records, it does not design |
| `docs/product/capability-map.md` | what Korume can do, and the §3 rulings | screen identity |
| `docs/product/ia-proposal.md` | destinations and grouping — **proposed** | anything locked |
| **this file** | an index of decisions | **the reasoning behind any of them** |
