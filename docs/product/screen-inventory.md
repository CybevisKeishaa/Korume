# Screen inventory — Figma pass 2026-08-11

**Source:** the frame list the user confirmed on 2026-08-11, working Figma-first per R1/R10 of
`docs/superpowers/specs/2026-08-08-screen-registry-design.md`. This is the human Figma↔repo
comparison R7 requires; no automation can reach Figma, so **this document is a DRAFT until the user
corrects it.** It is the input to `lib/product/screen-registry.ts`, not the registry itself.

**Classification rules applied**
- **R3** — `screenId` is the join key. A frame name and a route string that differ do not make a gap.
- **R11** — a frame depicting a *state* of a screen is `state-variant`, never a screen. Panels,
  drawers, modals, popups, previews, loading/empty/error, and the steps inside one flow are states.
- A frame named *"… after change(s)"* is a **design revision**, not a new screen.
- Route/impl come from the repo, measured. Figma authority stops at identity and IA.

Legend — `impl`: `built` · `placeholder` (renders `UpcomingScreen`) · `none` (no `page.tsx`).

---

## 1. Screens (proposed `kind: 'screen'`)

### Marketing / monetization
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Homepage | `homepage` | `/` | built |
| Pricing | `pricing` | — | none (L8) |
| Checkout | `checkout` | — | none (L8) |
| FAQ | `faq` | — | none |
| QuickStart | `quickstart` | — | none ❓ |

*Footer is a component, not a screen — excluded from the registry entirely.*

### Auth / account
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Login | `login` | `/login` | built |
| Profile | `profile` | `/profile` | built |
| Edit profile | `profile-edit` | — | none ❓ |
| Global setting | `settings` | `/settings` | built |

### Shadowing
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Shadowing Hub | `shadowing-hub` | `/shadowing` | built |
| Explore Lessons | `explore-lessons` | `/shadowing/explore` | **placeholder** |
| Shadowing Practice | `shadowing-practice` | `/shadowing/[id]` | built |
| Dictation (in shadowing) | `dictation` | `/shadowing/[id]/dictation` | built |

### Pronunciation
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Pronunciation library | `pronunciation-library` | — | none |
| Pronunciation detail | `pronunciation-detail` | — | none |

### Kanji

⚠️ **SUPERSEDED by §6 (Part II), 2026-08-12 — this table has 3 rows where there are 4 frames, and its
`impl` column is misleading.** `/kanji` renders a flat catalogue matching *neither* designed library
screen, and `Kanji inspect` is a modal in Figma but a page in the repo. Read §6 instead; the table is
left in place only to show what name-based classification produced.

| Figma frame | screenId | route | impl |
|---|---|---|---|
| Kanji library | `kanji-library` | `/kanji` | built |
| Kanji inspect | `kanji-inspect` | `/kanji/[id]` | built |
| Kanji lesson practice (flashcard) | `kanji-practice` | `/kanji/review` | built |

### Grammar
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Grammar analysis | `grammar-analysis` | — ❓ | none ❓ |

⚠️ `/grammar` is a **list** (`getGrammarList` + `LevelTabs` + cards), not an analysis view, and there
is **no `/grammar/[id]` route**. So either `Grammar analysis` is a detail screen that is designed but
unbuilt, or the list screen itself has no frame. **Needs the user's eye.**

### JLPT — one module, two routes
| Figma frame | screenId | route | impl |
|---|---|---|---|
| JLPT Practice | `jlpt-practice` | `/jlpt` | built |
| JLPT Phase test | `jlpt-phase-test` | `/jlpt/[id]` | built |

Everything else in the JLPT list is a **step inside `/jlpt/[id]`** — see §2. Evidence:
`/jlpt/[id]` renders a single `JlptTestRunner` driven by a `section` search param; phases and results
never leave the route.

### Companion
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Welcome Companion page | `companion-welcome` | — | none |
| Companion home | `companion-home` | — | none |
| Companion Diary | `companion-diary` | `/journal` | built |
| Companion Knowledge Assistant | `companion-knowledge-assistant` | ❓ `/sensei`? | **placeholder** |
| Learning memory | `learning-memory` | — | none |
| Conversation memory | `conversation-memory` | — | none |
| Growth Areas | `growth-areas` | — | none |
| Roadmap | `roadmap` | `/roadmap` | built |
| Roadmap detail | `roadmap-detail` | — | none |

⚠️ **WITHDRAWN 2026-08-12 — this ruling rested on a source the user has since disavowed.**
It read: *"`Companion home` is a separate screen from `/dashboard`, decided 2026-08-11 from the
user's reference render (`public/demo/image.png`) — its left nav lists `Dashboard` as its own item,
so the two cannot be the same screen."* The user stated on 2026-08-12 that **everything in
`public/demo/` is throwaway (`ảnh rác`) — images edited ad hoc to show the assistant a demo, never a
design artifact.** So the nav it shows is not evidence of anything, and neither is any other detail
in it.

**The conclusion may well still be right — it just has no support yet.** Re-derive it from Figma
during the Companion cluster, off `156:1310` (`Companion home after change`) and `216:15648`
(`Empty state (Companion home)`), and record the frame id that settles it. `/dashboard` stays a
`repo-only` entry (§3) either way, because that part came from the repo, not from the render.

The render also settles the companion sub-screens. `companion-home` is a **panel host**, and the
panels carry `See all →` affordances — so `Learning memory`, `Conversation memory` and
`Growth Areas` (rendered as *Language Growth*) are each **both** a panel on `companion-home` **and**
a full screen behind its `See all`. They stay `kind: 'screen'` with no route yet. Panels observed:
Today's Reflection · Learning Memory · Gentle Suggestions · Language Growth · Personal Vocabulary
Shelf · Conversation Memories · Things We're Still Practicing · Today's Small Victory · Weekly
Journey · Companion Diary.

⚠️ The render carries **pre-rebrand branding** — "JapanWeb+" and "NIHONGO CINEMA" — while the code
rebranded to Korume some time ago. Treat its *structure* as current intent and its *wordmark* as
stale.

### Conversation
| Figma frame | screenId | route | impl |
|---|---|---|---|
| Conversation practice | `conversation-practice` | `/conversation` | built |
| Conversation practice library | `conversation-practice-library` | — | none |

---

## 2. State-variants (proposed `kind: 'state-variant'`, R11)

| Figma frame | variantOf |
|---|---|
| Shadowing hub after changes | *design revision — not an entry at all* |
| Companion home after change | *design revision — not an entry at all* |
| Explore Lessons (with preview) | `explore-lessons` |
| Search lesson | `explore-lessons` ❓ |
| Search lesson (searched) | `explore-lessons` ❓ |
| Summary (in shadowing) | `shadowing-practice` |
| Pronunciation (in shadowing) | `shadowing-practice` ❓ |
| JLPT practice (phase 1) | `jlpt-phase-test` |
| JLPT practice (phase 2) | `jlpt-phase-test` |
| Finish phase 1 | `jlpt-phase-test` |
| To phase 2 *(listed twice)* | `jlpt-phase-test` |
| Practice result | `jlpt-phase-test` |
| Review mistake (after JLPT practice) | `jlpt-phase-test` |
| Review mistake (more detail) | `jlpt-phase-test` |
| Empty state (Companion home) | `companion-home` |
| Today's reflection (panel, fade around) | `companion-home` ✅ confirmed by the render |
| Gentle suggestion drawer | `companion-home` ✅ confirmed by the render |
| Popup create conversation | `conversation-practice` |
| Quick preview: Conversation practice | `conversation-practice` ❓ |
| Generate sensei | `companion-knowledge-assistant` ❓ |
| Generate done | `companion-knowledge-assistant` ❓ |
| Panel | ❓ **unidentifiable from the name — needs the user** |

### `Loading state` and `Error state` — proposed rule, still under discussion

`T4` requires every `state-variant` to carry a `variantOf` naming an existing `kind: 'screen'`.
`Empty state (Companion home)` names its parent and is fine. **`Loading state` and `Error state` do
not** — they are *global* states belonging to no single screen.

The user's clarification (2026-08-11): those two frames have **already been styled to the system's
colours, type and language**, and are meant as **descriptions of the states**, not destinations. So
they are a real implementation input — you can cut production markup from them — but nobody ever
navigates to them.

**Proposed rule, generalising past these two frames:**

> A state frame belongs to the **screen registry** when it is a state *of one named screen*
> (`Empty state (Companion home)`). It belongs to the **style guide** when it describes a state that
> any screen can enter (`Loading state`, `Error state`).

Their home already exists: `/admin/style-guide`, the living style guide built in L9a Plan 2. That is
where a shared component's states are documented, and R1 puts exactly that class of thing on the repo
side of the line. **No spec amendment is needed and no dishonest parent is recorded.**

The two rejected alternatives, for the record: making `variantOf` nullable would amend R11/T4 to
admit a parentless variant; parenting them arbitrarily to one screen would record something false.

⚠️ **Open — the user asked to discuss this further before it is settled.**

---

## 3. Repo routes with no frame in this pass (`kind: 'repo-only'`, R6/R13)

`repoOnlyReason: 'no-frame-at-last-pass'` unless noted.

**Already adjudicated by the user 2026-08-11** (see `mem:screen_registry_inputs`) — hide in Phase 2,
keep the code, do not build further: `/reading`, `/reading/[id]`, `/leaderboard`, `/community`,
`/community/[id]`, `/community/peer-review`, and **`/vocab`, `/vocab/[id]`, `/vocab/review`**
("không cần vocab nữa, hoặc ẩn nó đi, có thể sau sẽ dùng" — explicitly reversible). **But see the
conflict in §4 before acting on the vocab half.**

**Not yet adjudicated, as surveyed 2026-08-11 — ruling column added 2026-08-13 (Phase 2a) against
`decision-register.md` §2, the LOCKED IA:**

| Route | Note | Ruling (2026-08-13) |
|---|---|---|
| `/register` | Figma has `Login` but no register frame | still open |
| `/dashboard` | real screen (`LevelCard`/`StreakCard`/`SrsDueCard`/`BadgesGrid`/`RecommendationSection`). Confirmed **separate** from `Companion home` (§1) and still frameless | still open |
| `/review` | the cross-type SRS review hub | **KEEP** — `ia-proposal.md` §2's `remember` group (part of A1, `decision-register.md` §2) |
| `/grammar` | the grammar list. `Grammar analysis` is a **new, deliberately unbuilt** feature (§1), so this list stays frameless | still open (this note is a frame observation, not a pending IA question) |
| `/mining`, `/mining/review` | sentence mining | **A7** — relabelled `Collection`, screenId unchanged |
| `/playlists`, `/playlists/[id]` | IA question still open | **A11** — stays its own screen, not folded into Explore |
| `/achievements`, `/challenges`, `/statistics` | gamification surfaces | **A4** (achievements, statistics → Dashboard/Profile), **A5** (challenges → Roadmap/Mission) |
| `/weekly-report` | placeholder; possibly `Growth Areas` | **A2** — absorbed into Companion (§12.4 rules out `Growth Areas` as the match) |
| `/sensei` | placeholder; possibly `Companion Knowledge Assistant` | **A2** — absorbed into Companion (one of its six screens) |
| `/jlpt-test` | dead `redirect()` to `/jlpt`; `deprecated` or out of scope per §3.3 | pending — reserved as **A16**, ruled in Phase 2a Task 5 |
| `/admin/*` (5 routes) | `repoOnlyReason: 'out-of-design-scope'` — the only value R13 allows, and only because `chrome: 'admin'` | n/a — a T10 mechanism note, not an open IA question |

---

## 4. ⚠️ Vocab: no frame of its own, but the companion design leans on it

`/vocab`, `/vocab/[id]` and `/vocab/review` are built and are a core module in CLAUDE.md §4, and
**not one frame in this pass covers them.** Kanji has three frames; Vocab has zero. The user's ruling
was to hide it, reversibly (§3).

**The conflict, found in the same render that settled Companion home:**

1. Its left nav carries a **`Vocabulary`** item, under `LEARN`, between Kanji and Grammar.
2. `companion-home` hosts a **`PERSONAL VOCABULARY SHELF`** panel with real cards
   (失礼します · 丁寧 · お疲れ様です · お願いします) and a `See all →`.

So the design that is *most current* treats vocabulary as a first-class part of the product, while
the ruling hides it. Both cannot hold as stated.

**A plausible reconciliation, needing the user's confirmation, not assumption:** the shelf's cards
show a **`Confidence` meter** (High / Medium), which the `/vocab` module does not model — its state
is SM-2 (`srs_stage`, `interval_days`, `ease_factor`). So the shelf is plausibly **companion-owned
data, not the `/vocab` module**, in which case hiding `/vocab` costs the shelf nothing. If instead
the shelf reads from `/vocab`, hiding the module breaks a panel on the flagship screen.

The same render also shows **`Reading`** in the nav, which the user separately ruled hidden. Lower
stakes — no panel depends on it — but it is the same class of conflict.

Frameless with no such conflict: `/review`, `/achievements`, `/challenges`, `/statistics`,
`/register`.

---

## 5. Questions

### Answered 2026-08-11
- ~~**Vocab**~~ → hide, reversibly. **Conflict outstanding — §4.**
- ~~**`Grammar analysis`**~~ → a **new feature, deliberately not built**; the existing `/grammar`
  list is enough. Entry stays `kind: 'screen'` + `impl: 'none'`. *(Confirm the reading — see below.)*
- ~~**`Companion home` vs `/dashboard`**~~ → **two separate screens** (§1).
- ~~**`Learning memory` / `Conversation memory` / `Growth Areas`**~~ → **both** a panel on
  `companion-home` and a `See all` destination screen (§1).
- ~~**`Today's reflection` / `Gentle suggestion`**~~ → state-variants of `companion-home` (§2).

### Still open
1. ~~**§4's vocab conflict** — does the `PERSONAL VOCABULARY SHELF` read from the `/vocab` module, or
   is it companion-owned data? Decides whether hiding `/vocab` is free or breaks a flagship panel.~~
   **RESOLVED at `:1502-1506` of this file** (2026-08-13): the shelf sits inside Companion home, so
   it is companion-owned and hiding `/vocab` costs it nothing.
2. **Confirm the `Grammar analysis` reading**: "it's a new feature, we don't need to build it, the
   existing grammar module is enough" — is that right?
3. ~~**`Loading state` / `Error state`** — the §2 rule, which the user asked to discuss further.~~
   **RESOLVED by A12** (`decision-register.md` §2): loading + error catalogues go to
   `/admin/style-guide`, not the registry.
4. **`Companion Knowledge Assistant` → `/sensei`? `Growth Areas` → `/weekly-report`?** Both routes
   are placeholders today, so this is mapping, not implementation.
5. **`Panel`** — which screen is it a state of? Unidentifiable from the name alone.
6. **`Pronunciation (in shadowing)`** — a state of `shadowing-practice`, or its own route?
7. ~~**`/playlists`** — own screen, or a tab inside Explore? (carried over)~~ **RESOLVED by A11**
   (`decision-register.md` §2): `/playlists` stays its own screen, not folded into Explore.
8. **`QuickStart`, `Edit profile`** — screens of their own, or states?
9. ✅ **`Panel` (item 5) is answered** — it is one frame, `180:1129` `Panel Quick preview: Conversation
   practice`; the name had been split across two lines. See `docs/product/figma-frame-map.md`.

---

# Part II — Per-frame inventory (Phase 0 analysis)

**What this is and why it is separate from Part I.** Part I above classified frames from their
*names*. Part II answers, per frame and **from a screenshot of the live Figma**, the nine questions
Phase 0 exists to answer: screen or state · capability · entered from · exits to · actions · data
needed · API exists · route exists · related screens. Where the two parts disagree, **Part II wins** —
it looked, Part I guessed.

**The method rule that governs every entry here:** never infer a frame's identity from its name, its
node id, or its canvas size. Only the picture is evidence. This rule was bought with a wrong guess
(`29:2890` vs `280:3`, see the frame map).

**Repo claims in this part are measured, not recalled** — routes via `git ls-files`, page content via
the symbol body, schema via the migration text. Anything not measured is marked as such.

## ⭐⭐ The governing method: separate every finding into four layers (user ruling, 2026-08-12)

This rule was bought by getting it wrong. Batch 1 of the Shadowing cluster reported the hub's import
pipeline as a CLAUDE.md §2 violation because its steps read `Download Video` / `Extract Audio`. The
user's ruling: those are a **progress narrative** — deliberately showing the learner that the system is
doing careful work — and some stages may be presentational rather than literal. Nothing was violated,
because nothing in the design ever claimed to be an implementation.

**Every finding is therefore classified into four layers, and they are never collapsed:**

| Layer | Question | Authority |
|---|---|---|
| **A. Product intent** | What experience does the learner need? | the user |
| **B. UX representation** | How does Figma express that experience? | the Figma frame |
| **C. Technical implementation** | What does the repo actually do? | measured code |
| **D. Contract / constraint** | Does any rule forbid a given implementation? | `CLAUDE.md` §2 |

Worked example — lesson import:

| Layer | Conclusion |
|---|---|
| A | Importing a lesson has visible, structured progress |
| B | 6 stages + % + ETA + a failure state |
| C | caption fetch + AI enrichment |
| D | never download, re-host or proxy video |

**There is no contradiction here.** A contradiction arises *only* if layer B is mistaken for layer C.

**Three consequences that bind the rest of this inventory:**
1. **Do not "fix" a Figma frame against the current implementation.** The repo is layer C; it has no
   authority over layers A and B. The purpose of this pass is to see how large Korume was *designed*
   to be — letting today's code narrow that is the single biggest failure mode available here.
2. **Do not promote something to a new capability just because Figma gave it its own word.** Check
   first whether it belongs to a family that already exists (see `Favorites` → the mining family,
   §7.2).
3. ⭐ **Do not let a stale Figma frame reopen a settled product decision.** `docs/design/screens/`
   holds written **layer-A** authority; a Figma frame is layer B and is only a *snapshot*, which can
   lag a decision by months. **Read the module's doc in `docs/design/screens/` before treating any
   Figma detail as product intent.** Rule 3 was bought the same way rule 1 was: batch 3 read an
   eight-tab row as the mode set when a committed doc defined four and explained why two of the extras
   had been retired (§9.0). Rules 1 and 3 are the same error pointing in opposite directions — taking
   one layer's artifact as another layer's truth.
4. ⭐⭐ **When the docs say A and Figma shows A *plus a more specific boundary*, change neither side.**
   Rule 3 covers Figma being *stale*. This covers Figma being **more precise** — which JLPT proved is
   also possible: `design-reconciliation.md` says the Companion is `Not Supported` during JLPT
   practice, and the frames located the exact edges of that silence (§10.7). Record it as a
   **`design clarification / reconciliation finding`** and carry it to the capability map. Do **not**
   edit the doc to match the frame, or the frame to match the doc, mid-inventory. **This is the whole
   reason the inventory runs before the Screen Registry.**

**And one prohibition that applies to every remaining cluster:** the inventory **records**; it does not
**design**. Do not begin redesigning a module because reading it revealed something. Answer the
questions, write the evidence, move on. Where the user rules on something mid-cluster, the ruling is
recorded as an *input to a later spec*, never as a spec.

### ⭐⭐ Amendment, 2026-08-12 — two corrections the user made after the inventory finished

**A. Layer B splits in two, and only one half is authoritative.**

| Sub-layer | What it is | Authority |
|---|---|---|
| **B-design** | structure, layout, flow, affordances, what exists and how it connects | ✅ **authoritative — the design is right** |
| **B-content** | copy, labels, sample values, brand names, third-party names | ⚠️ **may be wrong — report every conflict to the user** |

Worked example, and it is the case that produced the rule: **Checkout** (§19.3). *B-design* — three
membership options → choose a payment method → order summary → confirm — is **correct and stays**.
*B-content* — *"powered by Stripe"*, Visa / Mastercard / Apple Pay / Google Pay / PayPal — is
**wrong**. ✅ **User ruling: the payment method is PayOS. There is no Stripe, no Visa, no Apple Pay.**
The frame's content needs fixing; its design does not.

**So the correct output for a content conflict is a report, not a redesign and not a shrug.** A
running list lives in §20.

### ⭐⭐ Refinement A-bis, 2026-08-12 — **sample data is a field list, not content**

**User ruling:** *"Dữ liệu mẫu là để bạn biết cần có những dữ liệu gì trên màn hình, đừng quan trọng
nó."* — sample values exist to tell you **which fields the screen needs**; the values themselves carry
no authority and are not errors to report.

**So B-content splits again, and only one half is worth a user's time:**

| B-content kind | Examples | Report it? |
|---|---|---|
| **Identity content** | brand names, third-party/vendor names, product names, legal claims, feature names | ✅ **yes** — a wrong vendor name is a wrong product decision on screen |
| **Sample content** | a stroke count, a kanji's reading, a learner's name, a date, a percentage, an escaped HTML entity | ❌ **no** — read it as *"this screen needs a stroke-count field"* and move on |

