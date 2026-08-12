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
