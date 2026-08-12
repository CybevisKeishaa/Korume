# Figma frame map — name → node id

**File:** `IwFHZDZdHW7qsSFiNbWrkd` ("Korume"), single page `0:1`.
**Captured:** 2026-08-11, by selecting frames in the Figma desktop app and reading the
`Currently selected nodes` block that `get_metadata` prepends to its response.

**Why this file exists:** `get_metadata` on the page itself returns ~4.4M characters, so every Figma
call has to target a specific frame — and nothing in the repo held a complete name→id map. Scattered
ids lived in three specs; this replaces that. Node ids are stable in Figma unless a frame is
recreated, so this map decays slowly, but it is a snapshot: re-capture if frames are rebuilt.

⚠️ **`get_metadata` prints at most 16 selected nodes**, then `[... N more]`. A full capture therefore
takes several selections of ≤15. **One Ctrl+A selected 57 frames.**

## ✅ Captured — all 57 of 57

| Node id | Frame name |
|---|---|
| `28:2041` | Kanji inspect |
| `29:2890` | Kanji library ⚠️ see duplicate note |
| `36:4117` | Pronunciation detail |
| `37:4955` | Pronunciation library |
| `44:7289` | Conversation pratice *(sic — typo in the frame name)* |
| `46:2` | Popup create conversation |
| `64:2061` | Roadmap |
| `65:2` | Login |
| `66:166` | Profile |
| `67:595` | Edit profile |
| `74:564` | Pricing |
| `75:1424` | FAQ |
| `90:1985` | Shadowing Hub ⚠️ **superseded — dead frame, build against `149:2`** |
| `105:3088` | Shadowing Practice |
| `111:515` | Homepage |
| `111:1556` | QuickStart |
| `111:1877` | Generate sensei |
| `111:1963` | Generate done |
| `120:2027` | Pronunciation (in shadowing) |
| `123:2835` | Dictation (in shadowing) |
| `125:1030` | Summary (in shadowing) |
| `149:2` | **Shadowing hub after changes** — the live hub; the calibration frame the shell tokens were measured from (`app/globals.css:136`) |
| `156:1310` | Companion home after change |
| `170:9364` | Conversation practice library |
| `180:2` | Roadmap detail |
| `180:1129` | **Panel Quick preview: Conversation practice** — see note below |
| `180:1770` | Learning memory |
| `181:3525` | Gentle suggestion drawer |
| `182:3859` | Today's reflection (panel, fade around) |
| `184:3974` | Conversation memorry *(sic — typo in the frame name)* |
| `187:6556` | Growth Areas |
| `190:7376` | Companion Diary |
| `200:7705` | Explore Lessons |
| `200:10726` | Explore Lessons (with preview) |
| `203:13813` | Footer |
| `209:14032` | Checkout |
| `210:14338` | Loading state |
| `212:14610` | Search lesson |
| `212:14753` | Search lesson (searched) |
| `215:15164` | Companion Knowledge Assistant |
| `216:15648` | Empty state (Companion home) |
| `218:15740` | Error state |
| `220:16032` | Global setting |
| `220:16766` | Welcome Companion page |
| `232:2` | JLPT Practice |
| `234:618` | JLPT Phase test |
| `234:1639` | To phase 2 — the **`Begin Listening` gate** (rename pending, see below) |
| `234:1667` | To phase 2 — the **countdown** (rename pending, see below) |
| `237:1690` | JLPT practice (phase 1) |
| `237:6708` | Finish phase 1 |
| `240:12992` | JLPT practice (phase 2) |
| `242:14234` | Practice result |
| `243:14899` | Review mistake (after JLPT practice) |
| `243:15364` | Review mistake (more detail) |
| `280:3` | Kanji library (choose lesson, choose book mimikara,...) ⚠️ see duplicate note |
| `280:1314` | Kanji lesson practice( flashcard) |
| `284:1464` | Grammar analysis |