**This cost real effort to learn: three of §20's ten rows were sample-data noise** (a stroke count
that disagreed with itself, a reading attached to the wrong kanji, a stray `&apos;`). Each was
correctly observed and each was worthless to the user, who cannot act on them and did not put the
values there as claims. **The signal in `Total Strokes: 11` is the label, never the 11.**

**Generalised rule for any future inventory pass:** when a frame shows a value, record the **field**
in `Data needed` — which the inventory already does — and do **not** also open a content ticket
because the value is wrong. A rendering bug (`&apos;`) is the same class: known artifact, skip it.

**B. ⭐⭐⭐ Layer C is NOT a baseline. Stop measuring the design against the existing API.**

The user's ruling, and it reverses a habit this document had picked up: *"the APIs we built in the
backend may not fit and cannot cover everything, so don't keep pointing out that something differs
from the API — the system designed in Figma is much larger and considerably more correct. The old API
is small."*

**Therefore:**
- When a designed capability has no endpoint, that is **the design being larger**, not the design
  being wrong — and not a defect report against the backend either. **Record the capability. Do not
  frame it as a divergence.**
- Measuring the repo stays useful for exactly two things: knowing **what already exists** so it can be
  reused, and knowing **what a later plan must build**. It is never the standard the design is judged
  against.
- Phrases like *"the gap is X"* or *"unbuilt"* are fine as **status**. Phrases like *"conflicts with
  the API"* or *"the schema says otherwise"* are the error — the schema was written for a smaller
  product.

**The one exception, unchanged: layer D still binds absolutely.** CLAUDE.md §2 is not a baseline that
the design outgrows; it is a constraint on every implementation regardless of how large the design is.

---

## 20. Content conflicts to fix in Figma (user-reportable, running list)

Per the amendment above: **design correct, content wrong.** ✅ **The user went through this entire
list on 2026-08-12. Every row is now closed** — nothing here is outstanding, and the rows that turned
out not to be conflicts at all are the more useful half.

### ✅ Fixed by the user in Figma

| # | Was | Now | Verified? |
|---|---|---|---|
| 2 | brand `JapanWeb+` / `JAPANWEB+` across Pricing, FAQ, Generate, QuickStart, Dashboard, Kanji, Shadowing hub, Explore… | **Korume** | ⚠️ user-reported, not read back |
| 3 | `156:1310` rail titled `NIHONGO CINEMA` | **Korume** | ⚠️ user-reported |
| 4 | `66:166` `Nihongo Cinema · since March 2026` | **Korume** | ⚠️ user-reported |
| 5 | Companion named `Hikari` in `180:1129` | **Korume** | ⚠️ user-reported |

> ⚠️ **Not yet read back from Figma**, and this project has already paid once for the difference: a
> user saying *"I renamed them"* is a claim about intent, not about file state — the frame-rename pass
> earlier in Phase 0 found a substitution the user did not know they had made. **Verify these when
> those frames are next in front of us**, which is cheap then and pointless now. None of it blocks
> the IA. (`L-003`.)

### ✅ RESOLVED — the Companion's name is **Korume**

**Row 5 is fully closed, and it closes §15.5's `AMBIGUOUS` finding with it.**

- `Hikari` → corrected to **Korume**.
- **`Storykeeper` was never a companion name — it is a screen name** (user, 2026-08-12). The
  inventory read it as the companion's identity in §11.1's `Data` row; that reading was wrong.
  Note it is *not* a Figma frame name either (`figma-frame-map.md` has no such entry) — it is a
  title rendered **inside** `156:1310`.

**So: one companion, named Korume, the same word as the product.** The "user-nameable companion"
hypothesis in §15.5 is **not supported** — no naming step was ever found, and the user resolved the
divergence by unifying the name rather than by declaring it a placeholder. ⇒ `capability-map.md`
§3.1's remaining ⚑ is cleared.

### ✅ NOT conflicts — scope questions, now answered

| # | Question | ✅ Ruling, 2026-08-12 |
|---|---|---|
| 9 | `203:13813` Footer's **App Store / Google Play** badges | **Keep them. Native apps are planned** — *"tôi sẽ làm app sau"*. The badges are a roadmap statement, not a false claim |
| 10 | `65:2` Login's `Continue with Apple` · `Continue with GitHub` | **Apple: yes. GitHub: no** — remove only the GitHub tile. Auth becomes **email + Google + Apple** |

### ❌ WITHDRAWN — sample data, not content conflicts

Rows 6, 7 and 8 (`&apos;` entities · `14 strokes` vs `Total Strokes: 11` · `緑` labelled with `縁`'s
reading) are **withdrawn per refinement A-bis above**. They were correctly observed and were never
actionable: sample values tell the inventory *which field the screen needs*, and nothing more. The
user cannot act on them and did not intend them as claims. **Do not re-report this class.**

### ⭐ Row 1 — Checkout: a **structural** ruling, not just a content fix

The content half is unchanged (**PayOS**; no Stripe, no Visa, no Apple Pay). The user added a
constraint that is **layer B-design and therefore authoritative**:

> *"Có thể không có các Apple Pay hay gì, thế nhưng nó vẫn phải có phần khung cho nó."*

**The payment-method selection region stays in the design as a region**, even though the tiles inside
it will be PayOS's real methods (VN bank transfer / QR) rather than the five card-and-wallet brands
drawn today. The user cannot edit the frame right now, so **the frame keeps its wrong tiles and the
inventory carries the correction** — when Checkout is eventually ported, build the section, not the
brands.

**Why this matters beyond Checkout:** it is the cleanest example so far of B-design and B-content
disagreeing *within a single component*. The **slot** is design (authoritative); the **contents of
the slot** are content (correctable). Do not delete a region because its sample contents are wrong.

**Not a content conflict — a real gap the user confirmed:** ✅ *"I don't have a landing page / gateway
page yet; I'll create it later."* So §19.0's finding stands as **known and accepted**, not as an error.

---

## 6. Cluster: Kanji — 4 frames, analysed 2026-08-12

### 6.0 The headline: `/kanji` today matches **neither** Figma frame

Measured (`app/[locale]/(protected)/(app)/kanji/page.tsx`, body read in full): `/kanji` renders a
**flat grid of every kanji** — `getKanjiList(level)` → cards of character + English meaning, plus
`LevelTabs` for N5–N1 and one `Review` link to `/kanji/review`. No collections, no radicals, no
featured item, no progress, no heatmap, no learning path, no study materials, no lesson list.

So the divergence is not "explorer vs library" — **both designed kanji surfaces are substantially
unbuilt**, and the shipped screen is a thin catalogue that neither design describes. Part I's row
mapping `Kanji library → /kanji → built` is true only in the sense that a `page.tsx` exists.

### 6.1 `29:2890` — **Kanji Explorer** · `CONFIRMED` screen

