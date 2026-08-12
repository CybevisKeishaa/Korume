# Phase 0 — Figma Product Inventory — run state (IN PROGRESS, paused 2026-08-11)

> **Where it stands:** the **frame map is DONE (57/57)**. The **inventory analysis has NOT started.**
> No code touched, no branch cut — everything so far is docs + memory, committed straight to master.
> Read `mem:project_status` § NEXT ACTION first for why this stage exists at all.

## Why this stage exists (do not re-litigate)

User ruling 2026-08-11. Screen Registry Phase 1 keeps its approved spec but is **not next**:

```
Figma → Product Inventory → Capability Map → IA/Navigation → Screen Registry
      → Route/API reconciliation → UI implementation → L8 → L9
```

**Navigation is an OUTPUT of the analysis, never an input.** Both navbars in play are demos — the
repo's `NAV_GROUPS` (provisional since C1) and the one in the user's reference render
(`public/demo/image.png`). The controller judged Figma against the render's navbar, the user caught
it, and that is what triggered this restructure.

**Two artifacts, not one.** The analysis is prose/tables and one-time; the registry is 12 typed
fields and durable. `ScreenEntry` has no `purpose`/`entryPoints`/`actions`/`dataNeeds`/`api` and must
not grow them, or it becomes the "product ontology system" the user explicitly forbade.

**Checkpoint the user requires:** the assistant may propose IA, but **must stop for review before IA
and navbar are locked.**

## Artifacts, and what each is for

| File | Role | State |
|---|---|---|
| `docs/product/figma-frame-map.md` (`9af7d7a`) | name → node id for all 57 frames | ✅ **complete** |
| `docs/product/screen-inventory.md` (`9580ad5`, `6074024`) | frames classified screen vs state-variant, + user rulings | draft, pre-dates the frame map |
| `mem:screen_registry_inputs` | product adjudications + the vocab/mining/playlists corrections | current |
| `docs/superpowers/specs/2026-08-08-screen-registry-design.md` (`e861150`) | Phase 1's approved spec, R1–R13 | untouched, still correct |

## Verified input path — measured, do not re-derive

- **Figma desktop MCP is live.** File `IwFHZDZdHW7qsSFiNbWrkd` ("Korume"), single page `0:1`.
- **`get_screenshot` is the workhorse and is cheap** — returns a short-lived URL (~80 tokens), not an
  inline image. `curl` it to the scratchpad, then Read the file. Verified repeatedly.
- **Never call `get_metadata` on the page.** It is a *geometry* tool and the page is ~4.4M chars.
  Phase 0 asks about purpose and flow, which a picture answers and coordinates do not.
- **`figma-mcp-go` is `plugin not connected`.** The `weave_*` tools are unrelated (Weave workflows).
- **Frame enumeration is SOLVED** and the map is captured — but the method is worth keeping:
  the user selects frames in Figma, then `get_metadata` **with no `nodeId`** (which stays cheap — it
  only lists pages) prepends a `Currently selected nodes` block. **It prints at most 16**, so capture
  in runs of ≤15 via Layers-panel click + Shift-click.