### ⚠️ Two real duplicate pairs, confirmed by node id

These were suspected from the frame-name list and are now **proven to be distinct frames**, not
typing slips:

1. ✅ **`234:1639` and `234:1667` — RESOLVED 2026-08-12. Two sequential steps, not a duplicate.**
   The user confirmed the pair is *"màn hình chuyển của phần JLPT practice"* (the JLPT practice
   transition), and screenshots separate them cleanly — both 1536×682:

   | | `234:1639` **the gate** | `234:1667` **the countdown** |
   |---|---|---|
   | Eyebrow | `PHASE 2` | `CERTIFICATION PRACTICE` |
   | Headline | **Listening Section** | **Please prepare your headphones.** |
   | Body | "The listening section will begin automatically. Please prepare your headphones. Drink some water if needed." | "The listening audio will begin automatically." |
   | Figure | framed illustration | large orange numeral (captured at **1**) |
   | Action | **`Begin Listening` button** — waits for a click | none — auto-advances |

   Flow: `Finish phase 1` (`237:6708`) → gate → countdown → `JLPT practice (phase 2)` (`240:12992`).
   Both are `state-variant`s of the JLPT practice flow; the countdown frame is one tick of an
   animated 3→2→1, so it is a single frame standing for a sequence.
2. **`29:2890` vs `280:3` — NOT a duplicate. Two different screens.** Checked visually 2026-08-11,
   and the "newer iteration supersedes older" guess was **wrong**:

   | | `29:2890` **Kanji Explorer** (1278px) | `280:3` **Kanji Library** (1536px) |
   |---|---|---|
   | Framing | *"Learn kanji through real-world contexts instead of memorizing isolated characters"* | *"Choose your study material"* |
   | Spine | Featured collection → Curated Paths (SushiMaster, Tokyo Café, Shinkansen Journey, Konbini Life) → Browse by JLPT → **Browse by radical** → Recently viewed | Choose JLPT level → Current path (N3, Continue Learning) → **Choose study material** (Core Kanji / Kanji in Context / Reading Kanji / My Weak Kanji, incl. book sources like Mimikara) → ordered numbered lesson list with Complete/Review status |
   | Right rail | Learning dashboard 74%, heatmap, recommended, quick actions | Learner progress, streak, kanji you're revisiting |
   | Mode | **Discovery / exploratory** | **Structured curriculum** |

   So the question is not "which is newer" but **"does Korume want both a discovery surface and a
   curriculum surface for kanji, or did the curriculum design replace the exploratory one?"**
   That is a product ruling, not an inventory call. **Escalate to the user.**

   Capability side-findings from `29:2890` that no repo route covers: **browse kanji by radical**, and
   **curated thematic collections**. Both are real capabilities, not decoration.

**Method note worth keeping:** name-matching said "duplicate", canvas width said "newer iteration",
and the screenshot said "two different products". Only the picture was right.

### ✅ `Panel` is not a frame — resolved by capture, no ruling needed

The frame-name list read `Panel` and `Quick preview: Conversation practice` as two separate entries,
and `Panel` was logged as an open question ("which screen is it a state of?"). There is **one frame**:
`180:1129`, named **`Panel Quick preview: Conversation practice`**. The list had simply split one name
across two lines. It is a quick-preview panel of Conversation practice — a `state-variant`, parent
confirmed by the name itself.

## Dead / stale ids from earlier sessions

| Node id | Frame name | Note |
|---|---|---|
| `5:1718` | Unuse | dead frame — **and no longer on the page**, see the arithmetic below |
| `71:2` | Pricing-remove | dead frame — same |
| `243:14906` | *(unidentified)* | recorded in a spec, never matched to a name |

`105:3088` and `200:10726` were both unidentified spec ids; this capture resolved them as
`Shadowing Practice` and `Explore Lessons (with preview)`.

## Rename list — hand to the user, fix in Figma in ONE pass

