# Figma frame map — name → node id

> ⛔ **STALE as of 2026-08-20 — this map is a 2026-08-11 snapshot and the file has grown since.**
> Measured on 2026-08-20 by dumping the page and counting direct children of `0:1`: **69 top-level frames
> against this map's 57**. Twelve are absent here, and two of them are load-bearing for L9b Plan 1:
> **`337:3323` Data privacy (for delete)** and **`339:3612` Delete data**. The others:
> `332:3` Register · `333:210` Reset password · `335:306` Email OTP · `335:1588` Error state (right
> font) · `335:1976` Error404 · `337:2055` Error boundary · `340:3795` Membership · `340:4586`
> Unsubcribe membership · `340:5402` Choose method · `347:6277` Homepage.
>
> **Consequence beyond this file:** `lib/product/screen-registry.ts` does not know these frames exist,
> so every row's `figmaCheckedAt` overstates what was actually compared (`R7`). A re-capture pass is
> owed and is deliberately NOT folded into L9b Plan 1. **Never quote 57, or any count, from this file
> — enumerate** (`L-002`). Recapture method: the page dump exceeds the tool's token cap but is written
> to a file, so `get_metadata` on `0:1` then filter direct children locally — that is how 69 was
> measured, and it needs no frame selection in the desktop app.

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
| `29:2890` | **Kanji explorer** — the discovery surface (renamed 2026-08-12) |
| `36:4117` | Pronunciation detail |
| `37:4955` | Pronunciation library |
| `44:7289` | Conversation practice |
| `46:2` | Popup create conversation |
| `64:2061` | Roadmap |
| `65:2` | Login |
| `66:166` | Profile |
| `67:595` | Edit profile |
| `74:564` | Pricing |
| `75:1424` | FAQ |
| `90:1985` | Shadowing Hub ⚠️ **superseded — dead frame, build against `149:2`. Still on the page as of 2026-08-12; the delete-plus-rename pair was not carried out** |
| `105:3088` | Shadowing Practice |
| `111:515` | Homepage |
| `111:1556` | QuickStart |
| `111:1877` | Generate sensei |
| `111:1963` | Generate done |
| `120:2027` | Pronunciation (in shadowing) |
| `123:2835` | Dictation (in shadowing) |
| `125:1030` | Summary (in shadowing) |
| `149:2` | **Shadowing hub after changes** — the live hub; the calibration frame the shell tokens were measured from (`app/globals.css:136`) |
| `156:1310` | Companion home |
| `170:9364` | Conversation practice library |
| `180:2` | Roadmap detail |
| `180:1129` | Quick preview panel: Conversation practice — see note below |
| `180:1770` | Learning memory |
| `181:3525` | Gentle suggestion drawer |
| `182:3859` | Today's reflection (panel, fade around) |
| `184:3974` | Conversation memory |
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
| `220:16032` | Global settings |
| `220:16766` | Welcome Companion page |
| `232:2` | JLPT Practice |
| `234:618` | JLPT Phase test |
| `234:1639` | To phase 2 (ready) — the `Begin Listening` gate |
| `234:1667` | To phase 2 (countdown) — the auto-advancing 3→2→1 |
| `237:1690` | JLPT practice (phase 1) |
| `237:6708` | Finish phase 1 |
| `240:12992` | JLPT practice (phase 2) |
| `242:14234` | Practice result |
| `243:14899` | Review mistake (after JLPT practice) |
| `243:15364` | Review mistake (more detail) |
| `280:3` | **Kanji library** — the curriculum surface (renamed 2026-08-12) |
| `280:1314` | Kanji lesson practice (flashcard) |
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

   ⚠️ **Refined 2026-08-12 by the full cluster analysis — read
   `docs/product/screen-inventory.md` §6, which supersedes this box.** Two corrections: the two
   capabilities cost very different amounts (radicals already have a table, an FK and an index;
   curated collections have no schema at all, because `collections` is a *lesson* concept), and the
   framing above is itself too narrow — **`/kanji` implements neither frame**, so the question is not
   which one wins but whether Korume ships both surfaces.

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

## Rename pass — DONE and VERIFIED 2026-08-12

The user applied the rename list, and the result was **read back from Figma**, not assumed: the user
selected the frames and `get_metadata` was called with **no `nodeId`**, whose response prepends a
`Currently selected nodes` block. The name column above now carries those verified strings.

| Node id | Was | Now | |
|---|---|---|---|
| `44:7289` | Conversation **pratice** | Conversation practice | ✅ |
| `184:3974` | Conversation **memorry** | Conversation memory | ✅ |
| `280:1314` | Kanji lesson practice**( flashcard)** | Kanji lesson practice (flashcard) | ✅ |
| `234:1639` | To phase 2 | To phase 2 (ready) | ✅ |
| `234:1667` | To phase 2 | To phase 2 (countdown) | ✅ |
| `29:2890` | Kanji library | Kanji explorer | ✅ |
| `280:3` | Kanji library (choose lesson, choose book mimikara,...) | Kanji library | ✅ |
| `156:1310` | Companion home **after change** | Companion home | ✅ |
| `180:1129` | Panel Quick preview: Conversation practice | Quick preview panel: Conversation practice | ✅ |
| `220:16032` | Global setting | Global settings | ✅ |
| `149:2` | Shadowing hub **after changes** | — | ❌ **not renamed** |

Both duplicate-name collisions are gone: `Kanji explorer` / `Kanji library` are now distinct, and so
are the two `To phase 2` frames.

### ⚠️ Two things the read-back caught that the user did not intend

**1. `149:2` was not renamed, and `90:1985` was not deleted.** The selection contained `90:1985`
(still named `Shadowing Hub`) in `149:2`'s place — 11 frames, but one substitution. So the pair that
had to move together did not move at all: the live hub is still called `Shadowing hub after changes`,
and the dead frame it supersedes is still on the page. **The page therefore still holds 57 frames.**
Nothing downstream is blocked — node ids are what the analysis keys on — but this is the one rename
that also retires a dead frame, so it is worth finishing.

**2. Five of the new names carry invisible leading or trailing whitespace**, exactly as Figma
returned them: `To phase 2 (ready)·`, `·Global settings`, `·Kanji library`,
`·Quick preview panel: Conversation practice`, `Shadowing Hub·` (`·` marks the space).

**Do not send the user back into Figma to hunt invisible spaces.** The correct fix is downstream:
**`screenId` derivation MUST trim before it slugifies**, or `·Kanji library` yields a leading-dash id.
This is a note for Phase 1's `R3` — the derivation is the right place to be tolerant, because a
whitespace-only difference is not a naming decision. The name column above is recorded **trimmed**.

### Not requested, mentioned once: casing is still mixed

Roughly half the names are Title Case (`Shadowing Practice`, `Explore Lessons`), half sentence case
(`Kanji explorer`, `Pronunciation detail`). This does **not** break `screenId` — derivation
kebab-cases anyway — so it stays optional.

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
