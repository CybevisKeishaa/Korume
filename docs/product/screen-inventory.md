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

`repoOnlyReason: 'legacy-unreviewed'` unless noted.

**Already adjudicated by the user 2026-08-11** (see `mem:screen_registry_inputs`) — hide in Phase 2,
keep the code, do not build further: `/reading`, `/reading/[id]`, `/leaderboard`, `/community`,
`/community/[id]`, `/community/peer-review`, and **`/vocab`, `/vocab/[id]`, `/vocab/review`**
("không cần vocab nữa, hoặc ẩn nó đi, có thể sau sẽ dùng" — explicitly reversible). **But see the
conflict in §4 before acting on the vocab half.**

**Not yet adjudicated:**

| Route | Note |
|---|---|
| `/register` | Figma has `Login` but no register frame |
| `/dashboard` | real screen (`LevelCard`/`StreakCard`/`SrsDueCard`/`BadgesGrid`/`RecommendationSection`). Confirmed **separate** from `Companion home` (§1) and still frameless |
| `/review` | the cross-type SRS review hub |
| `/grammar` | the grammar list. `Grammar analysis` is a **new, deliberately unbuilt** feature (§1), so this list stays frameless |
| `/mining`, `/mining/review` | sentence mining |
| `/playlists`, `/playlists/[id]` | IA question still open |
| `/achievements`, `/challenges`, `/statistics` | gamification surfaces |
| `/weekly-report` | placeholder; possibly `Growth Areas` |
| `/sensei` | placeholder; possibly `Companion Knowledge Assistant` |
| `/jlpt-test` | dead `redirect()` to `/jlpt`; `deprecated` or out of scope per §3.3 |
| `/admin/*` (5 routes) | `repoOnlyReason: 'out-of-design-scope'` — the only value R13 allows, and only because `chrome: 'admin'` |

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
1. **§4's vocab conflict** — does the `PERSONAL VOCABULARY SHELF` read from the `/vocab` module, or
   is it companion-owned data? Decides whether hiding `/vocab` is free or breaks a flagship panel.
2. **Confirm the `Grammar analysis` reading**: "it's a new feature, we don't need to build it, the
   existing grammar module is enough" — is that right?
3. **`Loading state` / `Error state`** — the §2 rule, which the user asked to discuss further.
4. **`Companion Knowledge Assistant` → `/sensei`? `Growth Areas` → `/weekly-report`?** Both routes
   are placeholders today, so this is mapping, not implementation.
5. **`Panel`** — which screen is it a state of? Unidentifiable from the name alone.
6. **`Pronunciation (in shadowing)`** — a state of `shadowing-practice`, or its own route?
7. **`/playlists`** — own screen, or a tab inside Explore? (carried over)
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

**Two consequences that bind the rest of this inventory:**
1. **Do not "fix" a Figma frame against the current implementation.** The repo is layer C; it has no
   authority over layers A and B. The purpose of this pass is to see how large Korume was *designed*
   to be — letting today's code narrow that is the single biggest failure mode available here.
2. **Do not promote something to a new capability just because Figma gave it its own word.** Check
   first whether it belongs to a family that already exists (see `Favorites` → the mining family,
   §7.2).

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