Compiled 2026-08-12 at the user's request (*"cho tôi những màn hình với tên đang bị sai chính tả,
tôi sẽ sửa lại"*), by scanning all 57 names. **Node ids are stable across a rename**, so this map's
id column survives; only the name column needs re-syncing afterwards.

Why it matters beyond tidiness: `screenId` derives from the frame name (spec `R3`), so a typo, a
trailing description, or a duplicate name becomes a permanent identifier — or, for duplicates, an
outright collision.

### A. Typos — unambiguous, 3 frames

| Node id | Current name | Should be |
|---|---|---|
| `44:7289` | Conversation **pratice** | Conversation practice |
| `184:3974` | Conversation **memorry** | Conversation memory |
| `280:1314` | Kanji lesson practice**( flashcard)** | Kanji lesson practice (flashcard) |

### B. Duplicate names — these collide as `screenId`, 4 frames in 2 pairs

| Node id | Current name | Proposed | Why |
|---|---|---|---|
| `234:1639` | To phase 2 | **To phase 2 (ready)** | the `Begin Listening` gate |
| `234:1667` | To phase 2 | **To phase 2 (countdown)** | the auto-advancing 3→2→1 |
| `29:2890` | Kanji library | **Kanji explorer** | measured: it is the *discovery* surface (browse by radical, curated paths) — see the comparison above |
| `280:3` | Kanji library (choose lesson, choose book mimikara,...) | **Kanji library** | it is the *curriculum* surface; the trailing description would land inside the id |

⚠️ **`29:2890` is a rename PLUS an open product question.** Renaming it makes the two frames
distinguishable either way, so it is safe to do now — but whether Korume ships both a discovery and
a curriculum surface for kanji is still the user's call (open question 1 in
`mem:phase0_figma_inventory_run_state`).

### C. Version artifacts in names — the "which one is live" trap, 2 frames

| Node id | Current name | Proposed |
|---|---|---|
| `149:2` | Shadowing hub **after changes** | Shadowing hub |
| `156:1310` | Companion home **after change** | Companion home |

`149:2` can only take the plain name once the dead `90:1985 Shadowing Hub` is deleted — do the
delete and the rename together, or the collision just moves. (`156:1310` has no rival frame, so its
rename is unconditional.) Note the two also disagree with each other, "changes" vs "change".

### D. Cosmetic / grammar — low priority, 2 frames

| Node id | Current name | Proposed |
|---|---|---|
| `180:1129` | Panel Quick preview: Conversation practice | Quick preview panel: Conversation practice |
| `220:16032` | Global setting | Global settings |

`180:1129` reads as two names run together with no separator — which is exactly why an earlier pass
mistook it for two frames.

### Not requested, mentioned once: casing is mixed

Roughly half the names are Title Case (`Shadowing Practice`, `Explore Lessons`, `Growth Areas`) and
half sentence case (`Kanji inspect`, `Pronunciation detail`, `Roadmap detail`). This does **not**
break `screenId` — derivation kebab-cases anyway — so it is genuinely optional. Raised only because
the user is opening the file to rename regardless.

## The arithmetic closes, and it tells us something

52 + the final 5 = **57**, exactly what Ctrl+A selected. Every frame on the page is accounted for by
the user's own list, once `Panel`/`Quick preview` collapses into one frame and the two duplicate pairs
are counted twice.

**Consequence: `Unuse` and `Pricing-remove` are no longer on the page** — the user's Figma cleanup
already removed them. An earlier note in this file predicted they would surface in a later batch;
that prediction was wrong and the count disproves it. Of the three frames flagged as safe to delete,
only `90:1985 Shadowing Hub` is still present.

## How to capture the rest

In Figma's **Layers panel**, click a frame, then `Shift`+click the fifteenth below it — that selects a
contiguous run of 15. Say the word, and `get_metadata` is called with **no `nodeId`** (which stays
cheap — it only lists pages) to read the prepended selection block. Repeat until every frame has an id.