- **Richest un-read source: the Figma Make bundle's tier-A prose prompts** —
  `C:\Users\tplon\Downloads\Design Shadowing Page UI\src\imports\pasted_text\`, 21 files, 208 KB of
  design intent in words. **Still unread.** Decaying snapshot for *numbers*, far more stable for
  *intent*; cross-check every conclusion against a live screenshot. See `mem:figma_make_design_source`.

## ⭐ The method rule this stage bought, and it cost a wrong guess to learn

`29:2890` and `280:3` both read as "Kanji library". **Name-matching said "duplicate". Canvas width
said "newer iteration supersedes older" (1278 vs 1536, the same tell that was right for
`90:1985` → `149:2`). The screenshot said they are two different products.** Only the picture was
right.

- `29:2890` **Kanji Explorer** — discovery: featured collection, curated thematic paths, browse by
  JLPT, **browse by radical**, recently viewed.
- `280:3` **Kanji Library** — curriculum: pick JLPT level → current path → **choose study material**
  (Core / In Context / Reading / My Weak Kanji, with book sources like Mimikara) → ordered numbered
  lesson list with Complete/Review state.

**So: the inventory must LOOK at every frame. Never infer a frame's identity from its name, its id,
or its canvas size.** Two capabilities surfaced here that no repo route covers: browse-by-radical and
curated thematic collections.

## ▶ NEXT ACTION for the session that picks this up

Run the inventory **cluster by cluster**, writing each into `docs/product/screen-inventory.md` and
committing per cluster — the whole thing does not fit one session, and per-cluster commits mean a
crash loses nothing. Suggested order, Kanji first because its open question is the hottest:

**Kanji** (`29:2890`, `280:3`, `280:1314`, `28:2041`) → **Shadowing** (`149:2`, `105:3088`,
`200:7705`, `200:10726`, `212:14610`, `212:14753`, `125:1030`, `123:2835`, `120:2027`) →
**JLPT** (`232:2`, `234:618`, `237:1690`, `240:12992`, `237:6708`, `234:1639`, `234:1667`,
`242:14234`, `243:14899`, `243:15364`) → **Companion** (`156:1310`, `220:16766`, `190:7376`,
`215:15164`, `180:1770`, `184:3974`, `187:6556`, `182:3859`, `181:3525`, `64:2061`, `180:2`,
`111:1877`, `111:1963`, `216:15648`) → **Conversation** (`44:7289`, `170:9364`, `46:2`, `180:1129`) →
**Pronunciation** (`37:4955`, `36:4117`) → **Grammar** (`284:1464`) → **Account**
(`65:2`, `66:166`, `67:595`, `220:16032`) → **Marketing** (`111:515`, `74:564`, `209:14032`,
`75:1424`, `111:1556`, `203:13813`) → **global states** (`210:14338`, `218:15740`).

Per frame answer: screen or state? · capability? · entered from where? · exits where? · actions? ·
data needed? · API exists? · route exists? · related screens? Tag each
`CONFIRMED / LIKELY / AMBIGUOUS / OBSOLETE / STATE-VARIANT`.

**Then** aggregate capabilities → propose IA → **STOP for the user's review** → lock IA → Phase 1.

## Model decision — still open, and it is a real gate

Policy (`mem:model_selection_policy`) requires asking before brainstorm/decomposition work. Asked;
the user leaned toward the stronger model for the IA reasoning but never named one. Controller's
recommendation, which the user has not yet accepted or rejected:

- **Screenshot → read → fill the table = Opus 5.** Observation, not hard reasoning.
- **Capability → IA → navigation synthesis = Fable**, then back to Opus to write the plan.

⚠️ **The assistant cannot switch its own model.** Fable happens either by the user running `/model`,
or by the user explicitly asking for a `model: "fable"` subagent — and the session-switch is the
better shape here, because a subagent starts cold and **cannot hold the IA checkpoint conversation**
the user requires.

## 🚫 `public/demo/**` is NOT a design source — user ruling 2026-08-12

**"Ảnh đó chỉ là ảnh rác"** — the PNGs in `public/demo/` are throwaway images the user edited ad hoc
to show the assistant a demo. They are **not** a reference render, not a design artifact, and carry
no authority about nav, IA, or any screen. (This is why the working tree showed `image.png` modified
and `image1.png` deleted with no explanation — nothing to investigate.)

**One conclusion already rested on them and has been withdrawn:** `docs/product/screen-inventory.md`
had ruled `Companion home` a separate screen from `/dashboard` by reading the render's left nav.
That paragraph is now marked WITHDRAWN in place; the claim must be re-derived from `156:1310` /
`216:15648` during the Companion cluster. Commit `6074024`'s message ("read Companion home off the
reference render") is therefore a record of a method error, not of a finding.

**Generalised:** the only authoritative visual source for Phase 0 is a **live Figma screenshot**.
Not the render, not the local Figma Make bundle (a decaying snapshot, `mem:figma_make_design_source`),
not a frame name. See the ⭐ method rule above — it now has two independent pieces of evidence.

## ⚑ Open questions the user owes

**New, from this stage:**
1. **Kanji Explorer vs Kanji Library** — does Korume want both a discovery surface and a curriculum
   surface, or did the curriculum design replace the exploratory one?
2. ✅ **RESOLVED 2026-08-12 — `234:1639` vs `234:1667` are two sequential steps, not a duplicate.**
   User: "To phase 2 là màn hình chuyển của phần JLPT practice." Screenshots confirm and separate them:
   `234:1639` = `PHASE 2 / Listening Section`, illustration + prep copy + a **`Begin Listening` button**
   (waits for a click); `234:1667` = `CERTIFICATION PRACTICE / "Please prepare your headphones."` + a
   large orange **countdown numeral** and no button (auto-advances). Flow: Finish phase 1 → gate →
   countdown → `JLPT practice (phase 2)`. Both are `state-variant`s of the JLPT practice flow, and the
   countdown frame is itself one tick of an animated 3→2→1. Rename proposed to the user:
   `To phase 2 (ready)` / `To phase 2 (countdown)`.
3. `243:14906` — a node id recorded in a spec that matches no frame name.
4. Three frame names carry typos and `screenId` derives from names, so fix before the registry:
   `44:7289` "Conversation **pratice**", `184:3974` "Conversation **memorry**",
   `280:1314` "Kanji lesson practice**( flashcard)**".
5. `90:1985 Shadowing Hub` is still on the page and is dead (live one is `149:2`) — safe to delete.
   `Unuse` and `Pricing-remove` are already gone; the 57-count proves it.

**Carried, from `docs/product/screen-inventory.md` §5:**
- Vocab: ruled hidden-but-reversible, yet the reference render shows a `Vocabulary` nav item and a
  `PERSONAL VOCABULARY SHELF` panel. Its cards show a `Confidence` meter that `/vocab` does not model
  (`/vocab` is SM-2), so the shelf is plausibly companion-owned — **unverified**.
- `Grammar analysis` — confirm the reading: new feature, deliberately unbuilt, existing `/grammar`
  list is enough.
- `Loading state` / `Error state` — proposed rule: a state of one named screen → registry; a state
  any screen can enter → `/admin/style-guide`. User asked to discuss further.
- `Companion Knowledge Assistant` → `/sensei`? `Growth Areas` → `/weekly-report`? Both placeholders.
- `Pronunciation (in shadowing)` — state of `shadowing-practice`, or its own route?
- `/playlists` — own screen, or a tab inside Explore?

## Loose end found while measuring, unrelated to Phase 0

`components/ui/container.tsx` still ships `max-w-6xl px-4 sm:px-6 lg:px-8` (**1152px**, Tailwind
defaults) while `components/layout/two-column-shell.tsx` correctly uses
`max-w-content px-[--layout-gutter]` (**1240px**, `--layout-content-max`). Two container contracts,
88px apart, both live. Small targeted fix; **not** a reason to run a calibration programme — the
calibration work is already merged (`86328bc` tokens/fonts, `7277ac1` Rule #0 + shell, `bd7f574`
shell geometry measured from `149:2`, recorded in `app/globals.css:128-146` and test-locked in
`lib/design-tokens.test.ts`).

## Related

`mem:project_status` · `mem:screen_registry_inputs` · `mem:figma_make_design_source` ·
`mem:model_selection_policy` · `mem:shadowing_hub_plan_c_run_state` (C3 owns Explore) ·
`docs/lessons.md` (`L-002` never record derived counts; `L-013` upstream defects)
