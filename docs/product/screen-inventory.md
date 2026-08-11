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
| Companion home | `companion-home` | ❓ `/dashboard`? | built? ❓ |
| Companion Diary | `companion-diary` | `/journal` | built |
| Companion Knowledge Assistant | `companion-knowledge-assistant` | ❓ `/sensei`? | **placeholder** |
| Learning memory | `learning-memory` | — | none ❓ |
| Conversation memory | `conversation-memory` | — | none ❓ |
| Growth Areas | `growth-areas` | — | none ❓ |
| Roadmap | `roadmap` | `/roadmap` | built |
| Roadmap detail | `roadmap-detail` | — | none |

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
| Today's reflection (panel, fade around) | `companion-home` ❓ |
| Gentle suggestion drawer | `companion-home` ❓ |
| Popup create conversation | `conversation-practice` |
| Quick preview: Conversation practice | `conversation-practice` ❓ |
| Generate sensei | `companion-knowledge-assistant` ❓ |
| Generate done | `companion-knowledge-assistant` ❓ |
| Panel | ❓ **unidentifiable from the name — needs the user** |

### ⚠️ `Loading state` and `Error state` break R11 as written

`T4` requires every `state-variant` to carry a `variantOf` naming an existing `kind: 'screen'`.
`Empty state (Companion home)` names its parent and is fine. **`Loading state` and `Error state` do
not** — they read as *global* design-system states belonging to no single screen.

Three ways out, and this is a **spec-level call, not an implementation detail**:
1. They are design-system documentation, not product screens → **excluded from the registry**.
2. `variantOf` becomes nullable for global states → **amends R11/T4**.
3. They are arbitrarily parented to one screen → dishonest, records something false.

Recommendation: **option 1**. They document a shared component's states, which is exactly the kind of
thing R1 says the repo owns. No spec amendment needed.

---

## 3. Repo routes with no frame in this pass (`kind: 'repo-only'`, R6/R13)

`repoOnlyReason: 'legacy-unreviewed'` unless noted.

**Already adjudicated by the user 2026-08-11** (see `mem:screen_registry_inputs`) — hide in Phase 2,
keep the code, do not build further: `/reading`, `/reading/[id]`, `/leaderboard`, `/community`,
`/community/[id]`, `/community/peer-review`.

**Not yet adjudicated:**

| Route | Note |
|---|---|
| `/register` | Figma has `Login` but no register frame |
| `/dashboard` | real screen (`LevelCard`/`StreakCard`/`SrsDueCard`/`BadgesGrid`/`RecommendationSection`) — is `Companion home` this, or a separate screen? |
| `/vocab`, `/vocab/[id]`, `/vocab/review` | **see §4** |
| `/review` | the cross-type SRS review hub |
| `/grammar` | the grammar list (vs `Grammar analysis`, §1) |
| `/mining`, `/mining/review` | sentence mining |
| `/playlists`, `/playlists/[id]` | IA question still open |
| `/achievements`, `/challenges`, `/statistics` | gamification surfaces |
| `/weekly-report` | placeholder; possibly `Growth Areas` |
| `/sensei` | placeholder; possibly `Companion Knowledge Assistant` |
| `/jlpt-test` | dead `redirect()` to `/jlpt`; `deprecated` or out of scope per §3.3 |
| `/admin/*` (5 routes) | `repoOnlyReason: 'out-of-design-scope'` — the only value R13 allows, and only because `chrome: 'admin'` |

---

## 4. ⚠️ The finding that matters most: **Vocab has no design**

`/vocab`, `/vocab/[id]` and `/vocab/review` are built and are a core module in CLAUDE.md §4, and
**not one frame in this pass covers them.** Kanji has three frames; Grammar has one; Vocab has zero.

This is the payoff of working Figma-first: one pass over the confirmed list surfaces a real hole in
the design in a way that route-string matching never did. It is a **finding, not new scope** — the
ruling (design it, fold it into Kanji, or drop it) is the user's.

Same shape, lower stakes: `/review`, `/achievements`, `/challenges`, `/statistics` and `/register`.

---

## 5. Open questions for the user

1. **Vocab** — design it, merge into the Kanji module, or drop it? (§4)
2. **`Grammar analysis`** — is it a detail screen for a grammar point (no route today), and does the
   `/grammar` list have a frame at all? (§1)
3. **`Companion home` vs `/dashboard`** — one screen or two?
4. **`Companion Knowledge Assistant` → `/sensei`, `Growth Areas` → `/weekly-report`?** Both routes
   are placeholders today, so this is a mapping question, not an implementation one.
5. **`Panel`** — which screen is it a state of?
6. **`Learning memory` / `Conversation memory`** — separate screens, or panels inside
   `companion-home`?
7. **`Loading state` / `Error state`** — confirm option 1 in §2 (exclude from the registry).
8. **`Pronunciation (in shadowing)`** — a state of `shadowing-practice`, or its own route?
9. **`/playlists`** — own screen, or a tab inside Explore? (carried over)