| | |
|---|---|
| **Screen or state** | Screen. Full-page, own left nav, own header. |
| **Capability** | Kanji **discovery** — find kanji worth learning through context, rather than working a list. |
| **Entered from** | Left nav → `Kanji`. |
| **Exits to** | Featured collection detail · a curated collection · a JLPT level · a radical's kanji · a kanji (recently-viewed card) · today's review · the mining deck · a JLPT path. |
| **Actions** | Search (text field **+ voice mic + filter button**) · `Continue exploring` · star/bookmark a collection (★ on all 4 cards + recently-viewed cards) · `View all` ×4 · `Start today's review` · `Study now` on the recommendation · 2 quick actions. |
| **Data needed** | Featured collection (title, kanji count, explored *n*/*N*, %) · 4 curated collections (kanji count, est. duration, % done, 3 sample glyphs) · per-JLPT-level kanji counts + % + est. hours · 6 radicals (glyph, English name, kanji count, 3 sample glyphs) · recently viewed (glyph, meaning, reading) · weekly-goal % · mastered / currently-learning / review-due counts · **12-week activity heatmap** · next-review countdown · a recommendation derived from *the user's latest shadowing lesson*. |
| **API exists** | Partly. `app/api/kanji/route.ts` ✅ and `app/api/srs/review/route.ts` ✅ exist. Nothing serves collections, radicals-as-browse, the heatmap, or the shadowing-derived recommendation. |
| **Route exists** | `/kanji` exists but renders something else entirely (§6.0). |
| **Related** | `280:3` (the curriculum twin) · `28:2041` (inspect) · `280:1314` (its featured deck is the flashcard deck) · Shadowing (the recommendation's source). |

**⭐ Browse-by-radical is far cheaper than previously recorded.** The run-state memory lists it as "a
capability no repo route covers", which is true — but the **data layer already exists**:
`supabase/migrations/20260712000001_schema.sql:79` creates `radicals`, `:91` gives `kanji` a
`radical_id` FK, and `20260712000003_indexes.sql:20` adds `idx_kanji_radical`. RLS read policy is in
place. So this is a UI + endpoint gap, not a schema gap.

**⚠️ Curated collections have no schema.** `collections` (`20260731000019_collections.sql`) is a
**lesson** concept — its join table is `lesson_collections (lesson_id → videos)`. The Explorer's
paths are measured in *kanji* ("Sushi Master · 96 kanji · 5h 20m"), so they are a different entity.
Real gap, and it is shared with `280:1314`, whose deck is the Explorer's featured collection.

**Two smaller observations, recorded so they are not re-discovered:** the brand mark in this frame
reads **`JapanWeb+`**, not Korume — this frame pre-dates the rebrand. And the `Recently viewed` card
shows `緑` labelled *affinity / えん*, which belongs to `縁`; treat sample content as placeholder.

### 6.2 `280:3` — **Kanji Library** · `CONFIRMED` screen

| | |
|---|---|
| **Screen or state** | Screen, and a **tabbed** one: `Courses` · `Study Materials` · `My Progress` · `Weak Kanji`. Only `Courses` is drawn. |
| **Capability** | Kanji **curriculum** — commit to a path and work it lesson by lesson. |
| **Entered from** | Left nav → `Kanji`; breadcrumb reads `Learning › Kanji Library`. |
| **Exits to** | A JLPT level · `View Course` · `Continue Learning` · a study material · a numbered lesson · `Review Weak Kanji` · `View Progress` (companion). |
| **Actions** | Pick JLPT level (N3 selected) · `Continue` / `Start` per level · `Continue Learning` · pick 1 of 4 study materials · resume the continue-banner lesson · **search lessons** · **sort (`Recommended`)** · per-lesson `Review` / `Continue` / `Start Lesson`. |
| **Data needed** | Per level: kanji count, lesson count, *n*/*N*, started-or-not · current path (title, blurb, kanji/lesson/hour totals, JLPT tag, progress) · 4 study materials (kind, title, blurb, kanji + lesson counts, state incl. `Personalized`) · resume pointer (lesson title, *n*/*N* kanji, minutes left) · 24 lessons (index, title, blurb, **5 sample glyphs**, kanji count, minutes, status, progress) · right rail: level %, today's goal *n*/*N*, a **companion insight sentence**, 4 "worth revisiting" glyphs. |
| **API exists** | No. There is no course / learning-path / lesson-of-kanji concept in the API at all; `/api/kanji` returns a flat list. |
| **Route exists** | No route renders this. |
| **Related** | `29:2890` (the discovery twin) · `280:1314` (a lesson launches into the flashcard runner) · Companion (owns the insight card) · JLPT. |

**This frame is the newer one and it is post-rebrand** — its first study material is literally named
**`Korume Core`**. Note this contradicts the note carried in the frame map that `280:3` sources
material from books "like Mimikara": no book source appears in the `Courses` tab. If Mimikara exists
it is behind the undrawn **`Study Materials`** tab — do not assert it either way without that frame.

**New domain concepts this frame introduces**, none of which exist in the repo: *learning path*,
*course*, *kanji lesson* (an ordered unit of ~15 kanji), and *study material* (four parallel ways to
learn the same kanji). These are the same class of finding as the Pronunciation `Paths/Situations/
Goals` conflict already recorded in `mem:figma_make_design_source` §C — **new domain nouns, needing a
ruling, not just a screen build.**

### 6.3 `280:1314` — **Kanji lesson practice (flashcard)** · `CONFIRMED` screen, immersive chrome

| | |
|---|---|
| **Screen or state** | Screen — but the frame depicts **one state of it**: pre-reveal. The four rating buttons are rendered *disabled*, under the label "Reveal the answer to rate your recall". A post-reveal frame is not in this cluster; if none exists anywhere, the reveal state is undesigned. |
| **Capability** | Spaced-repetition review of kanji cards. |
| **Entered from** | A lesson in `280:3`; `Start today's review` in `29:2890`; `Review Now` in `28:2041`. |
| **Exits to** | `←` back · `✕ Exit study` · end-of-deck (undesigned in this cluster). |
| **Actions** | `Reveal meaning`, then rate `Again 10m` / `Hard 2d` / `Good 6d` / `Easy 15d`. |
| **Data needed** | Deck (title + JLPT level), card cursor *n*/*N*, card state (`Learning`), the glyph, the four scheduled intervals, and a session footer: % complete today, cards remaining, **day streak**, plus an encouragement line. |
| **API exists** | ✅ `app/api/srs/review/route.ts`. The four intervals are the SM-2 engine's output — the one part of this cluster the repo genuinely has. |
| **Route exists** | ✅ `/kanji/review`. |
| **Related** | `280:3` · `29:2890` · `28:2041`. |

**Chrome contract: this is `(focus)` or `(immersive)`, not `(app)`.** The frame has no left nav — only
a slim bar (`←` · `Korume | Kanji Practice` · `JLPT N3 12 / 35` · `✕ Exit study`). Today `/kanji/review`
sits under `(app)`, i.e. with the nav column. That is a **chrome-contract divergence** and it is
exactly the kind of thing the `(protected)/(app)/(focus)/(immersive)` split exists to express.

**The deck is `Tokyo Everyday Life · N3` — the Explorer's featured collection.** That is the
strongest evidence in this cluster that the two library frames are meant to coexist: the discovery
surface's collection is the unit the review runner consumes.

### 6.4 `28:2041` — **Kanji inspect** · `CONFIRMED`, and it is a **MODAL**, not a page

| | |
|---|---|
| **Screen or state** | A modal overlay: it is drawn as a rounded panel floating over the nav, and the nav behind it is clipped. Part I maps it to `/kanji/[id]`, a real page. **That mapping needs an explicit written ruling** — see below. |
| **Capability** | Everything a learner can know about one kanji, plus the actions to act on it. |
| **Entered from** | Any kanji glyph anywhere — Explorer recently-viewed, Library lesson, transcript lookup. |
| **Exits to** | `‹`/`›` to the adjacent kanji · `Review Now` · `Study this Kanji` · `Open Vocabulary` · `Practice Writing` · `Find Similar Kanji` · a lesson in `Appears in lessons` · a sentence's source. |
| **Actions** | ⭐ **`♡ Favorite`** and ⭐ **`+ Add to Review`** · play audio (headword, onyomi, kunyomi, each common word, each example sentence) · `Replay Stroke Order` · `Review Now` · `View more examples` · `See all lessons` · 4 bottom actions. |
| **Data needed** | Readings (on/kun) · meanings · **stroke count, frequency rank `#1082`, school grade, `常用`/`4級` badges** · animated stroke order · **composition breakdown** (radical + components → the character) · **mnemonic text + image** · per-user status (score %, SRS stage, review count, next-review date) · 5 common words with readings + glosses · 3 example sentences with translations, **source attribution and timestamps** · **`appears in lessons` with per-lesson occurrence counts**. |
| **API exists** | Partly — `app/api/kanji/[id]/route.ts` ✅. Schema already has `stroke_order_svg`, `mnemonic_text`, `mnemonic_image_url`, `radical_id` → `radicals`. **No** frequency rank, grade, or kanji→lesson occurrence index. |
| **Route exists** | ✅ `/kanji/[id]` — as a page, while Figma draws a modal. |
| **Related** | All three frames above; Vocabulary; Shadowing (the lesson index and the mini-player). |

**⭐⭐ This frame answers an open question that has been sitting unresolved.**
`mem:screen_registry_inputs` asks: *"Which Figma frame carries the save/flashcard idea?"* — the user
had said "Figma có luôn rồi" while describing mining, but mining ≠ saving a kanji. **It is this
frame:** `28:2041` carries both `♡ Favorite` and `+ Add to Review` in its header. That matches the
user's stated intent ("a save button everywhere, results collected on the kanji screen") and it maps
to the **SRS side, not `/mining`**, exactly as that memory predicted it would.

Measured: **the repo has neither.** A grep for `favorite|bookmark|is_saved|saved_kanji|add-to-review`
across application code returns no feature — only `figma-prompt-style.md` (a design doc) and an
unrelated hit in `lib/data/admin-videos.ts`. This confirms the earlier finding that a progress row is
created *implicitly on first review* and that deliberately collecting a kanji does not exist as a user
action. **And the design implies TWO collections, not one** — `Favorite` and `Add to Review` are
separate controls sitting side by side; whether that is two lists or one is a product question.

**⚠️ A persistent mini video player overlays this frame** — `となりのトトロ - Totoro (1988)`, "Now
Learning", transport controls, `02:35 / 1:39:45`, an `AB` (A–B repeat) button, volume, fullscreen. It
is drawn *across* the modal, so it belongs to a layer above both. **If that player is meant to persist
across navigation, it is a `(protected)`-level concern** — a state owner outliving every chrome
change, precisely the rule the screen-port workflow established. This is the first frame in the
inventory to imply it, and it is not in any Part I row. Needs a ruling.

**Design inconsistency, noted not resolved:** the stroke-order badge says `14 strokes` while the
meaning card says `Total Strokes: 11`. 緑 has 14. Placeholder noise.

### 6.5 Cluster verdict

| Node id | Name | Tag | Route | Verdict |
|---|---|---|---|---|
| `29:2890` | Kanji Explorer | `CONFIRMED` | `/kanji` renders something else | designed, unbuilt |
| `280:3` | Kanji Library | `CONFIRMED` | none | designed, unbuilt, **introduces new domain nouns** |
| `280:1314` | Kanji lesson practice (flashcard) | `CONFIRMED` | `/kanji/review` ✅ | built; chrome contract diverges; only the pre-reveal state is drawn |
| `28:2041` | Kanji inspect | `CONFIRMED` | `/kanji/[id]` ✅ | built as a page, designed as a modal; carries the missing save actions |

**Nothing in this cluster is `OBSOLETE` or a `STATE-VARIANT`.** All four are distinct screens.

**Capabilities this cluster contributes to the capability map** (the Phase 0 output that IA is later
derived from): kanji discovery · curated kanji collections · browse by radical · browse by JLPT level ·
kanji curriculum (path → material → lesson) · kanji SRS review · kanji deep-inspect · **save/favorite a
kanji** · stroke-order playback · writing practice · kanji→lesson reverse index · kanji→vocabulary
bridge · companion insight surfaced inside a learning screen · persistent media player.

**⚑ The open product question is now sharper, and it is the user's to answer.** It is *not* "which of
the two library frames is right" — `/kanji` implements neither, so nothing is lost either way. It is:
**does Korume ship a discovery surface AND a curriculum surface for kanji?** The evidence that they
were designed to coexist is that the flashcard runner's deck (`Tokyo Everyday Life`) is the Explorer's
featured collection, so the discovery surface feeds a runner the curriculum surface also feeds.

---

## 7. Cluster: Shadowing — batch 1 of 3 (hub + search), 3 frames, analysed 2026-08-12

The cluster is 9 frames and runs in three batches, because two of them (`200:7705`, `200:10726`) are
**~5,850px tall** and have to be read in horizontal bands to be legible at all. Batch 1 is the hub and
the search modal; batch 2 is the Explore pair; batch 3 is the in-lesson practice family.

Repo side, measured with `git ls-files` — the `/videos` → `/shadowing` rename **was taken** in C1, so
only `admin/videos` still carries the old noun:

| Route | Chrome group | State |
|---|---|---|
| `/shadowing` | `(app)` | built |
| `/shadowing/explore` | `(app)` | **placeholder** (`UpcomingScreen`) |
| `/shadowing/[id]` | `(focus)` | built |
| `/shadowing/[id]/dictation` | `(focus)` | built |

### 7.0 The import pipeline — raised as a §2 violation, **ruled otherwise, and the ruling is the lesson**

**What was reported.** In `149:2`, the second `My Lessons` row (*Tokyo Street Interview – Daily Life*,
badge `Building Lesson`, status `Importing now`) renders a six-step progress checklist, read from a 2×
crop of the full-resolution render:

> ✅ **Download Video**  ✅ **Extract Audio**  ✅ Split Sentences
> ⏳ Generate Vocabulary  ○ Grammar  ○ AI Summary — `72%`, `est. 1m 20s`

Batch 1 flagged the first two steps as violating CLAUDE.md §2 rule 1 (*never download, re-host or proxy
video… no downloader, ever*) and recommended renaming them.

**✅ User ruling, 2026-08-12: keep the pipeline exactly as drawn. There is no violation.** The six
steps are a **progress narrative** — they exist so the learner sees the system doing careful,
structured work on their lesson (*"thể hiện để cho người dùng thấy chúng ta đang rất kì công"*), and
**some stages may be presentational rather than literal**. That is a legitimate UX device, not an
architectural claim.

**The correct record, in four layers:**

| Layer | |
|---|---|
| **A. Intent** | importing a lesson should feel like real, structured work is happening |
| **B. UX** | 6 named stages + % + ETA, plus ready / building / failed states |
| **C. Implementation** | `youtubeCaptionProvider` → `fetchJapaneseCaptions(videoId)` (captions only, no media), then AI enrichment. `aiTranscriptProvider` is a deliberate stub whose comment names the STT gray area and leaves it unresolved. |
| **D. Constraint** | never download, re-host or proxy video; never extract YouTube source audio |

**A stage label is layer B and binds nothing.** `Download Video` as *copy* does not oblige the backend
to download anything — and the measured code downloads nothing: a grep for
`ytdl|youtube-dl|yt-dlp|downloadVideo|extractAudio` across application code returns no implementation.
**Constraint D still binds layer C absolutely.** If a future implementer reads these labels as a work
order, that is the defect — not the labels.

**The failure state is real, and batch 1 misread why.** It argued that `Import Failed — Transcript
unavailable` could not coexist with a download-and-STT pipeline. The user's ruling reframes it
entirely: **failure is genuine, and its most important cause is quota exhaustion.** When the system's
daily/monthly allowance is spent, the import legitimately reports failure:

```
Free user → Import lesson → quota available?
                              ├── yes → process
                              └── no  → failed / unavailable
```

**⭐ This makes the frame an early sighting of L8's UX, not a design slip.** The chain
`quota → kill-switch → AI usage → billing` is exactly the cost-defence architecture the roadmap
already requires before `ANTHROPIC_API_KEY` is ever enabled, and here it is drawn as a user-visible
state. The hub's `FREE PLAN · 2 / 3 imports remaining · Upgrade →` chip is the same mechanism seen
from the other side. Copy for the failed state should name the real cause — e.g. *"Import
unavailable — monthly lesson quota reached"* — rather than implying the video was defective.

### 7.1 `149:2` — **Shadowing hub** · `CONFIRMED` screen

| | |
|---|---|
| **Screen or state** | Screen. `(app)` chrome — full left nav visible. |
| **Capability** | The lesson home: discover, **import**, and resume. Header copy: *"A quiet place to discover, import, and continue your Japanese lessons."* |
| **Entered from** | Left nav → `Lessons`. |
| **Exits to** | Featured lesson (continue / preview) · a library lesson · Explore (`View All`) · a popular lesson · resume the current path · a recommended lesson · `Upgrade` · the search modal. |
| **Actions** | Continue / Preview the featured lesson · **paste a YouTube URL and import** · open / retry / delete a library lesson · search · filter by 11 category chips · `View All` ×2 · resume · start a recommended lesson · upgrade. |
| **Data needed** | Featured lesson (cover, title, blurb, JLPT, sentence count, minutes, category, % done) · **import quota** (`2 / 3 imports remaining`, plan name) · library rows with a **live pipeline state machine** (ready / building + 6 sub-steps + % + ETA / failed + reason) · 11 category chips · popular lessons (cover, JLPT, category, sentences, minutes, % done) · current-path resume pointer incl. **the current sentence text** and "last studied" · recently added · weakness-based recommendations **with a stated reason per card** · right rail: companion activity, today's goal, 7-day bar chart + 4 stats, an AI suggestion with its reason. |
| **API exists** | Substantially ✅. `app/api/videos/import/route.ts`, `/api/videos`, `/api/videos/recommendations`, `/api/videos/[id]/{transcript,progress,summary,difficulty}` all exist, and `lib/data/lesson-{creation,library,ranking,taxonomy}.ts` back them. **The quota is real** — `createLesson()` already returns 403 `Monthly lesson quota reached`, which is what the `2 / 3` chip renders. |
| **Route exists** | ✅ `/shadowing`, `(app)` — matches the frame's chrome. |
| **Related** | Explore (`200:7705`) · search modal (`212:*`) · practice (`105:3088`) · Companion (owns two of the four rail cards). |

**Findings beyond the §2 one:**

- **The import pipeline is a long-running job with a visible state machine** — `ready` / `building`
  (6 sub-steps, % and ETA) / `failed` (with a reason). Nothing in the inventory so far has needed
  progress transport; this row does. Whether that is polling or a subscription is an engineering
  question the design implies but does not answer.
- ⭐⭐ **Every recommendation carries its reason as copy** — *"You struggle with Passive Form."*,
  *"Because you use formal booking in your request patterns."*, *"Builds around the vocabulary you
  already know."* **User ruling 2026-08-12: this is required, and it is not cosmetic copy — it is an
  output of learning intelligence.** A bare `Passive Form` is an ordinary recommender; `Passive Form —
  you struggle with Passive Form` is the Companion demonstrating that it remembers the learner's
  history. The chain the user named:

  ```
  learning history → SRS / progress / mistakes → Companion memory
                   → learning analysis → recommendation → reason
  ```

  **Consequence for the API contract: the ranking endpoint owes a `reason` per item, not just an
  order** — and the reason has to be derived from real history, not templated. This is CLAUDE.md §5 #2
  (i+1 comprehensible input) joined to the Companion memory that already exists in migration #15.
- **The free-plan chip is L8 surfacing early.** `FREE PLAN · 2 / 3 imports remaining · Upgrade →` is
  Contextual Discovery placed exactly where the business model says it belongs.
- **Nav inconsistency, again:** this frame's left nav has no `PROGRESS` or `ACCOUNT` group, while
  `29:2890`'s does, and `Kanji` is drawn as the active row **on the Shadowing hub**. Placeholder noise —
  more evidence that no frame's navbar is IA (the rule this whole phase exists to protect).
- Brand mark reads `JapanWeb+` and the eyebrow `JAPANWEB · LESSON LIBRARY` — pre-rebrand, like
  `29:2890`.

### 7.2 `212:14610` + `212:14753` — **Search Lessons** · one modal, two states

`212:14610` is the resting state and `212:14753` is the same modal with a query typed. Both are drawn
as a floating panel over a dimmed backdrop with an `✕` and a `⌘K` badge. **Tag: `212:14610`
`CONFIRMED` (the screen of record), `212:14753` `STATE-VARIANT` of it.**

| | |
|---|---|
| **Screen or state** | A **command palette**, not a page. Overlay is presentation, not navigation — so this is a dialog component, and it should have no route unless the user wants a shareable search URL. |
| **Capability** | Jump to a lesson fast, from anywhere. |
| **Entered from** | `⌘K` from anywhere; the hub's search field. |
| **Exits to** | A lesson (`Continue` / `Open`) · resume the current path · **`Open Companion`**. |
| **Actions** | Type a query · pick from `RECENTLY OPENED` (4 chips) or `POPULAR SEARCHES` (8 chips) · resume · filter results by `All / Situation / JLPT / Duration / Completed / Not Started / `**`Favorites`**` / `**`Imported`** · open a result · `✕` close. |
| **Data needed** | Resume pointer (`Business Japanese`, `Current sentence 51 / 194`) · recently opened · popular searches · result rows (cover, title, JLPT, one-line blurb, category, minutes, sentence count, **% completed**) · the eight filter facets. |
| **API exists** | ❌ **No search endpoint and no search component exist** — `git ls-files` finds nothing matching `search`/`palette`/`command` under `components/`. `/api/videos` can list, but faceted search over title/topic/JLPT/situation is unbuilt. |
| **Route exists** | n/a by design (modal). |
| **Related** | Hub · Explore · Companion. |

**⭐ The design writes down an IA ruling, and the user has confirmed it (2026-08-12):**

```
any screen → ⌘K / Search → search panel → lesson results → open lesson
                                 └── "Ask Companion" → Companion Knowledge Assistant → AI conversation
```

The rail states it in copy: *"Looking for grammar or kanji? **Ask Companion instead. Search is here
only to help you find a lesson immediately.**"* The user's framing: **search helps a learner find what
they want to learn; the Companion helps them ask what they don't yet know.** The two must not be fused
into one giant search engine.

**Classification, per that ruling: this is a global interaction surface — a panel — not a canonical
screen.** It gets no route, and in the registry it is not a nav destination. The `Ask Companion`
branch is a real edge to another frame: `215:15164 Companion Knowledge Assistant`.

**`Favorites` is a filter facet here, and it is NOT a new capability.** ⚠️ Batch 1 originally promoted
it to a cross-cutting "favourites system" on the strength of a second sighting (after `♡ Favorite` in
`28:2041 Kanji inspect`). **User ruling 2026-08-12: treat favourite as the same family as mining.**
The product concept is one thing, not several: *the learner meets something → collects it into a
personal collection → studies it later.*

```
Learning collection
  ├── save / mine        (sentence mining from video)
  ├── personal vocabulary
  ├── saved kanji
  └── …
```

**The method error worth remembering: Figma giving something its own word is not evidence that it is
its own capability.** Check whether it joins an existing family before promoting it. This is the same
class of mistake as reading a progress label as an implementation contract (§7.0) — both take a
layer-B surface detail and treat it as a layer-A product concept.

**Keyboard-first, which the a11y non-negotiable likes:** `⌘K` to open, a `⌘K` affordance inside the
field, a visibly focused result row, and a tip teaching the shortcut.

### 7.3 Batch 1 verdict

| Node id | Name | Tag | Route | Verdict |
|---|---|---|---|---|
| `149:2` | Shadowing hub | `CONFIRMED` | `/shadowing` ✅ `(app)` | built; pipeline narrative **ruled correct as drawn** (§7.0); recommendation *reasons*, import *progress* and the quota-failure state are unbuilt |
| `212:14610` | Search lesson | `CONFIRMED` | none (modal, correct) | wholly unbuilt |
| `212:14753` | Search lesson (searched) | `STATE-VARIANT` of `212:14610` | — | — |

**Capabilities added to the map:** lesson import from YouTube · **import progress narrative** (a
presentation-level stage model, §7.0) · **quota-driven failure state** (the visible end of
`quota → kill-switch → AI usage → billing`) · import quota + upgrade prompt · lesson library ·
featured lesson · category filtering · popular / recently-added / **weakness-based recommendation
carrying a derived reason** · current-path resume carrying sentence position · **global lesson command
palette (`⌘K`), a panel and not a screen** · faceted lesson search · companion activity surfaced inside
a learning screen · an explicit **search ↔ Companion boundary** (find what you want to learn vs ask
what you don't know).

*Not added: "favourites". It joins the existing mining / learning-collection family per the user's
ruling — see §7.2.*

---

## 8. Cluster: Shadowing — batch 2 of 3 (the Explore pair), 2 frames, analysed 2026-08-12

Both frames are ~5,850px tall, so they were read as four upscaled horizontal bands plus one 2× crop of
the preview panel, per the tall-frame method. `200:7705` is **the largest frame in the file so far**.

### 8.1 `200:7705` — **Explore Lessons** · `CONFIRMED` screen

| | |
|---|---|
| **Screen or state** | Screen. `(app)` chrome, **plus a secondary top bar** the hub does not have: `← Back` · `Explore Lessons` · a centred search field · bell / settings / avatar. |
| **Capability** | Browse the entire catalogue. Header copy: *"Browse every lesson in Korume. Or narrow everything by situation."* |
| **Entered from** | Hub → `View All` on Popular Lessons; nav; `← Back` implies a caller. |
| **Exits to** | A lesson (`Start` / `Continue`) · `Import a lesson` · `Browse shelf` ×2 · `All lessons` · the quiet suggestion's lesson · a shelf page (pagination). |
| **Actions** | Search · pick 1 of 16 situation chips · paginate within any shelf · open / retry / **delete** an imported lesson · start or continue a lesson. |
| **Data needed** | See the section list below — this is the densest data contract in the inventory so far. |
| **API exists** | Partly, and the taxonomy half is genuinely good — see below. |
| **Route exists** | ⚠️ `/shadowing/explore` exists but is a **pure placeholder**: measured, its `page.tsx` renders `UpcomingScreen` and nothing else. |
| **Related** | Hub (`149:2`) · search panel (`212:*`) · the preview variant (`200:10726`) · Companion. |

**Page structure, top to bottom:**

1. Hero — eyebrow `SHADOWING LIBRARY`, title, subtitle.
2. **Search field** with the helper *"Search by title, topic, grammar, vocabulary, creator, JLPT,
   situation or tag."* — **eight facets**, two of which (`creator`, `tag`) exist nowhere else.
3. **`MY IMPORTED LESSONS`** — *"The material you chose to bring with you."* + `Import a lesson ›`.
   Three cards, one per import state: `72% complete · Ready`, `Preparing transcript…`,
   `Import failed · Retry`. Each has a delete affordance.
4. **`RECENTLY ADDED`** — *"New official Korume scenes, released this week."* + `Browse shelf ›`.
5. **`RECOMMENDED FOR YOU`** — *"A few directions your Companion thinks may feel good next."*
6. **`BROWSE BY SITUATION`** — 16 chips + `All`, under the line *"This selection becomes the context
   for every bookshelf below."*
7. **`A quiet suggestion`** — *"You recently practiced Restaurant conversations. Maybe try the N4–N3
   version next."* Another reason-carrying recommendation (§7.1).
8. **Five shelves**, each `JLPT band · name · 8 lessons · blurb · Shelf n of 5`, a 4×2 card grid, and
   **its own pagination** `‹ 1 2 3 4 ›`:

   | Band | Shelf | Blurb |
   |---|---|---|
   | N5–N4 | Beginner Foundation | *"Start with the phrases that make every familiar moment feel possible."* |
   | N4–N3 | Daily Conversation | *"Build confidence in everyday spoken Japanese with more room to respond."* |
   | N3–N2 | Natural Japanese | *"Notice the pace, shorthand and small expressions people use naturally."* |
   | N2–N1 | Advanced Expression | *"Stay present through nuance, preferences and unexpected turns."* |
   | N1 | Native Fluency | *"Step into full-speed scenes, podcasts and the details between the words."* |

**Card anatomy** (consistent across every grid): cover · JLPT-band badge · **series eyebrow**
(`SCENE NOTES` / `TOKYO TABLE` / `EVERYDAY JAPANESE`) · title · one-line blurb · progress bar ·
`n min` + `n lines` · `n grammar · n words` · `Start ›` / `Continue ›` · an optional `Recommended`
ribbon.

**⭐ Findings**

- **Two content origins are named for the first time.** *"New **official Korume scenes**"* sits
  against *"**My imported lessons** — the material you chose to bring with you."* First-party catalogue
  and user-imported material are different things with different copy. The repo has a video **owner**
  concept and an approval/status flow, so the distinction is expressible; whether an explicit
  "official" origin flag exists is **not measured**.
- ⚠️ **`Vimeo` appears as an import source** (`Vimeo · Food in Japan`), alongside `YouTube · TokyoWalk`.
  The repo is YouTube-only — `lib/youtube/**`, and `lesson_sources` seeds `youtube` among content
  origins. **Multi-platform import is a layer-A product question for the user**, and it is the one
  place in this frame where CLAUDE.md §2 genuinely does apply: the no-download rule is written as
  *"YouTube or any platform"*, so a second platform must also be embed-only.
- **Creator / channel attribution** (`TokyoWalk`, `Food in Japan`) is displayed and is a search facet.
  No schema holds it.
- **A third taxonomy axis appears: the series eyebrow.** `TOKYO TABLE`, `SCENE NOTES`,
  `EVERYDAY JAPANESE` are neither situation nor source. The `collections` table
  (`slug · title · description · cover_image_url · display_order` + `lesson_collections`) is the
  natural home, and the five shelves fit it too.
- ⭐⭐ **The situation chip row has already been adjudicated in this repo — do not re-open it.**
  `supabase/migrations/20260807000025_lesson_taxonomy.sql` opens with exactly this analysis:

  > *"TWO axes, not one: the Figma chip row mixes situations (Restaurant, Office) with sources (Anime,
  > Podcast, News), while the original design prompt kept them as separate sections. One column would
  > freeze that collapse into the schema."*

  It shipped `lesson_situations` (8 seeded: conversation, restaurant, business, daily-life, travel,
  office, shopping, cafe) and `lesson_sources` (7 seeded: youtube, nhk, podcast, drama, anime, vlog,
  news) as separate tables, with FK columns on `videos` and arrays returned from day one so
  many-to-many is a foreseen evolution. **This is the four-layer method applied correctly before it
  was named** — layer B collapsed two axes into one chip row, and layer C refused to inherit the
  collapse. The measurable delta is only coverage: Figma shows 16 chips, the repo seeds 8 + 7.
- **Vocabulary drift worth fixing in the domain model:** the cards say `n lines`, the preview panel
  says `SENTENCES`. Same quantity, two nouns.
- Nav noise again: brand mark `JapanWeb+` while body copy says *"every lesson in **Korume**"*, and
  `Kanji` is drawn as the active nav row on an Explore screen.

### 8.2 `200:10726` — **Explore Lessons (with preview)** · `STATE-VARIANT` of `200:7705`

Identical page with a **lesson preview panel** overlaid at the top right. Contents, read from a 2× crop:

cover image · `✕` · series eyebrow `SCENE NOTES` · title *"A table for two"* · blurb · a 2×2 metadata
block — **`JLPT` N5–N4 · `DURATION` 7 min · `VOCABULARY` 14 words · `SENTENCES` 20** — then
**`▶ Start Lesson`** and, beside it, a **bookmark icon button**.

- **Presentation, not navigation** → a dialog/drawer component, no route, no registry screen of its own.
- **The bookmark is the third sighting of save-and-collect** (after `28:2041`'s `♡ Favorite` and the
  search panel's `Favorites` facet). Per the user's ruling it stays inside the **mining /
  learning-collection family** and is *not* counted as a new capability — recorded here only because
  three independent sightings tell us the family needs a real home.
- Note the panel is the only place a lesson's **vocabulary count** is promoted to a headline metric.

### 8.3 Batch 2 verdict

| Node id | Name | Tag | Route | Verdict |
|---|---|---|---|---|
| `200:7705` | Explore Lessons | `CONFIRMED` | `/shadowing/explore` = **placeholder** | designed in full, unbuilt; taxonomy backend partly exists and is well-modelled |
| `200:10726` | Explore Lessons (with preview) | `STATE-VARIANT` of `200:7705` | — | — |

**Capabilities added to the map:** full-catalogue browse · **faceted search including `creator` and
`tag`** · situation-as-page-context filtering · **curated shelves banded by JLPT** · per-shelf
pagination · separation of **official catalogue vs user-imported material** · per-lesson import state
with delete/retry · **creator/channel attribution** · a **series/collection axis** distinct from
situation and source · lesson preview before commitment · Companion-authored suggestions carrying
their reason.

**⚑ New question for the user:** *Vimeo* appears as an import platform. Is multi-platform import
intended, or is that card placeholder dressing? It changes `lib/youtube`'s scope, the import schema,
and the §2 embed-only rule's surface area.

---

## 9. Cluster: Shadowing — batch 3 of 3 (the in-lesson practice family), 4 frames, analysed 2026-08-12

### 9.0 The lesson is one workspace with **FOUR** Learning Modes — and the docs already said so

⚠️ **CORRECTED 2026-08-12. Batch 3 first reported "eight modes" by reading the tab row in `105:3088`
literally. That was wrong**, and the authority that already settled it is committed in this repo:
`docs/design/screens/screen-shadowing-practice.md` § *Two-Layer Model*.

```
Lesson
├── Learning Mode     "What skill am I practicing?"  — Shadowing / Pronunciation / Listening Practice / Summary
├── Reading Settings  "How should the UI behave?"    — font, subtitle size/colour, speed, auto-pause, repeat…
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

**Every extra tab in the Figma row is explained, and none of them is a fifth mode:**

| Figma tab | What it actually is |
|---|---|
| `Shadowing` · `Pronunciation` · `Summary` | three of the four real Learning Modes |
| `Dictation` | **the default sub-mode of Listening Practice**, not a mode — so `Listening` + `Dictation` are one mode, which resolves the `AMBIGUOUS` flag batch 3 raised |
| `Reading` · `Immersion` | the **retired View Mode axis** (Reading / Normal / Immersion). It was dropped for adding complexity without enough learner value — spec `2026-08-01-shadowing-practice-figma-reconciliation-design.md` §2. **The frame simply predates the retirement.** |
| `Mining` · `Review` | separate surfaces with their own routes; never lesson-scoped tabs |

**Canonical route shape (doc §Learning Modes) — one Lesson hosting four sibling workspaces:**

| Route | Learning Mode | Repo |
|---|---|---|
| `/shadowing/[id]` | Shadowing (default) | ✅ built |
| `/shadowing/[id]/pronunciation` | Pronunciation | ❌ no route; `/api/pronunciation/score` ✅ |
| `/shadowing/[id]/listening` | Listening Practice — **Dictation sub-mode, default** | ⚠️ shipped as `/shadowing/[id]/dictation` |
| `/shadowing/[id]/listening/fill-blank` | Listening Practice — Fill-in-the-blank | ❌ |
| `/shadowing/[id]/listening/translation` | Listening Practice — Translation | ❌ |
| `/shadowing/[id]/summary` | Summary | ❌ no route; `/api/videos/[id]/summary` ✅ |

**So the real gap is: two of four modes have no screen, Listening Practice has one of three sub-modes,
and the shipped listening route is named for the sub-mode rather than the mode.** The engines exist —
`/api/pronunciation/score`, `/api/dictation/attempt`, `/api/shadowing/session`,
`/api/videos/[id]/summary` were all measured present.

**⭐⭐ The method lesson, and it is the mirror image of the one §7.0 taught.** That one said: *never let
the current implementation narrow the design.* This one says: **never let a stale Figma frame reopen a
settled product decision.** `docs/design/` carries written **layer-A** authority. A Figma frame is
layer B and is a *snapshot* — it can lag a decision by months, exactly as this tab row lagged the View
Mode retirement. **Consult `docs/design/screens/` for the module before treating any Figma detail as
product intent.** Both failures have the same shape: taking one layer's artifact as another layer's
truth.

**Scoring stays, and it already has a home.** The doc pins pronunciation scoring to three columns
`shadowing_sessions` already has — `pronunciation_score`, `rhythm_score`, `pitch_score` — with no new
schema, and per-sentence score history feeding the per-sentence Learning Status. Nothing in this
correction removes a score.

### 9.1 `105:3088` — **Shadowing Practice** (the Lesson Workspace) · `CONFIRMED` screen

The frame is 1278×585 and **cut off at the bottom** — it shows the workspace's top half only.

| | |
|---|---|
| **Capability** | The lesson workspace: one video, **four** Learning Modes (§9.0). This frame is the Shadowing mode — continuous playback, transcript-first. |
| **Chrome** | No left-nav suppression is drawn, but the header carries `Study Environment`, `Focus Mode`, expand and settings — the frame provides its *own* focus affordances. Repo already has it right: `/shadowing/[id]` is `(focus)`. |
| **Header** | `Business Japanese` · `JLPT N4` · `72% complete` · `Sentence 3 / 18`; subtitle `Lesson 8 · Meeting Introductions`. |
| **Left column** | Video player with an **in-frame subtitle overlay**, scrubber, transport, a **`Sentence` loop chip**, `1×` speed, volume, a transcript toggle, expand. Below it a `LIVE SENTENCE` card with a hide toggle, an AI sparkle action, and the sentence set in large type **with per-word furigana**. |
| **Right column** | `TRANSCRIPT` — `18 sentences · 6 min`, a visibility toggle, **`Search transcript`**, then numbered lines with Japanese + English, the current line highlighted. |
| **API** | `/api/videos/[id]/transcript` ✅ · `/api/shadowing/session` ✅. |

**Findings:** furigana is rendered per word, which is where CLAUDE.md §5 #4 (adaptive furigana) lives ·
transcript **search** inside a lesson is a capability no route has · the `Sentence` loop chip is A–B
repeat, matching the `AB` button seen floating in `28:2041` · `Study Environment` and `Focus Mode` are
two *named* presentation modes not present anywhere in the repo.

### 9.2 `120:2027` — **Pronunciation (in shadowing)** · `STATE-VARIANT` (a mode of the workspace)

| | |
|---|---|
| **Rail** | `SENTENCE NAVIGATOR` — numbered chips `46…53` with the current one active, four tool icons (transcript, audio, waveform, **bookmark**) · furigana + the sentence + its translation · a large **mic button** · a coaching line (*"Great work. Try it once more."*) · `▶ Replay Native` · `‹ Previous` · `Next ›` · `LIVE FEEDBACK` with a verdict (`Excellent`) and a **score badge `86`** · a per-attempt note (*"Your rhythm became smoother today."*) closing with **"Saved to your personal pronunciation memory."** |
| **Left / below** | Player · `CURRENT LESSON` (`NHK Easy News · JLPT N3`, `TIMESTAMP 08:43`, `SENTENCE 5.8s`) · stats `Lesson 26% · Sentence 51/194 · Speaking 18 min · Accuracy 84%` · a session bar · `OPTIONAL REPORTS — Your speaking patterns`. |
| **Reports** | `Recent Pronunciation History` · `Most Improved Words` (ありがとうございます · 失礼します) · ⭐ **`Pitch Accent Trend`** — *"Your sentence endings are more natural."* |
| **API** | `/api/pronunciation/score` ✅. ⚠️ **Correction:** `Replay Native` is **not** TTS. `screen-shadowing-practice.md` specifies replaying a clip cut purely from `transcript_lines.start_time`/`end_time` — i.e. seeking the YouTube IFrame, **no new media and no AI cutting**. TTS (`/api/speech/tts` ✅) is the separate §2-legal source for the *pitch reference*, which is synthesised from the line's **text**. Two different mechanisms; batch 3 conflated them. |

**⭐ Two findings that matter beyond this screen.** `Pitch Accent Trend` is CLAUDE.md §5 differentiator
#1 appearing as a **longitudinal report**, not just an in-the-moment overlay — that implies pitch
scores are persisted per attempt. And **"Saved to your personal pronunciation memory"** wires practice
output into Companion memory (`/api/companion/memories` exists), which is the same loop the
recommendation `reason` depends on (§7.1).

### 9.3 `123:2835` — **Dictation / Listening practice** · `STATE-VARIANT` (a mode of the workspace)

Same shell; the rail is the exercise.

| | |
|---|---|
| **Rail** | `SENTENCE NAVIGATOR` · `▶ Replay audio` with a **`Loop` toggle, `0.75×` and `1×` speeds** and a headphones icon · **`DICTATION PUZZLE`** — `4 words remaining` + `☀ Show Hint` · the answer area as **tappable tiles** (ご / あ / が / ざ / とう, one selected) · `🗑 Remove Selected Word` · a **`WORD BANK`** of unused tiles (り / い / ました / 。) · **`Check Answer ✓`** · `LIVE FEEDBACK` — *"Very close — listen once more."* with **`91%`** · a partially-drawn breakdown `Slots · Grammar · Kanji · Recall` · **"Saved to your personal listening memory."** |
| **Reports** | `Recent Dictation Accuracy` · `Most Forgotten Vocabulary` · `Listening Improvement Timeline`. |
| **API** | `/api/dictation/attempt` ✅, and `lib/dictation/{normalize,score}.ts` hold the scoring logic. |

**✅ RESOLVED 2026-08-12 — batch 3 raised this as an open layer-A question; the user answered it.**
Batch 3 read Figma's word-bank tiles as a *replacement* for typing and asked which exercise Korume
wanted. **The answer: typing is the normal mode; the puzzle is a hint.**

That matches both authorities. `screen-shadowing-practice.md` defines the Dictation sub-mode as
*"transcript fully hidden. Play → blank input → Check → accuracy"*, and the repo already implements
exactly that — `components/video-player/dictation-view.tsx:284` renders an `<Input>`.

**So there is no conflict, and the repo is not wrong. What is missing is the assist layer:** the
`WORD BANK` of candidate tiles, `Show Hint`, `Remove Selected Word`, and the `n words remaining`
counter — a scaffold the learner reaches for when stuck, sitting beside the typed input rather than
instead of it. Note the frame draws it as the *primary* affordance, which is what caused the misread.

**Still open and genuinely new:** the partially-drawn `Slots · Grammar · Kanji · Recall` breakdown
scores more dimensions than `lib/dictation/score.ts` does today. And per the doc, Listening Practice
has **two further sub-modes that exist nowhere** — Fill-in-the-blank and Translation.

### 9.4 `125:1030` — **Summary (in shadowing)** · `CONFIRMED` screen

The end-of-lesson screen, and the densest AI-authored surface in the inventory so far.

| | |
|---|---|
| **Header** | `← Back to Lesson` · lesson title · `194 / 194` · eyebrow `SUMMARY`. |
| **Hero** | `LESSON COMPLETE` · title · reflective blurb · `JLPT N5 · 18 Sentences · 6 Minutes · Completed` · `▶ Replay Lesson` · `Return to Shadowing →`. |
| **Body** | **`Words Worth Remembering`** — *"Not every word from the lesson—only the ones you'll naturally use again"*: word · reading · gloss · frequency tag (`Daily`/`Common`) · part of speech · an example sentence · `🔊 Native pronunciation` · a **bookmark**. **`Natural Japanese`** — native expressions with `MEANING & USE` and a **`NATIVE NUANCE`** column. **`Grammar Used in this Lesson`** — pattern · JLPT level · gloss · explanation · **`From lesson`** (the real sentence it appeared in) · **`Try it`** (a new sentence to produce). **`Culture Behind the Conversation`** — cultural notes. **`Things You Should Review`** — AI-picked items, each with a reason and `Review Again`. |
| **Rail** | `AI COMPANION — A quiet reflection` (*"I saved three expressions into your personal memory."*) with `Open Memory` / `Review Tomorrow` · `LESSON STATUS` (`Shadowing Complete`, `Pronunciation 82`, `Listening 76`, **`Retention High`**) · `SAVED KNOWLEDGE` (`12 Vocabulary`, `5 Expressions`, `3 Grammar patterns`, **`+8% Memory growth`**, *"Saved to your personal notebook"*) · `WHERE TO GO NEXT` with its reason and `Start Next Lesson →`. |
| **API** | `/api/videos/[id]/summary` ✅ exists; nothing renders it. `/api/companion/memories` ✅. |
| **Route** | ❌ none. |

**⭐ This screen is where the whole product's loop closes**, and it is worth naming precisely: a lesson
ends → the AI selects what was *worth* keeping (not everything) → items are written to Companion
memory and the personal notebook → per-skill scores and a retention estimate are recorded → the next
lesson is proposed **with its reason**. That is exactly the chain the user described for recommendation
reasons (§7.1), seen from the producing end rather than the consuming end.

**Two new metrics appear here and exist nowhere in the repo:** `Retention` as a qualitative level, and
`Memory growth` as a percentage delta. Both are Companion-layer concepts. **`Try it` is also new** — a
generated production prompt, distinct from the example sentence the lesson supplied.

### 9.5 Batch 3 verdict, and the cluster total

| Node id | Name | Tag | Route | Verdict |
|---|---|---|---|---|
| `105:3088` | Shadowing Practice | `CONFIRMED` | `/shadowing/[id]` ✅ `(focus)` | the Shadowing mode, built; the **4-mode workspace shell is unbuilt**; frame is cropped |
| `120:2027` | Pronunciation (in shadowing) | `STATE-VARIANT` (mode) | none; API ✅ | unbuilt screen over a working engine |
| `123:2835` | Dictation / Listening practice | `STATE-VARIANT` (mode) | `/shadowing/[id]/dictation` ✅ | built and **correct** — typing is the mode; the word bank is a missing **hint** layer |
| `125:1030` | Summary (in shadowing) | `CONFIRMED` | none; API ✅ | unbuilt; closes the learning loop |

**Cluster Shadowing is COMPLETE — 9 frames across 3 batches.** Screens: `149:2`, `200:7705`,
`105:3088`, `125:1030`, `212:14610`. State-variants: `200:10726`, `212:14753`, `120:2027`, `123:2835`.
Nothing `OBSOLETE`. (`90:1985`, the dead hub, is not part of this cluster — see the frame map.)

**Capabilities added by batch 3:** a **lesson workspace with 4 Learning Modes** · in-lesson transcript search ·
per-word furigana in the live sentence · A–B sentence looping and speed control · a sentence navigator ·
per-sentence recording with a live score and a coaching line · **pitch-accent trend as a longitudinal
report** · dictation as **word-bank assembly** · multi-dimension dictation scoring
(`Slots/Grammar/Kanji/Recall`) · per-mode "optional reports" · **AI-curated end-of-lesson summary**
(worth-keeping vocabulary, native nuance, grammar with `From lesson` + `Try it`, cultural notes) ·
per-skill lesson scoring + **retention** · **saved-knowledge counters and memory growth** · a
Companion reflection at lesson end · next-lesson proposal with a reason.

**⚑ Questions this cluster leaves for the user.** Four of the five batch-3 questions were answered on
2026-08-12 and are struck through here so the record shows what was asked and what came back:

1. ~~Is `Listening` a mode distinct from `Dictation`?~~ **No** — Dictation is Listening Practice's
   default sub-mode (§9.0).
2. ~~Dictation as assembly, typing, or both?~~ **Typing is the mode; the word bank is a hint** (§9.3).
3. ~~Is `Immersion` a real mode?~~ **No** — it belongs to the retired View Mode axis, along with
   `Reading` (§9.0).
4. ~~Should `Mining` and `Review` be lesson-scoped tabs?~~ **No** — separate surfaces, not modes.
5. **Still open: Vimeo / multi-platform import** (§8.3).

**Newly open, from the correction:** the `Slots · Grammar · Kanji · Recall` scoring breakdown exceeds
what `lib/dictation/score.ts` computes, and Listening Practice's other two sub-modes —
**Fill-in-the-blank** and **Translation** — are specified in `screen-shadowing-practice.md` but have
no frame in this cluster and no code. Both are build scope, not identity questions.

---

## 10. Cluster: JLPT — 10 frames, analysed 2026-08-12

Rule 3 applied first: **there is no `docs/design/screens/screen-jlpt*.md`.** JLPT is built (Layer 5)
but has **no written layer-A screen authority** — the only design-doc mentions are in
`navigation-system.md`, `adaptive-layouts.md`, `companion-patterns.md` and `design-reconciliation.md`.
That absence is itself a finding: for this module, Figma is the *only* layer-B/A artifact, so it
carries more weight here than it did for Shadowing.

Two of the ten frames (`234:1639`, `234:1667`) were read earlier while resolving their duplicate names.

### 10.0 The module is **`Certification Practice`**, and JLPT is one of three exams — ✅ **CONFIRMED by the user 2026-08-12** (see §10.9)

`232:2` is not titled "JLPT". It is **`Certification Practice`** — the nav row is `Certification
Practice` (replacing `JLPT`), the breadcrumb reads `Learning › Certification Practice`, and the page
carries an exam-family selector:

> **`JLPT`** (active) · **`BJT`** · **`Tokutei Ginou`**

BJT (Business Japanese Proficiency Test) and Tokutei Ginou (Specified Skilled Worker) are separate
certifications with their own formats. **The repo is JLPT-only end to end** — `/jlpt`, `/jlpt/[id]`,
`jlpt_tests`, `jlpt_questions`, `/api/jlpt/*`, and a `jlpt_section` enum. This is the largest naming
and scope divergence found in the inventory so far, and it is a **layer-A question for the user**:
is the certification module genuinely three exam families, or is JLPT the product and the other two
chips aspiration? It decides a module name, a route, a nav label and a schema shape, so it should be
answered before the registry names anything.

### 10.1 `232:2` — **Certification Practice** (the lobby) · `CONFIRMED` screen

Eyebrow `PRACTICE ROOM` · *"Practice full-length certification exams and build confidence through real
exam experiences."* · exam-family selector · a `CONTINUE LEARNING` resume card (`JLPT N3 Practice Set
22–07`, 45%, *"72% current score · 99 questions remaining"*) · `JLPT EXAMS — Practice Library`, a
paginated list of practice sets, each `105 Minutes · 180 Questions · Estimated Level N3` with state
`Resume` / `Start` / `Completed + Score 86% + Review`.

Rail: **`COMPANION — Today's Recommendation`** (*"I think today's N3 practice is a good challenge for
you."*) · `CURRENT GOAL` (`JLPT N3 · Your current certification path`, Practice Completed 12, Average
Score 84%) · `A SMALL NOTE` (*"One practice exam today is better than waiting for the perfect day."*).

**Repo:** `/jlpt` renders a test list + attempt history + level tabs — the same *idea*, without the
exam-family axis, the resume card, the pagination or the rail. `/api/jlpt/tests` ✅, `/api/jlpt/attempts` ✅.

### 10.2 `234:618` — **Practice set detail / Exam Structure** · `CONFIRMED` screen

*(Frame name `JLPT Phase test`.)* A pre-flight screen, and the most specification-dense frame in the
cluster.

- Set card: `Estimated Duration 105 minutes · Questions 180 · Previous Attempts 3 · Best Score 86%`,
  footer `Last score 84% · Resume from question 41 / 180`, CTA `Resume Practice`.
- **`PRACTICE FLOW — Exam Structure`**, drawn as a vertical timeline:
  - **`PHASE 1 — Language Knowledge`** · 60 min · 70 questions · `● Ready` · chips `Vocabulary`,
    `Grammar`, `Reading` · `Begin Phase 1`
  - **`BETWEEN PHASES — Take a short break.`** — *"The listening section will begin after your break.
    Prepare your headphones. Relax your eyes. Drink some water."* · `I'm Ready`
  - **`PHASE 2 — Listening`** 🔒 *"Locked until Phase 1 is submitted."* · *"Audio will play
    automatically. Playback cannot be paused or restarted during practice. Just like the real
    examination."* · 45 min · 30 questions
- **`EXAM RULES`**, four cards: `No Pause` · **`No Companion`** · `Resume Available` (*"If you leave
  during Language Knowledge, you may continue later"*) · `Listening` (*"Once Listening begins, audio
  continues exactly like the real examination"*).

**⭐ The two phases map cleanly onto the repo's existing enum.** `jlpt_section` is
`vocab | grammar | reading | listening`; Phase 1 is exactly the first three and Phase 2 is the fourth.
`jlpt_tests.section_config jsonb` can already express the phase grouping and the per-phase timing, so
**phases are a grouping over what exists, not a new axis.**

**What has no schema:** per-phase locking, resume-from-question, `Previous Attempts` / `Best Score`
rollups on the set, and the break step.

### 10.3 `237:1690` — **Exam runner, Phase 1** · `CONFIRMED` screen, immersive

**No left nav** — the strictest chrome in the whole inventory. Top bar carries only the set name, the
phase, `REMAINING TIME 58:24` and `ANSWERED 34 / 70`.

- **Left — `QUESTION NAVIGATOR`** grouped by section *and* **mondai**: `Vocabulary MONDAI 1` (1–10),
  `Vocabulary MONDAI 2` (11–20), `Grammar MONDAI 3` (21–35), `Reading MONDAI 4` (36–48)… Chips are
  colour-coded answered / current / untouched and carry a small **flag** marker.
- **Centre** — `GRAMMAR · MONDAI 3`, *"Select one answer. Your answer is saved immediately."*, a `⚑ Flag`
  control, then questions in a continuous scroll, each showing `✓ Saved` and four options A–D.
- **Right — `FULL ANSWER SHEET`**: `Answered 34/70 · Remaining 36 · Flagged 5`, then an **OMR-style
  grid** — one row per question, four radio bubbles plus a flag — grouped by mondai. Footer
  `Continue Reviewing` · `Finish Phase ›`.

**⭐ This is a real exam simulator, not a quiz.** Mondai grouping, per-question flagging, an answer
sheet that mirrors the paper form, immediate autosave, and a countdown. **None of the four mechanics
exists in the repo:** there is no mondai level below `jlpt_section`, no flag state, no timer, no
answer-sheet surface. `jlpt_questions.question_type` is free-form text and is the closest thing to a
mondai concept today.

**State-variants of this screen** (three frames, all already read):

| Frame | State |
|---|---|
| `237:6708` `Finish phase 1` | a modal over the runner — *"Ready to finish this phase? You can still return and review unanswered or flagged questions before submitting."* · `Review` / `Submit Phase` |
| `234:1639` `To phase 2 (ready)` | the between-phases gate — `Begin Listening` |
| `234:1667` `To phase 2 (countdown)` | the auto-advancing countdown into Phase 2 |

### 10.4 `240:12992` — **Exam runner, Phase 2 (Listening)** · `STATE-VARIANT` of `237:1690`

Same shell, retuned for audio. Top bar gains `CURRENT MONDAI` and `CURRENT AUDIO`. The centre leads
with a **`NOW PLAYING`** card — *"Question 7 · Conversation"* with a **waveform** and a volume control
but, deliberately, **no transport** — matching the `No Pause` rule. Mondai now carry descriptive names
(`Quick Response`, `Situation Response`, `Long Conversation`, `Information`, `Comprehension`), the
guidance changes to *"Read ahead while the audio plays"*, and options drop from four to **three** —
which is correct for real JLPT listening.

Classified as a state-variant because the repo already models this as one runner with a `section`
search param (`/jlpt/[id]?section=`). ⚠️ But note the design adds a **flow constraint** a param cannot
express: Phase 2 is *locked until Phase 1 is submitted*.

### 10.5 `242:14234` — **Practice Complete** · `CONFIRMED` screen

`PRACTICE SCORE 84%` with `ESTIMATED PASSING LINE 95/180` vs `YOUR SCORE 152/180` and a `Passed`
badge · `Review Mistakes` / `Return to Library` · `Today's Performance` per section (Overall 84,
Vocabulary 89, Grammar 82, Reading 86, Listening 79) · **`Companion Insights`** (`STRONGEST AREA`,
`STILL GROWING`, `OBSERVATION`) · **`Continue Your Journey`** · `Mistake Distribution` ·
`Today's Journey` (a timestamped timeline: started 10:04 → finished Language Knowledge 11:06 →
listening completed 11:48 → practice finished 11:52) · `TODAY'S NOTE` · **`QUIET MILESTONE — First Full
Practice`**. Rail: `TODAY'S REFLECTION` · `AREAS STILL GROWING` · `RECENTLY IMPROVED` ·
`COMPANION DIARY`.

**⭐ Per-section scoring already exists** — `jlpt_attempts.section_scores jsonb`. The passing line,
the mistake distribution, the timeline and the milestone do not.

**⭐⭐ `Continue Your Journey` routes OUT of JLPT into three other modules**, each with a reason:
`SHADOWING — Restaurant Conversation` (*"Recommended because listening confidence needs
improvement."*), `GRAMMAR REVIEW — Particles` (*"Review today's mistakes."*), `CONVERSATION — Ordering
Food` (*"Practice using what you learned."*). **This is a real IA edge the current navigation has
nowhere to put**, and it is the same reason-carrying recommendation contract found in §7.1.

**⚠️ One insight implies telemetry nothing records:** *"Trusting your instincts — You rarely changed
answers after reviewing."* That requires storing **answer revisions**, not just final answers.
✅ **The user ruled revisions ARE recorded, and asked for a whole family of insights built on them —
the contract and seven variants are designed in §10.9.** The card the frame drew turns out to be the
*null* case of that family: it only fires when the learner barely changed anything.

### 10.6 `243:14899` + `243:15364` — **Review Mistakes** · `CONFIRMED` screen + `STATE-VARIANT`

`243:14899` is the collapsed list; `243:15364` is the same screen with one question expanded.

Header `18 / 30 Reviewed` · *"Let's understand every answer together."* · `Correct 152 · Incorrect 28 ·
Skipped 0` · *"Today you learned much more than today's score."* · filter chips
`All / Incorrect / Correct / Skipped / Vocabulary / Grammar / Reading / Listening` · a question
navigator · rows grouped by mondai, each `Correct` / `Incorrect` / `Skipped` with a `Review ⌄`
expander.

**Expanded, one question contains four teaching blocks:**
1. **`ORIGINAL QUESTION`** with all options and the correct one marked.
2. **`WHY THIS ANSWER`** — a written contrast of the right answer against the distractors
   (送る vs 運ぶ, and why each other option fails).
3. **`VOCABULARY`** — the target word, reading, gloss, an example sentence, `🔊 Listen`.
4. **`MINI PRACTICE`** — a fresh generated question using the same point.

Then **`COMPANION OBSERVATION`**: *"You solved this instantly. I won't spend as much time reviewing
this vocabulary anymore. We'll move forward together."*

**⭐⭐ The result writes back into the plan — ✅ CONFIRMED by the user 2026-08-12.** That observation,
plus the rail's **`UPCOMING ADJUSTMENTS — Your roadmap has already been updated`** (*more particle
review · restaurant conversations · faster listening*), is **real behaviour, not reassuring copy**: a
certification attempt mutates the learner's roadmap and review scheduling. The repo stores attempts
and section scores; nothing consumes them to adjust anything. See §10.9.

### 10.7 ⭐⭐⭐ The Companion boundary: the design **enforces** it, and states it more precisely than the doc

`design-reconciliation.md` lists JLPT practice as an active acquisition loop where the Companion is
**`Not Supported`**. The Figma frames do not merely comply — they make the rule visible to the learner,
three times over:

- an `EXAM RULES` card titled **`No Companion`** — *"The Companion remains silent during practice."*
- the pre-flight rail note — **"Once the exam starts, the Companion disappears."**
- and, after submission, the Companion's first words are **"I've been waiting."**

**The design refines the doc rather than contradicting it.** The doc draws the boundary around "JLPT
practice"; the frames locate the **exact edges**: the Companion is *present* in the lobby (`232:2`),
in pre-flight (`234:618`), in the result (`242:14234`) and throughout review (`243:*`) — and *absent*
only between `Begin Phase 1` and submission. **This is the clearest layer-A/layer-D agreement found in
the inventory**, and it should be lifted into the design docs, because the docs' own JLPT row is less
precise than the frames.

### 10.8 Cluster verdict

| Node id | Name | Tag | Route | Verdict |
|---|---|---|---|---|
| `232:2` | Certification Practice | `CONFIRMED` | `/jlpt` ≈ | built as JLPT-only; no exam-family axis, resume card or rail |
| `234:618` | Practice set detail / Exam Structure | `CONFIRMED` | none | unbuilt; phases map onto the existing section enum |
| `237:1690` | Exam runner (Phase 1) | `CONFIRMED` | `/jlpt/[id]` ≈ | built as a quiz; **mondai, flagging, timer and answer sheet are all absent** |
| `237:6708` | Finish phase 1 | `STATE-VARIANT` | — | — |
| `234:1639` | To phase 2 (ready) | `STATE-VARIANT` | — | — |
| `234:1667` | To phase 2 (countdown) | `STATE-VARIANT` | — | — |
| `240:12992` | Exam runner (Phase 2 · Listening) | `STATE-VARIANT` | `?section=` ≈ | phase locking is a flow the param cannot express |
| `242:14234` | Practice Complete | `CONFIRMED` | none | `section_scores` exists; everything else unbuilt |
| `243:14899` | Review Mistakes | `CONFIRMED` | none | wholly unbuilt |
| `243:15364` | Review Mistakes (expanded) | `STATE-VARIANT` | — | — |

**5 screens, 5 state-variants, none obsolete.**

**Capabilities added:** multi-certification practice (`JLPT` / `BJT` / `Tokutei Ginou`) · full-length
timed mock exams · **two-phase exam flow with a between-phase break and phase locking** · mondai-level
question grouping · per-question flagging · an **OMR-style answer sheet** · immediate autosave and
resume-from-question · exam-accurate listening constraints (no pause, no restart, 3 options) ·
estimated passing line and pass/fail · per-section scoring · mistake distribution · a session
timeline · behavioural insight from answer-revision telemetry · **cross-module next steps carrying
reasons** · per-question mistake review with `WHY THIS ANSWER` + vocabulary + **generated mini
practice** · **roadmap and review-schedule write-back from an exam result** · quiet milestones ·
Companion diary entries · **an explicit Companion silence window scoped to the exam itself**.

### 10.9 ✅ User rulings, 2026-08-12 — all three cluster questions answered

| Question | Ruling |
|---|---|
| Is the module `Certification Practice` with three exam families, or JLPT only? | **Three families.** `JLPT` · `BJT` · `Tokutei Ginou` are real. The module is `Certification Practice`; JLPT is one member. |
| Should answer *revisions* be recorded? | **Yes** — and the user extended the ask: revisions should power **a family of insights**, not just the one card the frame drew. |
| Does the result write back into the roadmap? | **Yes.** |

**The shape to hold, confirmed by the user 2026-08-12:**

```
Certification Practice          ← capability / module
  ├── JLPT                      ← exam family (the only one the repo implements)
  ├── BJT
  └── Tokutei Ginou
```

**Do not force Figma into the repo's current ontology.** `jlpt_tests` / `jlpt_questions` /
`jlpt_section` / `/api/jlpt/*` / `/jlpt` are all named for one member of a three-member family — that
is a *finding about the product*, and the inventory's job is to state it, not to fix it. ⚠️ **No schema
migration is triggered by this discovery.** Implementation handles it in a later phase; the user was
explicit. What the inventory records is: the module is `Certification Practice`, JLPT is a family
value, and **the repo has implemented exactly one family so far**.

One structural note worth carrying, because it constrains whoever does the later work: BJT and Tokutei
Ginou have **different section structures** from JLPT, so `jlpt_section`'s four-value enum cannot be
the shared abstraction — per-family structure belongs in data, not in an enum.

#### The answer-revision contract (ruling 2)

**Record per question, per attempt, an ordered list of answer events** — enough to reconstruct the
learner's path, not just the destination:

```
answer_event(attempt_id, question_id, from_choice | null, to_choice, changed_at, phase, was_flagged)
```

From that, four derived counts and their signs:

| Derived | Meaning |
|---|---|
| `first_right → final_wrong` | talked themselves out of a correct answer |
| `first_wrong → final_right` | reviewing rescued it |
| `first_wrong → final_wrong` | churn with no gain |
| `never_changed` | stability |

**net = (wrong→right) − (right→wrong)** is the single number that decides which insight fires.

#### Insight family (ruling 2, extended — the user invited more)

The frame drew only the null case (*"You rarely changed answers after reviewing"*). Seven variants,
each with the condition that must hold before it may be shown:

| # | Fires when | The insight, in the Companion's voice |
|---|---|---|
| 1 | `right→wrong` dominates | *"You changed 6 answers today, and 4 of them were right the first time. Your first instinct is reading better than your second guess."* |
| 2 | `wrong→right` dominates | *"Going back was worth it. Reviewing rescued 5 questions you would otherwise have lost."* |
| 3 | changes ≈ 0 **and** accuracy high | *"You rarely changed an answer. You knew what you knew."* (the drawn case) |
| 4 | `wrong→wrong` dominates | *"You changed 3 answers and none of them landed. When a question resists you twice, flag it and move — the time is worth more elsewhere."* |
| 5 | the pattern splits by section | *"In Reading you changed almost nothing. In Grammar you changed a third of your answers — that is where the uncertainty lives."* |
| 6 | changes concentrate on **flagged** questions | *"Every answer you changed was one you had flagged. Your flagging is doing its job."* — and its inverse: changes on unflagged questions read as drift, not triage |
| 7 | changes cluster in the **final minutes** | *"The three answers you changed in the last five minutes all moved the wrong way. Late doubt is expensive."* |

**⭐⭐ Two rules that keep these honest — and the user has promoted them to govern ALL Companion
intelligence, not just this card:**

1. **Not enough sample → no conclusion.** Below ~4 changes the sign of `net` is noise, and an insight
   asserting a *habit* from two data points is simply false. Under the floor, fall back to variant 3
   or show nothing.
2. **Never infer psychology from telemetry.**
   - ❌ *"You changed your answer because you lack confidence."* — a diagnosis the data cannot support.
   - ✅ *"Of the 8 answers you changed, 6 were right to begin with."* — an observation the data carries.

   Insight #6's inverse is the easiest one to get wrong.

**The reframe that makes this worth the schema, in the user's words:** the point is not that Korume
stores answer changes. It is that **Korume can learn the learner's decision-making pattern from how
they work, not only from what they got wrong.** Most study products can say *where* you failed; very
few can say whether going back helped you, whether your flags pointed at the right questions, or
whether your instinct outperforms your revision.

**Placement respects the Companion boundary (§10.7):** every one of these is post-submission, shown in
the result or review screens. None can appear during the exam.

#### Roadmap write-back (ruling 3)

Confirmed: a certification result **mutates the learner's plan**. That makes `UPCOMING ADJUSTMENTS`
(*"Your roadmap has already been updated"*) and the per-question `COMPANION OBSERVATION` (*"I won't
spend as much time reviewing this vocabulary anymore"*) real behaviour rather than reassuring copy.

**⭐ The Roadmap is therefore not a static screen — it is a learning-state OUTPUT.** The user's framing,
and it changes how `64:2061 Roadmap` / `180:2 Roadmap detail` must be read when the Companion cluster
reaches them:

```
Practice → Result → Learning analysis → Recommendation / Insight
        → Roadmap adjustment → Companion explanation
```

**⚑ Still open, deliberately — and it is an architecture question, not a product one.** Is this the
*same* engine that produces the shadowing recommendation reasons (§7.1)? Both consume learning history
and emit a ranked next-thing plus a derived reason. **Do not decide it here.** The suspicion to test
once all 57 frames are read — the user's hypothesis, and the inventory is already three clusters into
supporting it:

```
Shadowing ─┐
JLPT ──────┤
Mistakes ──┤
Vocabulary ─┼──→  Learning Intelligence  ──→ "What next?" ──→ Roadmap ──→ Companion
Grammar ───┤
Companion ─┤
Conversation ─┘
```

**If that holds, it is one of Korume's core capabilities — not a JLPT feature and not a Shadowing
feature.** Evidence so far: §7.1 (recommendations carry derived reasons), §9.4 (the lesson summary
writes to memory and proposes the next lesson with a reason), §10.5–10.6 (a certification result
routes into three other modules and rewrites the roadmap). Three independent modules already feed the
same shape. **The capability map is where this gets decided, because that is the only place every
producer and consumer of "what next" is visible at once.**

> These rulings are **inputs to a later spec, not a spec**. Recorded here because the analysis is where
> they were produced; the schema, the endpoint shapes and the copy all belong to Phase 2 and beyond.

---

## 11. Cluster: Companion — batch 1 of 4 (the three destinations + one empty state)

14 frames, the largest remaining cluster, run in batches of ≤4. **Rule 3 applied first**, and this
module has the strongest layer-A authority in the repo: `docs/design/patterns/companion-patterns.md`
(611 lines) plus `design-reconciliation.md` §4/§5/§6.

### 11.0 The four things that must not be conflated

The user's requirement, and the doc supplies the blade for it. `companion-patterns.md` § *The
Companion Never Belongs To A Screen*:

```
Wrong:  Dashboard → Companion,  Library → Companion,  Shadowing → Companion
Right:  Application → Companion → Current Screen
```

*"Companion không thuộc về Dashboard. Không thuộc Library. Không thuộc Shadowing. Mọi screen chỉ
'đón' Companion ghé qua."* On top of that sits a **presence-level** system — `Level 0 Hidden ·
1 Ambient · 2 Observe · 3 Listening · 4 Address · Silent` — mapped to a runtime `CompanionState`
machine in `design-reconciliation.md` §5.

**So the four kinds, with the test that separates them:**

| Kind | Test | This batch |
|---|---|---|
| **Companion screen** | the learner *navigates to it*; the Companion is the subject | `156:1310` · `190:7376` · `215:15164` |
| **Companion panel** | a region **inside another screen's** layout; the Companion is a guest | the rail cards already found on the hub (§7.1), the JLPT lobby (§10.1) and the result (§10.5) |
| **Companion interaction** | a **transient presence event** — it arrives, speaks or offers, and leaves | `181:3525` drawer, `182:3859` reflection panel (batch 2) |
| **Companion-generated content** | an **artifact** the Companion produces that persists and has its own retrieval | diary letters, learning memories, gentle suggestions, insights, reflections |

**Why the separation is load-bearing** (the user's warning, and it is correct): without it, Companion
becomes a pile of routes and components and it stops being clear whether it is *a world* or *a
chatbot*. Note the asymmetry the doc forces — **panels and interactions are the Companion visiting a
screen it does not belong to; only the three destinations are screens.** And generated content is
orthogonal to all three: the same diary letter appears as content in a panel, in an interaction, and
on its own screen.

**Repo, measured:** the presence system **already exists** —
`lib/companion/presence/{state-machine,arbitration,contexts,speech,config}.ts`, plus
`lib/companion/{dedupe,mastery,phase}.ts`, `components/companion/use-companion.ts`,
`/api/companion/journal` and `/api/companion/memories`. Routes: **`/journal` (immersive)** and
**`/sensei` (app)**. There is **no Companion home route.**

### 11.1 `156:1310` — **Companion home** · `CONFIRMED` screen

| | |
|---|---|
| **Kind** | Companion **screen** — the Companion is the subject, not a guest. |
| **Capability** | The Companion's own room: what it has noticed, what it suggests, what you and it are working on. |
| **Entered from** | Not determinable from the frame; no nav row points at it (the visible nav has no Companion entry). **Open.** |
| **Exits to** | `See all` ×5 (memory, suggestions, vocabulary shelf, conversation memories, still-practicing) · `Practice together` ×4 → a practice surface · `Read more` → reflection · `View full journey` · `View diary` → `190:7376`. |
| **Actions** | Read; `See all`; `Practice together`; **edit today's reflection** (a pencil icon); switch the journey range `Today / Week / Month / Journey`. |
| **Data** | companion identity + tenure (`Storykeeper`, *"Studying together for 126 days"*) · a **presence indicator rendered as copy** (*"Listening quietly…"*) · `LEARNING MEMORY` (dated observations) · `GENTLE SUGGESTIONS` (observation + a soft proposal) · `LANGUAGE GROWTH` (qualitative claims) · **`PERSONAL VOCABULARY SHELF`** (word, gloss, date, **Confidence** level + meter) · `CONVERSATION MEMORIES` (milestone cards with images and dates) · `THINGS WE'RE STILL PRACTICING` (skill, focus, Confidence: *Growing / Improving / Still exploring*) · `TODAY'S SMALL VICTORY` · rail: reflection, weekly journey timeline, diary excerpt. |
| **API** | `/api/companion/memories` ✅ · `/api/companion/journal` ✅. Nothing serves the vocabulary shelf, the growth claims, the still-practicing list or the journey timeline. |
| **Route** | ❌ none. |

**⭐ This frame resolves an open question carried since 2026-08-11.** §4 asked whether the
`PERSONAL VOCABULARY SHELF` reads from `/vocab` or is companion-owned, and noted its `Confidence`
meter is not something `/vocab`'s SM-2 models. **It sits inside Companion home** — so it is
companion-owned, and `Confidence` is a Companion concept, not an SRS interval. The same vocabulary
*word* may appear in both places under two different models of "how well do you know this".

**⭐ Rule-4 clarification, not a conflict.** The doc defines presence levels as an internal state
machine. The frame renders one **as user-visible copy** — *"🎙 Listening quietly…"* under the
Companion's name. That is `Level 3 — Listening` surfaced to the learner. The doc never says the level
is displayable. **Record as a design clarification; do not edit either side.**

**Two artifacts, not product:** the hero image is a **mascot pose sheet** with Vietnamese labels
(`NGỒI YÊN`, `NẰM THƯ GIÃN`, `CHÀO HỎI`…) — design scaffolding pasted into the frame, not UI. And the
rail is titled **`NIHONGO CINEMA`**, a pre-rebrand name.

### 11.2 `190:7376` — **Companion Diary** · `CONFIRMED` screen, immersive

*"Letters I've written while walking beside you."* No nav; a warm lamp-and-desk illustration bleeds in
from the edge.

Each entry: a **mood glyph** (moon / sun / rain / leaf / sparkle / sprout) · a date · a 2–4 line letter
in the Companion's voice · a closing line in amber (*"Until tomorrow." · "I'll be here." · "It felt
like a beginning."*) · a **`♡ Remember This`** action. A right-hand **time rail** navigates
`Today · July · June · May · April · March · Earlier memories`. Header carries `Search a memory…` and
**`Favorite Letters ♡`**.

- **Kind:** screen, and its entries are the purest example of **Companion-generated content** — dated,
  mood-tagged, individually favouritable, searchable, and addressable by time period.
- **Repo:** `/journal` exists and is `(immersive)` ✅ — the chrome contract already matches.
  `/api/companion/journal` ✅. **Not modelled:** mood glyph, favourite/remember, search, time-rail
  navigation.
- ⚠️ The letters are strikingly specific (*"You replayed one sentence eight times. Not because you
  couldn't say it. Because you wanted to say it beautifully."*). That is generated from behavioural
  telemetry of the same class §10.9 just designed for answer revisions.

### 11.3 `215:15164` — **Companion Knowledge Assistant** · `CONFIRMED` screen

Header `Companion / Japanese Knowledge`, badge `Learning with you`, right-hand `Conversation Memory`.

**This is not a generic chatbot, and the difference is the whole point:**
- It **opens by grounding itself in the learner's history** — ✨ *"You've already encountered particles
  in **three Shadowing lessons**. I'll build from there."*
- Answers embed a **furigana example card** with `🔊 Listen` and a gloss.
- **Suggested continuations** are pedagogical: `Give another example` · `Practice together` ·
  `Compare に / で`.
- The composer is in **correction mode** — *"Paste a Japanese sentence to correct…"*, footnoted
  *"Correction mode · Companion remembers your progress"* — plus a mic.
- Rail `LEARNING CONTEXT`: *"You're strongest when examples come first. So I'll keep the grammar close
  to something you can say."* — a stated **teaching strategy derived from the learner**.
- Rail `IN THIS CONVERSATION`: entities raised, with **exposure counts** — は *"Topic particle · JLPT N5
  · **Seen 31 times**"* — and a link to the lesson that teaches them.
- Rail `A SMALL MEMORY`: *"Last month you asked about 失礼します. Today you naturally used it correctly."*

- **Repo:** `/sensei` exists (`(app)` chrome) ✅. `lib/ai` + the conversation module exist. **Not
  modelled:** cross-module grounding, per-entity exposure counts, correction mode, in-conversation
  entity extraction, or the strategy statement.
- ⭐ This is the destination the search panel's `Ask Companion` branch points at (§7.2) — the edge is
  now confirmed at both ends.

### 11.4 `216:15648` — ⚠️ the frame name is wrong: this is the **Diary's** empty state

Named `Empty state (Companion home)`. The picture says otherwise: the header reads **`Korume | Diary`**
and the copy is *"**Our diary hasn't begun yet.** Every lesson. Every conversation. Every quiet little
victory. I'll remember them here."* with `Start Today's Lesson ↗` and `Explore Lessons`.

**Classification: `STATE-VARIANT` of `190:7376 Companion Diary`, not of `156:1310`.** Add to the
rename list — `Empty state (Companion Diary)`. This is the method rule earning its keep for the third
time: the name said one screen, the picture said another.

### 11.5 Batch 1 verdict

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `156:1310` | Companion home | **screen** | ❌ none | unbuilt; resolves the vocabulary-shelf ownership question |
| `190:7376` | Companion Diary | **screen** | `/journal` ✅ `(immersive)` | chrome already correct; mood/favourite/search/time-rail unmodelled |
| `215:15164` | Companion Knowledge Assistant | **screen** | `/sensei` ✅ `(app)` | grounding, exposure counts and correction mode all unbuilt |
| `216:15648` | *"Empty state (Companion home)"* | `STATE-VARIANT` of `190:7376` | — | **misnamed frame** |

**Capabilities added:** a companion identity with tenure · **presence surfaced as copy** · dated
learning memories · gentle suggestions pairing an observation with a soft proposal · qualitative
language-growth claims · a **companion-owned vocabulary shelf with a Confidence model distinct from
SRS** · milestone conversation memories · a still-practicing list with confidence bands · an editable
daily reflection · a journey timeline with range switching · **diary letters with mood, favourites,
search and time navigation** · a knowledge assistant that **grounds answers in the learner's own
lesson history**, tracks **per-entity exposure counts**, offers pedagogical continuations, and runs a
**sentence-correction mode**.

---

## 12. Cluster: Companion — batch 2 of 4 (two visiting surfaces, two destinations)

Chosen to test the taxonomy where it is hardest: two frames that should be **interactions** and two
that should be **screens**. The split held.

### 12.0 ⭐⭐ The pattern this batch found: **provenance-attached claims**

Three frames, independently, attach the **evidence** to whatever the Companion asserts:

| Frame | The mechanism |
|---|---|
| `182:3859` | **`INSPIRED BY`** — *"• 3 pronunciation sessions · 8 careful replays"* printed beneath the reflection |
| `181:3525` | **`Observed from`** — *"Restaurant Conversation · Yesterday"*, *"Detected across your last three listening sessions"*, *"Observed in your recent replies"* |
| `180:1770` | each memory card carries the **source lesson** it came from, and `Replay lesson →` |

**This is the §10.9 honesty guard rendered as UI.** The rule was *never infer psychology from
telemetry — state the observation the data carries*. These frames go one step further: they **show the
data**. The learner can see that *"Curiosity is stronger than talent"* rests on *8 careful replays*,
and can disagree with the reading while accepting the fact.

**Recorded as a capability: `provenance-attached companion claim`.** It is not decoration — it
constrains the data model, because every Companion statement must retain a link to the events that
produced it. Note the repo already has the substrate: `lib/companion/presence/contexts.ts` and
`/api/companion/memories`.

### 12.1 `182:3859` — **Today's Reflection** · Companion **interaction** (overlay panel)

A centred card over a dimmed page — the frame name's *"fade around"* is the dimming. No nav, no
header, no chrome.

Eyebrow `COMPANION REFLECTION` · title · date `May 28, 2026` · a card tagged `🎙 PRONUNCIATION`
carrying the reflection (*"You replayed one difficult sentence eight times. Curiosity is stronger than
talent."*) · signed **`Korume · Listening quietly`** (presence as copy again, §11.1) · footer nav
`‹ Previous · Today · Next ›` · a **date rail** `May 27 · May 28 · May 29 · Today` · **`INSPIRED BY`** ·
closing line *"Some days only leave a small trace. It still counts."*

- **Kind: interaction**, and a navigable one — it browses across dates without becoming a screen.
  Presentation, not navigation → a dialog/drawer component, **no route**.
- **Entered from** the `TODAY'S REFLECTION` rail card on Companion home (`Read more ›`) — the panel
  ↔ interaction relationship the taxonomy predicts: the rail card is the **panel**, opening it is the
  **interaction**, the reflection text is the **generated content**.
- **Unbuilt.** Nothing in the repo renders a reflection, and `date` navigation over reflections has no
  endpoint.

### 12.2 `181:3525` — **Gentle Suggestion drawer** · Companion **interaction** (drawer)

550×1070 — a narrow side drawer, which the geometry alone already tells us.

Header ✨ `GENTLE SUGGESTIONS` · *"Based on how you've been learning recently."* · an opening line in
the Companion's voice. Then suggestion cards, each carrying: a **category** (Pronunciation / Listening
/ Grammar / Conversation) · a **classification tag** — `Recently struggled` · `Matches your pace` ·
**`From Companion memory`** · `Getting better` · a title · **a reason** · **`Observed from`
provenance** · a **target lesson with duration and JLPT level** · and two actions, **`Dismiss`** and
**`Practice Now →`**. Between cards the Companion interjects: ♡ *"I think this one would feel
satisfying today."* Footer: **`↻ Refresh Suggestions`** · *"Suggestions update naturally as you
study."*

- **Kind: interaction.** Presentation, not navigation → **no route**.
- ⭐ **`Dismiss` is a real state-changing action** — the learner can reject a suggestion, which implies
  per-suggestion persistence and feeds the arbitration the repo already has in
  `lib/companion/presence/arbitration.ts`.
- ⭐ The four tags are a **taxonomy of why a suggestion exists** (struggle · pace-match · memory ·
  improvement). That is the Learning Intelligence hypothesis (§10.9) showing its reasoning categories.
- **Unbuilt** as a surface; the presence/arbitration substrate exists.

### 12.3 `180:1770` — **Learning Memory** · `CONFIRMED` screen

`← Back to Companion`, so it is entered *from* Companion home — the **archive** behind that screen's
`LEARNING MEMORY` panel.

`Search memories` · `Filter` · `Newest ⌄` · category chips `All / Shadowing / Pronunciation /
Conversation / Vocabulary / Grammar / Listening / Achievements / `**`Companion Notes`** · entries
**grouped by month** on a vertical timeline · each card: category · date · a headline · a body line ·
a **source-lesson chip** · a **bookmark** · `Open memory →`. An expanded card adds longer prose, a
**`COMPANION'S NOTE`** block, and `Replay lesson →`. Rail: **`PINNED MEMORIES`** (*"The pages you chose
to keep close."*) and **`A SMALL OBSERVATION`**.

- **Kind: screen**; its entries are **generated content**; the rail cards inside it are **panels**.
  All three kinds appear in one frame, which is exactly why the taxonomy is needed.
- **Repo:** `/api/companion/memories` ✅ and `lib/data/companion.ts` ✅. **No route.** Unmodelled:
  pinning, category filter, search, sort, month grouping, source-lesson linkage, `Companion Notes` as
  a category of its own.
- ⭐ `Companion Notes` being a *filterable category* means the Companion's own writing is stored
  alongside observations about the learner — one archive, two authors.

### 12.4 `187:6556` — **Growth Areas** · `CONFIRMED` screen

Eyebrow `LEARNING JOURNEY` · *"Let's look at where you're quietly becoming stronger."*

- **`AREAS STILL GROWING`** — *"Not problems to solve. Just places with room to become familiar."*
  Five **selectable** skill cards with percentages: Listening 64 (selected) · Pronunciation 72 ·
  Conversation 58 · Particles 49 · Kanji 45.
- Selecting one reveals **`LISTENING · YOUR NEXT GENTLE STEP`**: a diagnosis (*"You're beginning to
  recognise complete phrases, but fast conversations still make you hesitate."*) and **two concrete
  lessons** — `Podcast Lesson 5 →`, `Shadowing Lesson 12 →`.
- `RECENTLY IMPROVED` (Long vowels · Pitch accent · Business greetings · Listening confidence, each
  with a qualitative note) · `THIS WEEK` (18 Lessons · 4 Conversations · **126 Shadowed sentences** ·
  2h Practice) · **`SUGGESTED FOCUS`** — three lessons, each with a reason.
- Rail: a two-paragraph **`COMPANION REFLECTION`** and `A quiet note from Korume`.

- ⭐⭐ **This is the consumer end of the Learning Intelligence hypothesis** (§10.9): a skill map, a
  diagnosis per skill, and a route from the diagnosis into specific lessons. It is the same
  `analysis → what next → reason` shape as the shadowing recommendations and the JLPT result, arriving
  from a third direction.
- **⚑ Resolves an earlier mapping guess as wrong.** §5 asked *"`Growth Areas` → `/weekly-report`?"*
  **No.** This is a persistent skill-progress map, not a periodic report — and this frame's own nav
  lists `Roadmap` and `Weekly Report` as separate rows while showing neither as active.
- **Unbuilt**; no route, and no endpoint produces per-skill percentages or a next-step diagnosis.

**Design noise, not product:** the frame renders `You&apos;re` and `Let&apos;s` as literal text —
HTML entities that survived the import. Same class as the pose sheets in §11.1.

### 12.5 Batch 2 verdict

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `182:3859` | Today's Reflection | **interaction** (overlay panel) | none, correctly | unbuilt |
| `181:3525` | Gentle Suggestion drawer | **interaction** (drawer) | none, correctly | unbuilt; arbitration substrate exists |
| `180:1770` | Learning Memory | **screen** | ❌ none | memories API exists; pin/filter/search/source-link unmodelled |
| `187:6556` | Growth Areas | **screen** | ❌ none | not `/weekly-report`; wholly unbuilt |

**Capabilities added:** **provenance-attached companion claims** · date-navigable daily reflections ·
dismissible suggestions with a **why-this-exists taxonomy** (struggle / pace / memory / improvement) ·
suggestion refresh · a **searchable, filterable, pinnable memory archive** grouped by time and linked
to source lessons · `Companion Notes` as a first-class memory category · a **per-skill growth map with
percentages** · a per-skill **next gentle step** that names specific lessons · qualitative
"recently improved" tracking · weekly activity totals · reason-carrying suggested focus.

---

## 13. Cluster: Companion — batch 3 of 4 (the Roadmap pair + Conversation Memories)

### 13.0 ⚠️⚠️ `Journey` names two different things, and the collision is live in the repo

**Measured.** `components/layout/app-nav.tsx:52` and `:59`:

```ts
{ href: "/roadmap", key: "roadmap" },
{ href: "/journal", key: "journey"  },   // ← the Companion Diary, labelled "Journey"
```

**In Figma, "Journey" is the Roadmap.** `64:2061` is titled **"Your Japanese Journey"**; its map is the
`JOURNEY MAP`; its memories are `JOURNEY MEMORIES`; `180:2` opens with `← Back to Journey` and its rail
shows `JOURNEY CONNECTION`. Meanwhile `190:7376` — the thing `/journal` actually renders — is titled
**"Companion Diary"** and never uses the word.

So the label `Journey` currently points at the **Diary**, while the design uses it for the **Roadmap**,
and both appear as separate nav rows. This came from the rebrand's `journal → journey` rename, which
renamed the *label* without checking what the design meant by the word.

**This is a naming collision to resolve in the IA step, not now.** Recorded because it is exactly the
class of error the whole inventory exists to catch — and because it cannot be seen from either artifact
alone.

### 13.1 `64:2061` — **Roadmap / "Your Japanese Journey"** · `CONFIRMED` screen

*"A personalized path designed by your Companion, based on your goals and progress."* — the subtitle
states the authorship outright.

- **`Journey Map` / `List View`** toggle · category tabs `Overall Journey · Conversation · Listening ·
  Grammar · Vocabulary · Kanji · Culture · Anime`.
- **`JOURNEY MAP`** — a **spatial map**, not a list: named destinations on a winding path
  (`Beginner Village` → `First Anime` → `Speak First Sentence` → **`Listening Foundation`** carrying a
  **`YOU ARE HERE`** badge and 72% → `Travel to Tokyo` 🔒 → `Finish N5` 🔒 → `N4 Adventure`), with zoom
  controls and `View Full Journey ↗`.
- `JOURNEY MEMORIES` (3 milestones with kanji-glyph avatars) · `RECOMMENDED FOR YOU` — *"Based on your
  weakness in Listening"* — 4 lessons, each tagged `Listening Focus` · a `Companion's Note` bar with
  **`Talk with Companion`**.
- Rail: **`CURRENT MISSION`** (`Listening Foundation`, `Chapter 2 · Scene 4`, 72%, three **tasks** with
  counters — `Shadow 25 lines 12/25`, `Practice with 15 listening cards 8/15`, `Watch 1 anime scene
  1/1 ✓` — and `▶ Continue Mission`) · **`AI WEAKNESS EXPLORER`** (5 skills with percentages,
  `View Analysis ↗`) · **`NEXT DESTINATION`** with what it **`Unlocks`**.

**Repo:** `/roadmap` exists and is **a placeholder** — measured, its `page.tsx` renders
`UpcomingScreen`.

### 13.2 `180:2` — **Roadmap detail / mission** · `CONFIRMED` screen

`← Back to Journey` · breadcrumb `Journey › Listening › Listening Foundation` · `Overall Journey
Progress` · **`Chapter 2 of 6`**.

- Hero: cover · `🎧 LISTENING` · title · goal statement · and a **quoted Companion rationale**:
  *"I noticed that you often understand the vocabulary, but lose confidence once native speakers speed
  up. This mission is designed to help with that."*
- Stats: `Mission Completion 72% · Time Invested 3h 42m · Lessons Finished 7/10 · Current Streak 5 days
  · Estimated Remaining 1h 30m`.
- **`REQUIRED LESSONS`** — five lesson cards with per-lesson state (`Completed ✓` / `Continue lesson →`
  / 🔒 *"Complete previous lesson to unlock"*).
- **`PRACTICE REQUIREMENTS`** — four measurable gates, each with a counter and a trophy:
  *Complete 3 Shadowing lessons 3/3 · Reach 80 pronunciation score 68/80 · Finish 20 listening cards
  20/20 · Review vocabulary twice 1/2*.
- **`SKILLS YOU'LL BUILD`** — six named skills (Natural Listening · Native Rhythm · Fast Word
  Segmentation · Conversation Confidence · Understanding Fillers · **Pitch Awareness**).
- **`MISSION REFLECTION`** — collapsed: *"Why this mission matters · a small Companion memory, study
  tip, and cultural note."*
- Rail: `COMPANION INSIGHTS` (Current Strength / Current Weakness / Suggested Focus / Recent
  Observation) · **`UNLOCKS`** — five locked rewards of three kinds (`Conversation Pack`,
  `Roadmap Level`, `4 New Lessons`, `Next Mission`) · **`JOURNEY CONNECTION`** — Chapter 1 ✓ →
  Chapter 2 (current) → Chapter 3 🔒 · `▶ Continue Mission`.

**⭐⭐⭐ The Roadmap is a mission system, and that is bigger than "a screen that shows a plan".**

```
Journey → Chapter (1 of 6) → Mission → { required lessons · practice requirements · skills } → Unlocks → next Mission
```

It has **gates** (a mission completes only when measurable requirements are met), **locking**
(lessons, missions and content packs unlock in order), **rewards**, and a **Companion-authored
rationale per mission**. The user's reframe — *the Roadmap is a learning-state output, not a static
screen* — is confirmed and then some: it is the **write target** of the Learning Intelligence loop
(§10.9), and the `UPCOMING ADJUSTMENTS` seen in the JLPT review (§10.6) is an edit to *this* structure.

Nothing of this exists in the repo beyond a nav row and a placeholder page.

### 13.3 ⚠️ `AMBIGUOUS`: two different skill taxonomies, in two frames, for the same idea

| Frame | Skill set |
|---|---|
| `64:2061` `AI WEAKNESS EXPLORER` | Listening 72 · **Grammar** 58 · **Vocabulary** 63 · **Speaking** 45 · Kanji 40 |
| `187:6556` `AREAS STILL GROWING` | Listening 64 · **Pronunciation** 72 · **Conversation** 58 · **Particles** 49 · Kanji 45 |

Only *Listening* and *Kanji* are shared, and even those disagree numerically. **The percentages are
placeholder noise and can be ignored; the differing sets cannot.** One is coarse skill areas
(Grammar/Vocabulary/Speaking), the other mixes a skill (Pronunciation), a modality (Conversation) and
a grammar topic (Particles).

**A canonical skill taxonomy is required before either screen can be built**, because both the growth
map, the weakness explorer, the mission's `SKILLS YOU'LL BUILD`, the suggestion tags and the JLPT
section scores all claim to measure "how good are you at X". **Flagged for the capability map, not
resolved here.**

### 13.4 `184:3974` — **Conversation Memories** · `CONFIRMED` screen

`← Back to Companion Home` · `COMPANION MEMORY` · *"Every meaningful conversation we've shared
together."* · search + filter · category chips (`All · Restaurant · Cafe · Travel · Business ·
Shopping · Daily Life · Airport · Anime · Interview`).

A card grid — cover, category badge, headline, date, a body line, a **status dot** `● Completed` /
`● Still Growing`, a play button, some bookmarked — beside **one expanded memory**:
`📅 May 20, 2026 · ⏱ 14 min · 🎧 JLPT N3 · `**`Practiced 4 times`** · actions **`▶ Replay
Conversation`** / `Practice Again` / `Open Lesson` / bookmark ·
**`✨ Memorable moments`** quoting the **actual transcript** with the learner's own line highlighted ·
**`Korume remembers…`** *"This was the first time you replied naturally without translating in your
head."*

Rail: `YOUR COMPANION — Korume` · **`Korume's reflection`** · **`⭐ Why this memory matters`** ·
**`Your growth in this conversation`** — a four-point timeline `May 20 First attempt → May 24 Better
pronunciation → Jun 02 Natural response → Today Confident`.

- **Kind:** screen; a sibling of `180:1770 Learning Memory` — **the memory archive is split by type**,
  learning moments in one, conversations in another.
- ⭐ **A conversation memory is a living object, not a log line:** it is replayable, re-practisable,
  counted (`Practiced 4 times`), and carries its own **growth timeline** across dates.
- ⭐⭐ **The reflection is L1-aware:** *"you answered naturally without thinking in **Vietnamese**."*
  In a VN-first product the Companion references the learner's native language — a real localisation
  requirement, not decoration.

### 13.5 Batch 3 verdict

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `64:2061` | Roadmap / Your Japanese Journey | **screen** | `/roadmap` = **placeholder** | a full mission system; unbuilt |
| `180:2` | Roadmap detail (mission) | **screen** | ❌ none | unbuilt |
| `184:3974` | Conversation Memories | **screen** | ❌ none | unbuilt; sibling archive to `180:1770` |

**Capabilities added:** a **spatial journey map** with named destinations, progress and locking ·
`YOU ARE HERE` positioning · **chapters → missions** · missions with **measurable completion gates** ·
**unlockable** lessons / content packs / roadmap levels / next missions · **skills a mission builds** ·
Companion-authored **mission rationale** · a weakness explorer with `View Analysis` · list-vs-map views
of the same plan · per-category journey filtering · **conversation memories that are replayable,
re-practisable and counted** · transcript excerpts preserved as memory · **per-memory growth timelines**
· **L1-aware companion reflection**.

**⚑ Two things this batch hands to the IA/capability step, neither resolvable inside a cluster:**
the **`Journey` label collision** (§13.0) and the **absence of a canonical skill taxonomy** (§13.3).

---

## 14. Cluster: Companion — batch 4 of 4 (onboarding), and the cluster total

**Rule 3 returned nothing:** `MASCOT.md` has no onboarding, welcome, naming or companion-creation
content, and `docs/design/` has no onboarding screen doc. For this flow Figma is the only artifact.

**Repo, measured: the entire flow is unbuilt.** `git ls-files` finds no onboarding / welcome /
quickstart / setup route or component, and **no companion identity is persisted anywhere** — no
`Storykeeper`, no `companion_name`, nothing.

### 14.1 `220:16766` — **Welcome Companion** · `CONFIRMED` screen, immersive

Full-bleed, brand `Korume` top-left (post-rebrand ✅), `Skip` top-right.

A speech bubble beside the mascot — *"I won't judge mistakes. I only remember growth."* — then the
serif headline **"Nice to finally meet you."** and *"I've been watching every lesson, every
pronunciation, every quiet little victory. From today, I'll remember them with you."* Three promise
chips follow: ✨ `I remember your journey` · `I notice your growth` · `I help you continue tomorrow`.
CTA **`Meet My Companion →`**, secondary **`Maybe later`**.

**⭐ The introduction is declinable — twice.** `Skip` in the corner *and* `Maybe later` under the CTA.
That is `companion-patterns.md`'s core principle enforced at the first possible moment: *"Presence is
optional. Meaning is mandatory."* A learner can use Korume without ever meeting the Companion, which
means **every Companion surface needs a companion-less fallback** — a constraint the rest of this
cluster does not show.

**⭐ The three promises are a contract, and they map to real machinery:** *remember your journey* →
the memory archives (§11.1, §12.3, §13.4); *notice your growth* → Growth Areas and the diary
(§12.4, §11.2); *help you continue tomorrow* → suggestions and the Roadmap (§12.2, §13.1).

### 14.2 `111:1877` — **Generate sensei** · `CONFIRMED` screen · + `111:1963` **Generate done** · `STATE-VARIANT`

947×585 — smaller than a page, so this is a **modal or a partial**, not a full screen layout.

Eyebrow `JAPANWEB+ · A QUIET BEGINNING` (pre-rebrand) · headline **"Building your Study Sanctuary…"** ·
*"Every learner is different. I'm preparing your first journey based on everything you've shared."* ·
a left panel with a glowing companion silhouette, floating kanji (語 · 日 · あ) and a chip
`✨ AI Sensei is here` · and a **staged checklist with a progress bar**:

> ✅ Understanding your current level ✅ **Creating your personal roadmap**
> ○ Choosing your first lessons ○ Preparing AI Sensei

`111:1963` is the same frame completed: **"Everything is ready."** · *"Welcome. Your journey begins
today."* · CTA `Enter JapanWeb+ →`.

**⭐⭐ This closes the Roadmap loop.** Step 2 is *"Creating your personal roadmap"* — so the mission
system of §13.1–13.2 is **generated at onboarding** from what the learner shared, and then
continuously rewritten by the Learning Intelligence loop (§10.9). Origin and mutation are now both
accounted for.

**Same progress-narrative pattern as the import pipeline (§7.0), and the same reading applies.** Named
stages with checkmarks are a **presentation-level stage model**; the user already ruled on this class.
Do not treat *"Preparing AI Sensei"* as an implementation requirement.

### 14.3 ⚠️ `AMBIGUOUS`: is **AI Sensei** the Companion, or a second entity?

The evidence pulls both ways and this cluster cannot settle it:

| For "same" | For "different" |
|---|---|
| the onboarding illustration is a companion silhouette | `Preparing AI Sensei` is listed as a **separate step** from the roadmap and the lessons |
| `215:15164`'s Q&A replies are signed **`KORUME`** | the nav carries a **`Sensei`** row (`/sensei`) *and* the Companion appears everywhere without it |
| `212:14610`'s `Ask Companion` opens `215:15164`, whose route is `/sensei` | the Companion is a persistent character with a name and tenure; `AI Sensei` reads like a service |

**Best current reading, offered as a hypothesis and not a ruling:** `Sensei` is the Companion's
**knowledge-answering mode**, and `AI Sensei` is the older name for it — note the eyebrow on this very
frame is the pre-rebrand `JAPANWEB+`. If so, the naming is a rebrand leftover rather than a second
character. **Needs the user; it decides whether the IA has one Companion entity or two.**

### 14.4 Cluster verdict — Companion, all 14 frames

| Kind | Count | Frames |
|---|---|---|
| **screen** | 10 | `156:1310` home · `190:7376` diary · `215:15164` knowledge assistant · `180:1770` learning memory · `184:3974` conversation memories · `187:6556` growth areas · `64:2061` roadmap · `180:2` roadmap detail · `220:16766` welcome · `111:1877` generate |
| **interaction** | 2 | `182:3859` reflection overlay · `181:3525` suggestion drawer |
| **state-variant** | 2 | `216:15648` diary empty *(misnamed)* · `111:1963` generate done |
| **panel** | — | none as a frame of its own; panels appear **inside** other frames, in this cluster and in Shadowing/JLPT |
| **generated content** | — | not a frame kind at all; it is the payload of the other four |

**Nothing obsolete. Routes: 2 of 10 screens exist** (`/journal` immersive ≈ Diary, `/sensei` app ≈
Knowledge Assistant); `/roadmap` exists as a placeholder; the other seven have no route.

**⭐ The taxonomy earned its keep.** Without it, this cluster reads as "14 Companion screens" and the
Companion becomes a pile of routes. With it: the Companion **owns 10 destinations**, **visits every
other screen** as panels and interactions, and **produces content** that flows through all three.
`180:1770` alone contains all three kinds simultaneously (§12.3) — which is the proof the split is
real and not bookkeeping.

**⚑ What this cluster hands upward, in priority order:**
1. **The `Journey` label collision** (§13.0) — live in `app-nav.tsx`, invisible from either artifact alone.
2. **No canonical skill taxonomy** (§13.3) — blocks Growth Areas, the weakness explorer, mission skills, suggestion tags and JLPT section scores, all of which claim to measure the same thing.
3. **`AI Sensei` vs the Companion** (§14.3) — one entity or two.
4. **Every Companion surface needs a companion-less fallback** (§14.1) — the introduction is declinable.
5. **The Companion has no persisted identity in the repo** — name, tenure and voice all exist only in Figma.

---

## 15. Cluster: Conversation — 4 frames, analysed 2026-08-12

**Rule 3:** no `docs/design/screens/screen-conversation*.md`. The only design-doc coverage is the
Companion boundary (`design-reconciliation.md` lists *Conversation drills* as an active acquisition
loop where the Companion is `Not Supported`) and layout notes. Like JLPT, this module has **no written
layer-A screen authority**.

**Repo, measured:** `/conversation` exists (`(app)`), `components/conversation/**`,
`/api/conversation/{message,session,session/[id],session/[id]/end}`, `/api/speech/{stt,tts}`, and
`conversation_sessions.scenario_type text` — a **free-form string**, which is the whole scenario model
today.

### 15.1 `44:7289` — **Conversation practice** (live session) · `CONFIRMED` screen, immersive

Top bar: `SCENARIO` **Restaurant Conversation** · **`You are` Customer** · **`AI is` Restaurant
Staff** · **`Goal` Order dinner naturally** · `Difficulty N4` · `Time 8 min` · `Progress 5/12` ·
`End session`.

Main: `🎙 Live voice conversation`, *"All messages saved to this session"*. AI turns carry `🔊 Replay`;
the learner's turns carry `▷ Play Recording`, a duration, and **`✨ Analyze`**.

Right panel — **`SELECTED MESSAGE / AI Analyze`**, a **per-utterance** score card:
**Pronunciation 93% · Fluency 91% · Pitch Accent 84% · Naturalness 90%**, then `Main correction`
(*"Let the final ですか rise a little less to sound more relaxed."*) with a concrete
**`Try:`** rewrite, and five actions: `Listen Native` · `Listen Yours` · `Repeat` · **`Save Mistake`** ·
**`Practice Again`**.

Bottom: the goal restated · `💡 Hint` · `💬 Chat` · **`🎙 Hold to Speak`** · *"Voice first · Chat is
optional"*.

- ⭐ **Voice-first is stated as a product stance**, with chat as the fallback. The repo's conversation
  module is text-first with voice added.
- ⭐ **Per-message scoring on four dimensions including Pitch Accent** — CLAUDE.md §5 #1 appearing in a
  third place (after `120:2027` and its trend report).
- ⭐ **`Save Mistake`** is the mining/learning-collection family again (§7.2), now in a fifth surface.

### 15.2 `170:9364` — **Conversation practice library** · `CONFIRMED` screen

`VOICE-FIRST LEARNING` · **`+ Create AI Scenario`** · `Continue Last Session` · a `CONTINUE LEARNING`
resume card (73%, *last practiced Yesterday*, *5 minutes remaining*).

Four shelves, each `Explore all →`:

| Shelf | Content |
|---|---|
| **Popular Scenarios** | 8 situations (Convenience Store · Restaurant · Café · Train Station · Hotel · Hospital · Airport · Apartment Rental), each with JLPT level, minutes, **expression count**, the skills it trains, and per-scenario progress |
| **Business Japanese** | 6 scenarios, each badged **`AI Coach Available`** |
| **JLPT Speaking** | N5–N2, each with a **conversation-task count** and the bullets `Listening · Response · Role Play` |
| **AI Generated Scenarios** | 4 scenarios **created by other users** — *created by Mika · Yuki · Ren · Hana* |

Then **`Create Your Own Scenario`**: *"Describe any real-life situation and AI will instantly build a
complete role-play with characters, goals, vocabulary, and speaking objectives."*

Rail: `TODAY'S SPEAKING PROGRESS` (18 min · 5 voice conversations · 89% avg confidence · 16 new
expressions · **+12% pronunciation trend**) · `AI Recommendations` (*"You recently struggled with
polite expressions."*) · `READY TO SPEAK`.

**⭐⭐ Three things here are new capabilities, not variations:**
1. **User-generated scenarios, shared between users.** *"created by Mika"* is UGC with attribution —
   a community dimension the repo has for playlists and forum posts but **not** for conversations.
2. **`JLPT Speaking`.** The real JLPT has **no speaking section** — this is Korume's own construct, and
   it creates an edge between **Certification Practice and Conversation** that neither cluster's own
   frames show.
3. **`AI Coach Available`** as a per-scenario badge — a capability flag or a tier marker; which one is
   unresolved and matters for L8.

### 15.3 `46:2` — **Create New Conversation** · Companion-adjacent **interaction** (modal wizard)

An **eight-step** generator, and the steps *are* the scenario data model:

| Step | Field |
|---|---|
| 1 | how to start — `Popular Scenarios` / **`Generate with AI`** (recommended) / `Quick Start` |
| 2 | free-text situation + `Magic Suggestions` chips |
| 3 | difficulty — N5…N1 · **Native** |
| 4 | **your role** — 9 presets + `Custom Role` |
| 5 | **AI role** — 10 presets + `Custom Role` |
| 6 | style — Friendly · Professional · Casual · Formal · Business · Polite · Natural · Difficult |
| 7 | **learning focus** — Speaking Fluency · Pronunciation · **Pitch Accent** · Business Japanese · **Keigo** · Grammar · Vocabulary · Listening · Confidence · Natural Expressions |
| 8 | length — 5/10/15/20 min · **Adaptive** |

Rail: **`LIVE PREVIEW`** recomputing as you choose — including **`Estimated Vocabulary 38 words`** and
**`Estimated Grammar 6 patterns`** — plus an `AI Sensei note` and a **`Surprise Me`**.

- ⚠️ **`conversation_sessions.scenario_type` is a single free-form text column.** This wizard defines
  **eight** dimensions. The gap is not a UI gap — it is a **data-model gap**.
- ⭐ Step 7 names **Keigo** and **Pitch Accent** — CLAUDE.md §5 differentiators #6 and #1 — as
  first-class, selectable practice targets.

### 15.4 `180:1129` — **Quick preview panel: Conversation practice** · `STATE-VARIANT` (preview overlay)

A pre-session briefing: hero (`CONVERSATION · KYOTO, JAPAN` · **Restaurant** · `JLPT N4 · 12 Turns ·
Estimated 8 min · Speaking Practice`) · **`SCENARIO`** prose · **`CHARACTERS`** (Waitress —
*Friendly · Polite Japanese*; You — *Traveler · Ordering dinner*) · **`YOU'LL PRACTICE`** chips ·
**`USEFUL EXPRESSIONS`** (4 phrases with gloss and JLPT level) · **`CONVERSATION PREVIEW`** (a sample
exchange) · and **`CONVERSATION TRAITS`** — `Formality` (a 5-dot meter) · `Speaking Speed Medium` ·
`Native Difficulty Low` · `Emotion Relaxed` · `Vocabulary Density Medium` · `Humor Low`.

**⭐ `CONVERSATION TRAITS` is a second, finer scenario model** — six graded dials, distinct from the
wizard's eight categorical choices. Whether traits are *derived from* the wizard or *authored
alongside* it is unresolved and affects the schema.

### 15.5 ✅ **RESOLVED 2026-08-12** — the Companion is named **Korume**

> **User ruling.** `Hikari` was corrected to `Korume` in Figma. **`Storykeeper` is a screen name, not
> a companion name** — so it never belonged in this table, and §11.1's `Data` row misread it as the
> companion's identity. The three-name contradiction below is closed: there is **one** companion,
> named **Korume**, and the user-nameable hypothesis is **not supported**. See §20.
>
> The original finding is kept verbatim below because it is what prompted the ruling.

---

<details><summary>Original finding (superseded)</summary>

### ⚠️⚠️ `AMBIGUOUS`: the Companion has **three different names** across frames

| Frame | Name shown |
|---|---|
| `156:1310` Companion home | **Storykeeper** |
| `215:15164` Knowledge Assistant · `184:3974` Conversation Memories | **Korume** |
| `180:1129` this frame's rail | **Hikari** *"Quietly alongside you"* |

All three frames show the same mock learner (`Yuki Tanaka`), so these are not different users.

**Hypothesis, offered as a hypothesis:** the companion is **user-nameable**, set during onboarding —
which would make three names three placeholder values rather than a contradiction. Two facts fit:
`220:16766` says *"Meet My Companion"* rather than naming one, and **the repo persists no companion
identity at all** (§14). But no frame in the inventory shows a naming step, so this is unconfirmed.

**This compounds §14.3.** Together the open identity questions are: is `AI Sensei` the Companion or a
second entity, and **is the Companion's name fixed, branded, or chosen by the learner?** Both must be
answered before the IA can say what "the Companion" *is*.

</details>

**✅ Both of those questions are now answered** (2026-08-12): `AI Sensei` is the Companion's
knowledge-answering **mode**, not a second entity (`capability-map.md` §3.1), and the name is
**fixed and branded — Korume**, not chosen by the learner. The IA can say what the Companion is.

⚑ **One consequence worth carrying:** the companion and the product share a name. That is the user's
decision and it is coherent (the Companion *is* the product's voice), but any copy that says
*"Korume noticed…"* is ambiguous between the two readings. A naming/voice question for whoever writes
the strings — **not** an IA or schema question.

### 15.6 Cluster verdict

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `170:9364` | Conversation practice library | **screen** | `/conversation` ≈ | built as a much simpler surface; 4 shelves, UGC and JLPT Speaking all absent |
| `44:7289` | Conversation practice (live session) | **screen**, immersive | none (session UI exists in-page) | per-utterance 4-dimension analysis unbuilt |
| `46:2` | Create New Conversation | **interaction** (modal wizard) | none, correctly | 8-dimension scenario model vs one text column |
| `180:1129` | Quick preview panel | `STATE-VARIANT` of `170:9364` | — | traits model unbuilt |

**3 screens-and-interactions + 1 state-variant. Nothing obsolete.**

**Capabilities added:** voice-first conversation with chat as fallback · explicit **role assignment**
(learner role + AI role) and a per-session **goal** · turn budgeting (`Progress 5/12`, `12 Turns`) ·
**per-utterance analysis on four dimensions** with a concrete rewrite · `Listen Native` / `Listen
Yours` comparison · **AI-generated scenarios from a free-text description** · an **8-dimension scenario
generator** · a **6-dial conversation-traits model** · pre-session briefing with characters, useful
expressions and a sample exchange · **user-generated scenarios shared with attribution** ·
**JLPT Speaking** as a Korume-invented certification-speaking track · `AI Coach Available` as a
per-scenario capability/tier flag · speaking-progress telemetry with a **pronunciation trend**.

**⚑ Handed upward:** the **companion-naming question** (§15.5) · **`JLPT Speaking` as a
Certification↔Conversation edge** that neither module's frames own · whether **`AI Coach`** is a
feature flag or a paid tier (an L8 input).

---

## 16. Cluster: Pronunciation — 2 frames, analysed 2026-08-12

**Rule 3:** no pronunciation screen doc, but there *is* a feature doc —
`docs/features/F-016-goal-based-learning-paths.md` — and it matters (§16.3).
**Repo:** `/api/pronunciation/score` ✅ and `/api/speech/{stt,tts}` ✅ exist; **no `/pronunciation`
route of any kind.**

### 16.1 `37:4955` — **Pronunciation Studio** (library) · `CONFIRMED` screen

`SPEAK WITH CONTEXT` · *"Master Japanese pronunciation through carefully designed speaking courses and
real-world scenarios."* · a `FEATURED COURSE` (**Japanese Business Communication** — 120 lessons ·
Intermediate · 8 hours · JLPT N3–N2 · 67% · 80/120) · a `CONTINUE WHERE YOU LEFT OFF` bar. Then **five
shelves**:

| Shelf | Content |
|---|---|
| **Popular Learning Paths** | Everyday Conversation · Business Japanese · IT Engineer Communication · Travel in Japan — each with lesson count and total hours |
| **Practice by Situation** | 8 situations (Ordering Coffee · Convenience Store · Train Station · Office Meeting · Phone Call · Hospital · School · Renting Apartment) |
| **Practice by Goal** | **Improve Pitch Accent** · Improve Fluency · Native Rhythm Training — each a multi-hour track |
| **JLPT Speaking** | N5–N1 with completion % and **average score** |
| **Shadowing Collections** | Anime · News · Podcasts · Business Meetings, with sentence counts |

Rail: `TODAY'S SPEAKING` · **`WEEKLY IMPROVEMENT`** (Accuracy +8% · **Pitch Accent +13%** · Rhythm +6%
· Confidence +11%, with a trend line) · `AI SENSEI RECOMMENDATION` (*"You often flatten pitch in long
compound nouns."*) · `RECENTLY PRACTICED` with per-session scores.

**⭐ Two cross-module edges appear here, both second sightings:** `JLPT Speaking` (also in
`170:9364`, §15.2) and `Shadowing Collections` (shadowing content surfaced inside Pronunciation).
Pronunciation is not a leaf module — it **borrows content from two others**.

### 16.2 `36:4117` — **Pronunciation Studio** (per-sentence practice) · `CONFIRMED` screen

`SPEAK • LISTEN • IMPROVE` · *"…one sentence at a time through AI-powered speech analysis."*

Card: `SENTENCE 3 / 18` · `N3 · Everyday conversation` · the sentence in large type with a romaji line ·
toggles `Show Furigana` · `Translation` · **`Slow Playback`** · a waveform player with `0.75× / 1× /
1.25×` · a large **`Tap to Speak`** mic · **`REFERENCE`** and **`YOUR VOICE`** waveforms side by side ·
`Analyze Pronunciation` + `↻ Try Again` · sentence pager `‹ Previous · 3/18 · Next ›`.

Rail: `TODAY'S SESSION` · **`TODAY'S IMPROVEMENT`** (Yesterday 86 → Today **92 (+6)**) · a score ring
**92 Excellent** over five bars (Accuracy 96 · Rhythm 91 · **Pitch Accent 89** · Fluency 94 ·
Confidence 93) · `AI Sensei Feedback` · **`Word Analysis`** — per-word chips こんにちは✓ 今日は✓ いい✓
**天気⚠** ですね✓ — expanding into a `Pitch focus` card that **draws the Expected and Yours pitch
contours** with `Play Native` / `Play Yours` / `Practice Again` · `COMMON MISTAKE` · `AI TIP`.

**⭐⭐⭐ This is CLAUDE.md §5 differentiator #1 drawn in full**: F0 contour extracted from the learner's
recording, overlaid against a reference, scored, and localised **to the failing word**. The inventory
has now met pitch accent in **four independent surfaces** (`120:2027` in-lesson, its trend report,
`44:7289` per-utterance, and here as both a score and a whole `Practice by Goal` track). **It is a core
capability, not a feature of one module.**

**§2 note, not a violation:** `REFERENCE` must be **TTS of the sentence text**, per the project's
standing rule that pitch reference is synthesised and never extracted from source media. Nothing here
contradicts that — recorded so a later implementer does not reach for video audio.

### 16.3 ⚠️ Rule-4 finding: **"goal" means two different things**

`F-016-goal-based-learning-paths.md` defines a **goal** as a life-domain chosen at onboarding —
*Anime · JLPT · Business · Travel* — which then tags content and biases recommendations.

Figma splits that idea across **two different shelves**:
- **`Popular Learning Paths`** = Everyday Conversation / **Business Japanese** / IT Engineer /
  **Travel in Japan** → these are F-016's domain goals.
- **`Practice by Goal`** = **Improve Pitch Accent / Improve Fluency / Native Rhythm** → these are
  **skill** targets, a different axis entirely.

**Neither side is wrong; the word is overloaded.** Record as a `design clarification` per rule 4 —
and note it feeds §13.3's missing skill taxonomy, because *Improve Pitch Accent* is a skill goal whose
name must come from that same taxonomy.

---

## 17. Cluster: Grammar — 1 frame, analysed 2026-08-12

### 17.1 `284:1464` — **Sentence Analysis** · `CONFIRMED` screen — and it is **not** a grammar list

**⭐⭐ This resolves an open question from §5**, which asked whether *"Grammar analysis is a new feature,
deliberately unbuilt, and the existing `/grammar` list is enough."* **The picture says the two are not
comparable.** `/grammar` is a **catalogue of grammar points** (measured: `app/[locale]/(protected)/
(app)/grammar/page.tsx` exists and is real, not a placeholder). This frame is a **sentence parser**.

The nav names it as its own row — `Sentence Analysis` — and the screen works like this: paste **or
speak** any Japanese sentence → `Analyze` → and it returns

- **`SENTENCE`** re-rendered with furigana and colour-coded, underlined segments;
- **`MEANING`** — a literal reading plus a natural translation;
- **`STRUCTURE`** — the sentence as labelled roles: 先生に *recipient* → 日本語を *object* →
  教えていただきました *main predicate*, with `Deeper structure →`;
- **`DETAILED ANALYSIS`** — every token with part of speech, reading and gloss;
- **`KEY GRAMMAR`** — the point (〜ていただく `N3`), its meaning, its **form** (`Vて + いただく`), the
  instance in this sentence, and `View grammar →` **into the existing catalogue**;
- **`KEY VOCABULARY`** with audio;
- rail: `ANALYSIS SUMMARY` · **`SELECTED COMPONENT`** (click a token, inspect it) · **`WHAT TO NOTICE`**
  (*"The person marked with に performs the favor. The speaker stays humble by receiving it."*).

Footer actions: `Replay Pronunciation` · **`Add to Vocabulary`** · `Practice Sentence` ·
*"Still unclear? Ask Companion →"* · `Practice This Sentence →`.

**⭐ Rule-4 clarification, and a clean one.** `screen-shadowing-practice.md`'s Two-Layer Model already
names **Analysis** — *"a per-sentence utility (highlight → Analyze), not a mode at any layer"*. Figma
does not contradict that; it shows the **same utility also existing as a standalone destination** with
free-text and voice input and its own nav row. **Utility inside a lesson, screen outside one.** Record
as an extension, not a conflict.

**⭐ Two loop connections:** the rail's **`LEARNING MEMORY`** card writes back — *"You often confuse
〜てもらう and 〜ていただく. Korume will keep this in mind for future lessons."* — which is the Learning
Intelligence loop arriving from a **fifth** direction; and **`Add to Vocabulary`** puts the
mining/collection family in a **sixth** surface.

### 17.2 Verdict — Pronunciation + Grammar

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `37:4955` | Pronunciation Studio (library) | screen | ❌ none | unbuilt; borrows content from Certification and Shadowing |
| `36:4117` | Pronunciation Studio (practice) | screen | ❌ none; `/api/pronunciation/score` ✅ | pitch-contour comparison and word-level analysis unbuilt |
| `284:1464` | Sentence Analysis | screen | ❌ none; `/grammar` is a different thing | a parser, not a list |

**Capabilities added:** pronunciation **courses and learning paths** · practice by **situation** ·
practice by **skill goal** · **pitch-accent training as a first-class track** · per-sentence practice
with reference-vs-user waveform comparison · **word-level pronunciation scoring** · **expected-vs-actual
pitch contour rendering** · slow playback and speed control · daily improvement deltas · common-mistake
notes · **free-text and voice sentence analysis** · role-labelled sentence structure · token-level
part-of-speech breakdown · grammar-point extraction linking into the catalogue · *what to notice*
pragmatic explanation · analysis writing back into Companion memory.

---

## 18. Cluster: Account — 4 frames, analysed 2026-08-12

**Rule 3:** `docs/design/patterns/settings-patterns.md` is substantial layer-A authority — Philosophy,
*Personalization Over Configuration*, *Instant Feedback*, *Contextual Settings*, *Progressive
Disclosure*, plus specified sections for Learning Environment, Study Atmosphere, **Reading Settings
(Typography / Furigana / Translation / Translation Language)** and **Playback (Speed / Auto Pause /
Loop)**.

**Repo, measured:** `/login` ✅ `(auth)` · `/profile` ✅ `(app)` · `/settings` ✅ `(app)`. No
edit-profile route.

### 18.1 `65:2` — **Login** · `CONFIRMED` screen

Split layout: a cinematic left panel (`STORIES, SCENES, VOICES` · *"Learn Japanese through stories
worth remembering."* · a quote captioned `RAIN, LATE EVENING · TOKYO`) beside the form card —
**`Continue with Google` · `Continue with Apple` · `Continue with GitHub`**, an OR divider, email +
password with a reveal toggle and `Forgot password?`, `Continue →`, `Create one`, and the
Terms/Privacy line.

**⚠️ Three OAuth providers.** CLAUDE.md §3 specifies *email + Google OAuth*. **Apple and GitHub are new
scope** — each is a real integration with its own review requirements (Apple in particular). Product
question, not a defect.

### 18.2 `66:166` — **Profile / "Your learning identity"** · `CONFIRMED` screen

`PERSONAL ARCHIVE` · avatar with an upload badge · display name + handle · then an identity block:
**Country `Vietnam` · Timezone `UTC+7` · Learning Japanese since `March 2026` · JLPT Goal `N2` ·
Native Language `Vietnamese` · Current Interface `English` · Current Subtitle `Japanese + Furigana`** ·
`Edit Profile`.

`QUICK STATS` (Study Streak · Current Level **`N5 · Explorer`** · Total XP · **Movies Completed** ·
Words Learned · Hours Studied) · **`LEARNING JOURNEY — "The road you have made"`**, a milestone
timeline with a written line each (*"Your Name, watched without giving up."*) ·
`FAVORITE LEARNING CONTENT` chips · **`PERSONAL GOAL`** — *"I want to speak naturally during my future
trip to Japan."* · rail: `COMPANION — Companionship` (*"We've been walking together for 6 months."*),
**`TODAY'S MEMORY`** (a line practised until it felt like the learner's own) and `ACHIEVEMENTS`.

**⭐⭐ Three independent language settings, and they are not the same field:**
`Native Language` (L1) · `Current Interface` (UI locale) · `Current Subtitle` (rendering mode).
The repo's i18n handles the middle one. **L1 is a product concept** — it is what makes the Companion's
*"without thinking in Vietnamese"* (§13.4) possible — and it has no home in the schema.

**⚠️ "Goal" now has a third meaning** (after §16.3's two): `JLPT Goal N2` is a **target level**, and
`PERSONAL GOAL` is a **written intention**. With F-016's domain goals and Figma's skill goals, the word
carries four senses across the product.

### 18.3 `67:595` — **Edit Profile / "Shape your learning identity"** · `CONFIRMED` screen

A **live-preview** editor: the left column renders the profile as it will look (including
`CURRENT COMPANION` and `RELATIONSHIP — "We've been walking together for 6 months."*`) while the right
column edits.

- **Basic Information** — display name · username · bio · country · timezone · **native language** ·
  **target JLPT** · **preferred study time** · **daily goal** · **learning goal** (free text).
- **Learning Preferences** — interface language · **subtitle style** · **`Default Furigana: Always on`**
  · **`Preferred Practice`** chips (Conversation · Shadowing · Vocabulary · Grammar · Listening).
- **Privacy** — **`Profile Visibility: Private / Friends / Public`** · **`Journal Visibility`**
  (*"Let friends see moments you choose to share."*) · Show achievements · **Show companion** ·
  Receive weekly report email · Receive learning reminders.
- Footer `Cancel` / `Save`, with the Companion saying *"I'll remember these changes."*

**⚠️⚠️ `Friends` implies a social graph that does not exist.** Measured: no friend/follow concept in any
migration. The repo has community surfaces (forum, public playlists, leaderboard opt-in) but **no
friendship edge**. `Profile Visibility` and `Journal Visibility` both depend on one.

**⚠️ `Default Furigana: Always on` needs checking against CLAUDE.md §5 #4**, which requires **adaptive**
furigana — shown only for words the learner has not mastered, fading as they learn, and explicitly
*"not a hard on/off toggle"*. The control here is a select whose other values are not visible, so this
is **not yet a conflict**: if `Adaptive` is one of the options the two are compatible.
`settings-patterns.md` has its own § Furigana — **reconcile all three before building this control.**

### 18.4 `220:16032` — **Settings** · `CONFIRMED` screen (1167×3762, read in three bands)

`PERSONAL SPACE` · *"A quiet place to make Korume feel more like yours."* Five sections:

| Section | Contents |
|---|---|
| **Learning** | Interface Language · Daily Learning Goal · Study Reminder Time · Learning Schedule (`Every Day / Weekdays / Custom`) · **Review Frequency** (`Normal / More Reviews / Relaxed`) · **Difficulty Preference** (`Adaptive / Easy / Challenge Me`) |
| **Learning Reminders** | Daily · Review · Streak · Weekly Reflection · **`Sensei Generation Finished`** — *"When a new study companion is ready."* |
| **Appearance** | **Theme `Dark / System / Light`** · **Accent Color `Warm Orange`** · Display Scale (`Normal / Large / Extra Large`) · **Reduced Motion** |
| **Privacy & Data** | Microphone Permission · **Camera Permission** · **AI Training** (*"Help improve Korume using your learning patterns."*) · **Export Data** · **Download Learning History** |
| **Danger Zone** | **Delete Companion Memory** · **Delete Account** |
| **About** | Version · **Discord · Facebook · TikTok** · Privacy Policy · Terms of Service · Send Feedback |

Closing: `COMPANION SUPPORT — "Need a hand?"` with `Talk with Companion` / `Contact Support`, and a
footer reading *"Built quietly in Vietnam. Crafted for lifelong learners."*

**⭐⭐⭐ `Delete Companion Memory` is a genuine design contribution to a §2 debt.** Its copy:

> *"Erase everything Korume has remembered about your learning journey. **Learning progress remains.**
> Companion memories, diary entries, reflections, observations, conversation memories, recommendations
> and personal learning history will be permanently removed."*

CLAUDE.md §2 rule 2 requires a full *"delete all my data"* — owed since L1 and still unbuilt (measured:
nothing matching `delete-account|gdpr|erase` exists). The design supplies a **two-tier** model: erase
what the Companion *remembers* while keeping what the learner *achieved*, as a separate operation from
closing the account. **That is finer than the non-negotiable requires and worth keeping** — the
non-negotiable is still satisfied by `Delete Account`.

**⭐ `AI Training` is the §2 rule-2 consent toggle**, made explicit: *"never used to train models
without explicit consent."* Here is the consent. Note it is drawn **off by default**.

**⭐ `Reduced Motion` is the CLAUDE.md §2 rule-4 global toggle**, present as designed.

**⚠️ Three settings contradict shipped decisions and need rulings:**
1. **`Theme: Dark / System / Light`** — the repo is **dark-only** since `86328bc`; `lib/design-tokens.test.ts` asserts no `[data-theme]` block exists. The mechanism was deliberately retained so light returns as one added block, so this is *restorable*, not blocked — but it is a decision to re-open, not a build task.
2. **`Accent Color: Warm Orange`** as a *choice* — the token system ships **one** ember accent. A user-selectable accent means theming the semantic tier.
3. **`Camera Permission`** — no camera capability exists anywhere else in the inventory or the repo. What is it for?

### 18.5 Cluster verdict

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `65:2` | Login | screen | `/login` ✅ | built; Apple + GitHub OAuth are new scope |
| `66:166` | Profile | screen | `/profile` ✅ | built far simpler; L1, journey timeline, personal goal absent |
| `67:595` | Edit Profile | screen | ❌ none | live-preview editor; **Friends visibility needs a social graph** |
| `220:16032` | Settings | screen | `/settings` ✅ | built far simpler; **two-tier deletion** and **AI-training consent** are the valuable parts |

**Capabilities added:** third-party sign-in (**Google / Apple / GitHub**) · **native language as a
profile field** · target JLPT level · preferred study time · a **written personal goal** · a milestone
**learning-journey timeline** · favourite content types · achievements · **live-preview profile
editing** · **profile & journal visibility with a Friends tier** · preferred-practice selection ·
learning schedule / review frequency / difficulty preference · reminder channels incl. **companion-
generation notification** · theme, accent and display-scale choice · **reduced motion** ·
microphone / camera permissions · **AI-training consent** · **data export and learning-history
download** · **two-tier deletion (companion memory vs account)** · community links · in-app support
routed **through the Companion**.

---

## 19. Clusters: Marketing + global states — 8 frames, analysed 2026-08-12 (Phase 0 complete)

### 19.0 ⚠️ Two frames are filed in the wrong cluster, and one of them changes the map

**`111:515` is named `Homepage`. It is the authenticated Dashboard.** The picture shows the app nav,
`TUESDAY · LATE EVENING`, a streak chip and an avatar — this is **"Welcome back"**, not a landing page.
**Fourth time the picture has corrected a frame name.**

**Consequence: there is NO marketing landing frame anywhere in the 57.** Part I mapped
`Homepage → / → built`; that mapping is wrong on both ends. The public front door of Korume is
**undesigned**, while `/` in the repo renders a marketing page nothing in Figma describes.

**`111:1556 QuickStart` belongs to onboarding, not marketing.** It is explicitly **`Step 2 of 5`** and
sits in the same flow as `220:16766`, `111:1877` and `111:1963` (§14).

### 19.1 `111:515` — **Dashboard** · `CONFIRMED` screen *(rename the frame)*

`CONTINUE LEARNING` (lesson, %, minutes remaining, tags) · **`TODAY'S MISSION — "Three small
promises"`** (three checkable targets with counters and a reward of **`+120 XP · +1 Journey Point`**) ·
`AI SENSEI` coaching line · **`LEARNING JOURNEY`** (N5 Completed → N4 82% → N3 Locked, with the next
milestone named) · **`WEAKNESS SNAPSHOT`** · `WEEKLY EVOLUTION` · `LEARNING ACTIVITY` heatmap ·
`RECENT ACHIEVEMENT` · `QUICK ACCESS` (Review · Mining · Vocabulary · Roadmap · Conversation · Lesson
Library).

- ⭐ **`Journey Point` is a second currency** beside XP, and it appears nowhere else.
- ⚠️ **A third skill taxonomy.** `WEAKNESS SNAPSHOT` measures **Listening · Grammar · Pitch Accent** —
  different again from §13.3's two sets. **Three frames, three taxonomies.**

### 19.2 `74:564` — **Pricing** · `CONFIRMED` screen

Pre-rebrand throughout (`JapanWeb+`). Two tiers plus three billing shapes:

- **FREE — `ALWAYS FREE`**: Reading · Shadowing · Pronunciation Practice · Dictation · Vocabulary
  Mining · Review Center · Progress Dashboard · Export Your Data · **Adaptive Furigana** ·
  Kanji & Grammar Support · **Personal Lesson Creation · 3 lessons/month** · Public Lesson Library.
- **Plus — `REMEMBER MORE`**: AI Sensei Companion · Personalized Roadmap · Weekly AI Report · Deep AI
  Breakdown · **Unlimited Lesson Creation** · Full Lesson Library · **AI Transcript Generation** ·
  **Full JLPT Mock Exams** · Native Pronunciation Analysis · AI Conversation Partner · **Long-term
  Learning Memory** · **Weakness Coaching** · Intelligent Review Planning.
- Billing: Monthly **49.000đ** · Annual **490.000đ** (*Save 2 Months*) · **Founding Member
  39.000đ/month** with a `Founder's Badge` and *"Price locked forever while subscribed"*.
- Positioning: **"We don't sell AI."** — *"Your notes are always yours. Your progress is always
  yours."* Closing: *"You can continue learning for free forever."*

**⭐ Three confirmations the rest of the inventory needed:**
1. **`Adaptive Furigana` is named as such, and it is FREE** — which settles the §18.3 worry in the
   right direction: the product does mean CLAUDE.md §5 #4's adaptive behaviour, not an on/off toggle.
2. **`Personal Lesson Creation · 3 lessons/month`** matches the measured `createLesson()` quota exactly
   (§7.1), and **`Unlimited Lesson Creation`** is what the paid tier buys.
3. **`AI Transcript Generation` is a paid feature** — i.e. the deliberately-stubbed
   `aiTranscriptProvider` (§7.0) is *monetised*, which raises the stakes on the deferred STT question.

**Founding-member price-lock matches the L8 plan** already recorded in the roadmap.

### 19.3 `209:14032` — **Checkout** · `CONFIRMED` screen

Post-rebrand (`Become Korume+`). Three membership cards → payment method → card fields → an order
summary with `Renews August 2027` and the included list, `Become Korume+`, and a Companion line
*"I've been waiting. Let's remember the rest of your journey together."*

**⚠️⚠️ Layer-B ↔ layer-D conflict, and it is a decided-stack conflict.** The footer reads **"Secure
payments powered by Stripe"** and the methods are **Visa · Mastercard · Apple Pay · Google Pay ·
PayPal**. CLAUDE.md §3 states payments are **PayOS** — *"Stripe/7-day-trial superseded"*. **None of the
five drawn methods is PayOS**, and PayOS's actual flow (Vietnamese bank transfer / QR) is not drawn at
all.

**Per rule 1 this is recorded, not fixed** — but unlike a stale label this one contradicts a *decided*
stack choice, so it needs a ruling before L8, exactly like the `Theme` and `Accent Color` items in
§18.4. ✅ **One thing the design gets right:** there is **no free-trial anywhere**, matching the
no-trial decision.

### 19.4 `75:1424` — **FAQ** · `CONFIRMED` screen (in-app, not marketing)

`JAPANWEB+ HANDBOOK` · a search field · six topic cards (Learning · AI Sensei · Plus · Account ·
Billing · Privacy) · a 10-question accordion · a rail of three principles · `Contact Support` /
`Documentation`.

**⭐⭐⭐ The §2 non-negotiable appears as a public FAQ answer:** *"Why doesn't JapanWeb+ host YouTube
videos?"* The constraint is presented to learners as a **product explanation**, not hidden as an
engineering rule. That is layer D surfacing into layer B in the healthy direction.

**⭐⭐ `KNOWLEDGE ECONOMY`** — *"Every AI explanation generated becomes reusable knowledge for future
learners."* This is `business-model.md`'s Knowledge-Gen concept rendered, and it is the economic
argument behind the per-user Knowledge-Gen quota the roadmap requires **before AI is enabled**.
**`YOUR DATA`** states the ownership stance plainly: *"We never lock your learning data. Premium
unlocks intelligence, not ownership."*

### 19.5 `203:13813` — **Footer** · **component**, not a screen — plus a closing hero

Above the footer sits a closing statement (*"A quieter way to keep going."*). The footer itself:
brand · **EXPLORE** (Home · Pricing · FAQ · **Blog** · Roadmap · **About** · **Careers** · **Contact**)
· **COMMUNITY** (Discord · Facebook · TikTok) · **SUPPORT** (`admin@almostgone.vn` ✅ matches the deploy
target) · **LEGAL** · and **`CONTINUE LEARNING ANYWHERE`** with **App Store and Google Play badges** and
a **newsletter email capture**.

**⚠️ Two scope claims hide in a footer:** **native mobile apps** (Korume is a Next.js web app — nothing
else in the inventory or the repo implies iOS/Android), and **four unbuilt marketing pages** —
`Blog`, `About`, `Careers`, `Contact` — none of which has a frame.

### 19.6 `210:14338` + `218:15740` — **Loading states** and **Error states** · **NOT screens**

Both are **pattern catalogues**, laid out as design-system pages:

| Frame | Title | Contents |
|---|---|---|
| `210:14338` | *"Loading states, quietly at work."* | 8 patterns — global · **AI generation** · lesson · **companion thinking** · **payment processing** · success transition · dashboard skeleton · library skeleton — plus a **`LOADING LANGUAGE`** rule: *"Never technical. Never urgent. Always companion-led."* |
| `218:15740` | *"Error states, gently handled."* | 8 patterns — connection · **companion unavailable** · lesson gone · video failed · **access/paywall** · 404 · dashboard partial-failure · library partial-failure — plus an **`ERROR LANGUAGE`** rule: *"Never blaming. Never alarming. Always companion-led."* |

**⭐⭐ This settles the open question carried since §2 of Part I.** The proposed rule was: *a state of one
named screen → registry; a state any screen can enter → `/admin/style-guide`*. These two frames are
unambiguously the second kind — they are **not states of a screen at all**, they are the **system's
state vocabulary**. **They belong in the style guide and must not become registry entries or routes.**

Three details worth carrying: `02 / COMPANION` (*"Sensei is taking a short break. The AI isn't
responding right now. Everything else is still here."*) is exactly the **honest AI-degrade** the repo
already implements as 503 paths; `05 / ACCESS` is a **paywall state** (L8); and both catalogues insist
every message be **companion-led**, which makes error and loading copy a Companion surface — and
therefore subject to §14.1's companion-less fallback requirement.

### 19.7 Verdict

| Node id | Name | Kind | Route | Verdict |
|---|---|---|---|---|
| `111:515` | *"Homepage"* → **Dashboard** | screen | `/dashboard` | **misnamed frame**; `Journey Point` and a third skill taxonomy |
| `74:564` | Pricing | screen | ❌ none (L8) | the business model, rendered |
| `209:14032` | Checkout | screen | ❌ none (L8) | **Stripe vs the PayOS decision** needs a ruling |
| `75:1424` | FAQ | screen | ❌ none | §2 as a public answer; Knowledge Economy |
| `111:1556` | QuickStart | screen (**onboarding**, step 2 of 5) | ❌ none | feeds roadmap generation |
| `203:13813` | Footer | **component** | — | excluded from the registry; hides two scope claims |
| `210:14338` | Loading states | **style-guide catalogue** | — | not a screen |
| `218:15740` | Error states | **style-guide catalogue** | — | not a screen |

**⚑ Handed upward:** **no marketing landing page exists in the design** · **Stripe vs PayOS** ·
**mobile apps in the footer** · four unbuilt marketing pages · a **third** skill taxonomy ·
`Journey Point` as a second currency.
