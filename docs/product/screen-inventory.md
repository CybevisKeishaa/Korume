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
