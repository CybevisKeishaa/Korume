# Screen Registry Phase 3 — Stage 1 Implementation Plan

> ✅ **STATUS (2026-08-25): executed, and Stage 2 is CLOSED at zero `spec-only` rows** — the §6 gate ran and the user ruled it; see the spec's **§6.7**. This plan's body is kept as the historical record of what was executed; where it speaks of Stage 2 as still owed, §6.7 supersedes it.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `spec-only` screen kind (mechanically, with zero rows) and register the 2026-08-23
Figma frame batch, so the registry can represent "Spec/Register requires this destination, but neither
Figma nor the repo has ever heard of it" — without designing any screen or ruling any open question.

**Architecture:** A pure data + test change to the existing registry module — no runtime behavior, no
new files besides docs updates. `ScreenKind` gains one literal, `ScreenEntry` gains one nullable field
(`specRef`), five tests change (T3 widened, R12 pin moved 12→13, G2 pins remeasured, T12/T13 new), and
seven new frames + one conversion are registered as plain data rows.

**Tech Stack:** TypeScript strict, Vitest, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-23-screen-registry-phase-3-design.md` (read it — this plan
implements only §3.1 items 1–2, i.e. Stage 1; §5.6 explicitly forbids adding `spec-only` rows in Stage 1)

## Global Constraints

- **Stage 1 adds ZERO `spec-only` rows** (spec §5.6, user ruling 2026-08-23). Do not be tempted to
  populate T12/T13 with real data to "prove them properly" — that is Stage 2, gated on a user ruling
  over the discovery-pass candidate list, which has not happened.
- **Two open decisions must NOT be resolved by this plan**: `landing-page` vs frame `347:6277`
  (spec §9.1), and the GitHub sign-in button vs the Apple-yes/GitHub-no ruling (spec §9.2). Registering
  a frame records what Figma designed; it never authorises building it.
- **Never hand-compute a count and paste it into a test.** Every place this plan needs a measured
  number (the G2 pins), it says so explicitly and tells you to read the number from the tool's own
  output — never precompute it (`docs/lessons.md` L-002).
- **A guard/invariant test written over data that already satisfies it cannot fail first — prove it by
  mutation-check instead**: break it, watch it go red, restore it, and report both outputs
  (`CLAUDE.md` §7, `docs/lessons.md` L-004). This applies to T3 (widened over existing data), and to
  T12/T13 (vacuous by construction in Stage 1 — zero `spec-only` rows exist to exercise them).
- **`specRef` format is exactly two shapes**, nothing else: `japanese-learning-app-spec.md §<dotted
  number>` or `decision-register.md A<digits>` (spec §4.2). A loose `.md §` pattern is explicitly
  rejected — it would admit `capability-map.md §3`, a source this phase excludes.
- **Citation convention**: comments in `screen-registry.ts` cite `figma-frame-map.md` by **section
  name**, never by line number (line citations go stale — see the file's own header, and
  `docs/lessons.md` L-032).
- Run `npm run typecheck` and `npm test -- lib/product/screen-registry.test.ts` after every step that
  touches either file. Windows/Git Bash: watch for the MSYS `git grep` path-mangling hazard if you use
  `git grep` with a leading `/` pattern (`docs/lessons.md` L-019) — none of this plan's commands do, but
  don't introduce one.

---

## File Structure

| File | Change |
|---|---|
| `lib/product/screen-registry-types.ts` | `ScreenKind` gains `"spec-only"`; `ScreenEntry` gains `specRef: string \| null` |
| `lib/product/screen-registry.ts` | header exclusion note gains a "second batch" section; `register` converted `repo-only`→`screen`; 7 new rows; `landing-page` comment updated (data untouched); all 81 existing rows backfilled with `specRef: null` |
| `lib/product/screen-registry.test.ts` | T3 widened; new T12, T13; R12 pin 12→13; G2 pins remeasured |
| `docs/product/figma-frame-map.md` | top note updated: batch is now registered, one open item remains |

No other file changes. `nav-derivation.ts` and `route-resolver.ts` are unaffected (spec §4.1, measured).

---

### Task 1: Type change — `spec-only` kind and `specRef` field

**Files:**
- Modify: `lib/product/screen-registry-types.ts`
- Modify: `lib/product/screen-registry.ts` (mechanical backfill only — no row content changes)
- Modify: `lib/product/screen-registry.test.ts:80-95` (R12)

**Interfaces:**
- Produces: `ScreenKind` including `"spec-only"`; `ScreenEntry.specRef: string | null`, required on every
  object literal in `SCREEN_REGISTRY`. Every later task's new rows and edits use this field.

- [ ] **Step 1: Widen the R12 test first (it will fail — that's expected)**

In `lib/product/screen-registry.test.ts`, replace the `R12` test body:

```ts
  it("R12: every entry carries exactly the thirteen allowed fields", () => {
    // The concrete guard on R1. If someone adds `copy`, `layout`, `colors` or
    // `dataNeeds`, the registry has started becoming a second Figma. It is
    // also G3: `ruledBy` / `ruledAt` cannot be added without failing here.
    // Checked in BOTH directions — the older form only rejected unknown keys,
    // so an entry missing a field passed.
    const ALLOWED = [
      "screenId", "name", "kind", "variantOf", "figmaNodeId", "repoOnlyReason",
      "figmaCheckedAt", "route", "chrome", "impl", "navGroup", "navOrder",
      "specRef",
    ];
    expect(ALLOWED).toHaveLength(13);
    expect(SCREEN_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of SCREEN_REGISTRY) {
      expect(Object.keys(entry).sort(), entry.screenId).toEqual([...ALLOWED].sort());
    }
  });
```

(This replaces the existing `it("R12: every entry carries exactly the twelve allowed fields", ...)`
block — same location, `screen-registry.test.ts:80-95`.)

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `R12` fails, every entry's actual keys (12) don't match `ALLOWED` (13). All other
tests still pass. `npm run typecheck` also now fails — `ALLOWED` references nothing wrong yet, but you
haven't touched the type, so this is just the test file being ahead of the implementation; that's fine.

- [ ] **Step 3: Add `spec-only` to `ScreenKind` and `specRef` to `ScreenEntry`**

In `lib/product/screen-registry-types.ts`, replace line 1:

```ts
export type ScreenKind = "screen" | "state-variant" | "deprecated" | "repo-only";
```

with:

```ts
export type ScreenKind =
  | "screen"
  | "state-variant"
  | "deprecated"
  | "repo-only"
  | "spec-only"; // Phase 3: required by Spec/Register; no frame, no implementation
```

Then replace the end of the `ScreenEntry` interface:

```ts
  navGroup: NavGroupId | null;
  navOrder: number | null;
}
```

with:

```ts
  navGroup: NavGroupId | null;
  navOrder: number | null;
  /** Required when kind === 'spec-only', null otherwise (T13). A citation to
   *  where the requirement is written (japanese-learning-app-spec.md or
   *  decision-register.md) — never a ruling, never appearance/behaviour. */
  specRef: string | null;
}
```

- [ ] **Step 4: Run typecheck, confirm it now fails differently**

Run: `npm run typecheck`
Expected: FAIL — ~81 errors, one per object literal in `lib/product/screen-registry.ts`, each
"Property 'specRef' is missing in type '{ ... }' but required in type 'ScreenEntry'." This confirms
the type change is wired to the data file; the backfill in Step 5 fixes all of them at once.

- [ ] **Step 5: Backfill `specRef: null` onto all 81 existing entries**

Every existing entry ends with `navOrder: <value>,` immediately followed by the closing `},` — verified
by inspection, no exceptions. Run this from the repo root (Git Bash):

```bash
node <<'NODE_EOF'
const fs = require('fs');
const p = 'lib/product/screen-registry.ts';
let c = fs.readFileSync(p, 'utf8');
const re = /( {4}navOrder: (?:null|-?\d+),\r?\n)( {2}\},)/g;
let n = 0;
c = c.replace(re, (m, a, b) => { n++; return a + '    specRef: null,\n' + b; });
if (n !== 81) {
  console.error('expected 81 replacements, got', n, '— STOP, do not proceed, inspect the diff');
  process.exit(1);
}
fs.writeFileSync(p, c, 'utf8');
console.log('OK, replaced', n);
NODE_EOF
```

Expected output: `OK, replaced 81`. If the count printed is anything else, the script already refused
to write the file (exit 1) — inspect why before re-running (don't just re-run; diagnose first per
`superpowers:systematic-debugging`).

- [ ] **Step 6: Run typecheck and the full test file, confirm both pass**

Run: `npm run typecheck`
Expected: PASS, 0 errors.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS, all tests including R12 green.

- [ ] **Step 7: Run the full suite once, as a sanity check nothing else references the 12-field shape**

Run: `npm test`
Expected: PASS. (`screen-registry.routes.test.ts` reads routes, not the field set — should be
unaffected, but this is the cheap way to be sure.)

- [ ] **Step 8: Commit**

```bash
git add lib/product/screen-registry-types.ts lib/product/screen-registry.ts lib/product/screen-registry.test.ts
git commit -m "feat(screen-registry): add spec-only kind and specRef field (Phase 3 Stage 1, mechanical)"
```

---

### Task 2: Widen T3 — `figmaNodeId` null iff `repo-only` OR `spec-only`

**Files:**
- Modify: `lib/product/screen-registry.test.ts:5-13`

**Interfaces:**
- Consumes: `ScreenKind` from Task 1 (already includes `"spec-only"`).

- [ ] **Step 1: Widen the test**

Replace:

```ts
  it("T3: figmaNodeId is present iff the entry is not repo-only", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.figmaNodeId, entry.screenId).toBeNull();
      } else {
        expect(entry.figmaNodeId, entry.screenId).not.toBeNull();
      }
    }
  });
```

with:

```ts
  it("T3: figmaNodeId is present iff the entry is repo-only or spec-only", () => {
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only" || entry.kind === "spec-only") {
        expect(entry.figmaNodeId, entry.screenId).toBeNull();
      } else {
        expect(entry.figmaNodeId, entry.screenId).not.toBeNull();
      }
    }
  });
```

- [ ] **Step 2: Run the test, confirm it still passes**

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS. This is expected and is exactly why the change needs a mutation-check instead of a
red-then-green cycle: zero `spec-only` rows exist yet, so widening the condition doesn't change any
outcome on today's data.

- [ ] **Step 3: Mutation-check — prove the guard actually guards**

Temporarily give the existing `repo-only` row `landing-page` a fake `figmaNodeId` (in
`lib/product/screen-registry.ts`), to simulate the exact bug T3 exists to catch:

Find:
```ts
  {
    screenId: "landing-page",
    name: "Landing Page",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
```

Temporarily change `figmaNodeId: null,` (in that block only) to `figmaNodeId: "999:999",`.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `T3: figmaNodeId is present iff the entry is repo-only or spec-only` fails on
`landing-page`. **Record this failing output.**

- [ ] **Step 4: Revert the mutation, confirm green again**

Change `figmaNodeId: "999:999",` back to `figmaNodeId: null,` on that same row.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS. **Record this passing output alongside Step 3's failing output** — both outputs are the
proof this guard works (`CLAUDE.md` §7).

- [ ] **Step 5: Commit**

```bash
git add lib/product/screen-registry.test.ts
git commit -m "test(screen-registry): widen T3 to cover spec-only, mutation-checked"
```

---

### Task 3: Add T13 — `specRef` present iff `spec-only`, and matches an allowed citation shape

**Files:**
- Modify: `lib/product/screen-registry.test.ts` (insert new test after `T10`, before `R12`)

**Interfaces:**
- Consumes: `entry.specRef: string | null` (Task 1).

- [ ] **Step 1: Add the test**

Insert this new `it` block into the `describe("screen registry invariants", ...)` block, right after
the `T10` test and before `R12`:

```ts
  it("T13: specRef is present iff spec-only, and matches an allowed citation shape", () => {
    // Only two sources are valid scan targets for Phase 3 (spec §6.1): the
    // product spec and the decision register. A loose `/\.md §/` pattern is
    // deliberately rejected — it would admit capability-map.md, a
    // Figma-derived source this phase excludes on purpose.
    const SPEC_REF_PATTERN =
      /^(japanese-learning-app-spec\.md §\d+(\.\d+)*|decision-register\.md A\d+)$/;
    // Vacuous by construction in Stage 1: zero spec-only rows exist yet
    // (spec §5.6), so this loop runs zero iterations today. Proven instead
    // by mutation-check (see the Stage 1 plan) — CLAUDE.md §7, spec §8.2.
    // Stage 2 adds a non-vacuity assertion once real rows exist.
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "spec-only") {
        expect(entry.specRef, entry.screenId).not.toBeNull();
        expect(entry.specRef as string, entry.screenId).toMatch(SPEC_REF_PATTERN);
      } else {
        expect(entry.specRef, entry.screenId).toBeNull();
      }
    }
  });
```

- [ ] **Step 2: Run the test, confirm it passes (vacuously)**

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS.

- [ ] **Step 3: Mutation-check #1 — a `spec-only` row with `specRef: null` must fail T13**

Temporarily add this object as the last element of the `SCREEN_REGISTRY` array in
`lib/product/screen-registry.ts` (just before the closing `];`):

```ts
  {
    screenId: "mutation-check-temp",
    name: "MUTATION CHECK — DELETE ME",
    kind: "spec-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: null,
    figmaCheckedAt: null,
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
```

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `T13` fails on `mutation-check-temp` (`specRef` is null). **Record this output.**

Now edit that same temp row's `specRef` to `"TODO"` (mutation-check #2).

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `T13` fails (doesn't match either allowed shape). **Record this output.**

Now edit `specRef` to `"capability-map.md §3"` (mutation-check #3 — a real file, but an excluded
source, so it must still fail the shape check).

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `T13` fails (doesn't match either allowed shape — the pattern only accepts
`japanese-learning-app-spec.md` or `decision-register.md`). **Record this output.**

- [ ] **Step 4: Delete the temp row entirely**

Remove the whole `mutation-check-temp` object from `lib/product/screen-registry.ts`.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS. **Record this output.**

- [ ] **Step 5: Mutation-check #4 — `specRef` set on a non-`spec-only` row must fail T13**

Temporarily add `specRef: "decision-register.md A1",` to the existing `dashboard` row (find
`screenId: "dashboard"`, its `kind: "screen"`, add the field right after `navOrder: 1,`).

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `T13` fails on `dashboard` (non-null `specRef` on a `kind: "screen"` entry). Also
expect R12 to fail here too (14 keys now) — that's a bonus confirmation, not the point of this check.
**Record this output.**

> ⚠️ **CORRECTION, measured during execution — "R12 fails too (14 keys now)" is FALSE.** Task 1
> Step 5 had already backfilled `specRef: null` onto all **81** then-existing rows, `dashboard`
> included. This mutation therefore changes a **value**, not the key set, so `R12` stays green and
> only `T13` goes red — which is precisely what this mutation-check is for. Do not treat a green
> `R12` here as the check having failed to bite. (Recorded inline because the SDD ledger that would
> otherwise hold it lives under the gitignored `.superpowers/`.)

Remove the `specRef: "decision-register.md A1",` line from `dashboard` again.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS. **Record this output.**

- [ ] **Step 6: Commit**

```bash
git add lib/product/screen-registry.test.ts
git commit -m "test(screen-registry): add T13 (specRef shape), mutation-checked"
```

---

### Task 4: Add T12 — `spec-only` is the empty cell

**Files:**
- Modify: `lib/product/screen-registry.test.ts` (insert new test after `T10`, before `T13`)

**Interfaces:**
- Consumes: the nine null/`'none'` clauses from spec §4.1.

- [ ] **Step 1: Add the test**

Insert this `it` block right after `T10` and before the `T13` block added in Task 3 (so the final order
reads `T3, T4, T5, T7, T9, T10, T12, T13, R12, G2`):

```ts
  it("T12: spec-only is the empty cell — no frame, route, chrome, variant, repo-only reason, stamp, or nav", () => {
    const specOnly = SCREEN_REGISTRY.filter((e) => e.kind === "spec-only");
    // Vacuous by construction in Stage 1: zero spec-only rows exist yet
    // (spec §5.6). Proven instead by mutation-check (see the Stage 1 plan) —
    // CLAUDE.md §7, spec §8.2. Stage 2 adds:
    //   expect(specOnly.length).toBeGreaterThan(0);
    // once real rows exist — not before, since zero is the correct count now.
    for (const entry of specOnly) {
      expect(entry.figmaNodeId, entry.screenId).toBeNull();
      expect(entry.route, entry.screenId).toBeNull();
      expect(entry.chrome, entry.screenId).toBeNull();
      expect(entry.impl, entry.screenId).toBe("none");
      expect(entry.variantOf, entry.screenId).toBeNull();
      expect(entry.repoOnlyReason, entry.screenId).toBeNull();
      expect(entry.figmaCheckedAt, entry.screenId).toBeNull();
      expect(entry.navGroup, entry.screenId).toBeNull();
      expect(entry.navOrder, entry.screenId).toBeNull();
    }
  });
```

- [ ] **Step 2: Run the test, confirm it passes (vacuously)**

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS.

- [ ] **Step 3: Mutation-check — a `spec-only` row carrying a `route` must fail T12**

Temporarily add this object as the last element of `SCREEN_REGISTRY` in
`lib/product/screen-registry.ts` (just before the closing `];`):

```ts
  {
    screenId: "mutation-check-temp",
    name: "MUTATION CHECK — DELETE ME",
    kind: "spec-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: null,
    figmaCheckedAt: null,
    route: "/mutation-check",
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: "decision-register.md A1",
  },
```

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: FAIL — `T12` fails on `mutation-check-temp` (`route` is not null). **Record this output.**

- [ ] **Step 4: Delete the temp row, confirm green again**

Remove the whole `mutation-check-temp` object.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS. **Record this output.**

- [ ] **Step 5: Commit**

```bash
git add lib/product/screen-registry.test.ts
git commit -m "test(screen-registry): add T12 (spec-only is the empty cell), mutation-checked"
```

---

### Task 5: Register the 2026-08-23 frame batch

**Files:**
- Modify: `lib/product/screen-registry.ts` (header comment, `register` row, `landing-page` comment, 7 new rows)
- Modify: `lib/product/screen-registry.test.ts:97-169` (G2 pins — remeasured, not computed)

**Interfaces:**
- Produces: registry rows `register` (converted), `reset-password`, `email-otp`, `error404`,
  `error-boundary`, `membership`, `unsubscribe-membership`, `choose-method` — all consumable by any
  later phase that ports these screens.

- [ ] **Step 1: Add the second-batch exclusion note to the registry header**

In `lib/product/screen-registry.ts`, find the end of the header doc-comment:

```ts
 * Anything absent from the frame map is not on the page at all: `5:1718`
 * (Unuse), `71:2` (Pricing-remove) and `243:14906` are outside the 57 for that
 * reason — the map's own arithmetic proves the first two were already deleted
 * and the third was never matched to a frame.
 */
```

Insert a new block right before the closing `*/`:

```ts
 * Anything absent from the frame map is not on the page at all: `5:1718`
 * (Unuse), `71:2` (Pricing-remove) and `243:14906` are outside the 57 for that
 * reason — the map's own arithmetic proves the first two were already deleted
 * and the third was never matched to a frame.
 *
 * ---------------------------------------------------------------------------
 * SECOND BATCH EXCLUSIONS — 2026-08-23 capture, 1 of 13
 * ---------------------------------------------------------------------------
 * `figma-frame-map.md` § "Second capture batch (2026-08-23)" screenshotted 13
 * previously-uncaptured frames (plus `218:15740`, already known but never
 * screenshotted before). Phase 3 Stage 1 registers all of them except:
 *
 *   `335:1588`  Error state (right font) — pixel-identical to `218:15740`
 *               except one card's CTA label; a font/typography QA pass over
 *               the same style-guide sheet, not a distinct screen. Same
 *               classification that already excludes its twin above.
 *
 * The hidden `346:6275` "Homepage" rectangle is not a Figma frame at all
 * (`hidden="true"`, decorative canvas noise) and was never a candidate.
 *
 * `347:6277` (the new marketing-landing frame) is deliberately UNREGISTERED
 * pending an identity ruling — see the `landing-page` entry's comment below
 * and `mem:screen_registry_phase_3_run_state` §9.1. Not an exclusion: it is
 * an open decision, not a classification, and must not be resolved silently.
 */
```

- [ ] **Step 2: Convert the `register` row from `repo-only` to `screen`**

Find:

```ts
  // ⚠️ NO PRODUCT RULING EXISTS FOR /register, and none is inferred here.
  // Everything below is FRAME evidence: `screen-inventory.md` §3's table, row
  // `/register` — "Figma has `Login` but no register frame" — plus §4's
  // "Frameless with no such conflict" list, which names it alongside /review,
  // /achievements, /challenges and /statistics. Both are observations on the
  // has-a-frame axis. The has-a-ruling axis belongs to `decision-register.md`,
  // which says nothing about /register; §3's Ruling column therefore reads
  // "still open", and that is the honest state, not a gap to be filled in by
  // reading the frame evidence as a decision.
  {
    screenId: "register",
    name: "Register",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "no-frame-at-last-pass",
    figmaCheckedAt: "2026-08-12",
    route: "/register",
    chrome: "auth",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
```

Replace with:

```ts
  // R6 fires: a Figma frame now exists for /register, captured in the second
  // batch (figma-frame-map.md § "Second capture batch (2026-08-23)" — Auth
  // flow table). Converted from repo-only. The has-a-ruling axis is
  // untouched by this conversion — decision-register.md still says nothing
  // about /register, and the frame shows a "Continue with GitHub" button
  // that conflicts with the Apple-yes/GitHub-no ruling; see spec §9.2 —
  // NOT resolved here, must be settled before this screen is ported.
  {
    screenId: "register",
    name: "Register",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "332:3",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: "/register",
    chrome: "auth",
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
```

- [ ] **Step 3: Update the `landing-page` comment — data untouched, open decision flagged**

Find:

```ts
  // §19.0 — "there is NO marketing landing frame anywhere in the 57... the
  // public front door of Korume is undesigned." P16 records this as known
  // and accepted — the user will design it later.
  {
    screenId: "landing-page",
```

Replace with:

```ts
  // §19.0 — "there is NO marketing landing frame anywhere in the 57... the
  // public front door of Korume is undesigned." P16 records this as known
  // and accepted — the user will design it later.
  //
  // ⛔ OPEN as of 2026-08-23 — do NOT resolve here. The second frame batch
  // includes `347:6277`, a full marketing landing page (figma-frame-map.md
  // § "New marketing homepage"). Whether it IS the design for this route
  // (→ convert, like `register` above) or a DIFFERENT destination (→ its own
  // row) is an identity question reserved to the user (spec §9.1). This row
  // is deliberately left untouched — kind, figmaNodeId and figmaCheckedAt
  // all stay exactly as they were before this frame was captured.
  {
    screenId: "landing-page",
```

- [ ] **Step 4: Add the 7 new rows**

Find the end of the array, just before the "Superseded frames" section:

```ts
  // variantOf "speaking" — the registered screenId for 170:9364
  // (Conversation practice library), the screen this preview overlays.
  {
    screenId: "quick-preview-panel-conversation-practice",
    name: "Quick preview panel: Conversation practice",
    kind: "state-variant",
    variantOf: "speaking",
    figmaNodeId: "180:1129",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Superseded frames still on the Figma page (kind: "deprecated").
  // ===================================================================
```

Replace with:

```ts
  // variantOf "speaking" — the registered screenId for 170:9364
  // (Conversation practice library), the screen this preview overlays.
  {
    screenId: "quick-preview-panel-conversation-practice",
    name: "Quick preview panel: Conversation practice",
    kind: "state-variant",
    variantOf: "speaking",
    figmaNodeId: "180:1129",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-12",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Phase 3 Stage 1 — the 2026-08-23 frame batch (figma-frame-map.md §
  // "Second capture batch"). impl: "none" for all — no page, no server
  // action, no route exists for any of these yet.
  // ===================================================================

  // Auth flow — Reset password. Same OAuth+email split layout as
  // register/login; Supabase Auth supplies the primitive, no code exists.
  {
    screenId: "reset-password",
    name: "Reset password",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "333:210",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Auth flow — Email OTP (6-digit code entry, resend link). No code exists.
  {
    screenId: "email-otp",
    name: "Email OTP",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "335:306",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Real 404 page design. Repo has no not-found.tsx anywhere — Next's
  // default 404 serves today.
  {
    screenId: "error404",
    name: "Error404",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "335:1976",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Real in-app route-error screen, rendered inside actual app chrome
  // (sidebar + topbar visible in the frame). Repo has no error.tsx anywhere.
  {
    screenId: "error-boundary",
    name: "Error boundary",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "337:2055",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Full /settings/membership page design. Zero PayOS integration code
  // exists yet — Layer 8 territory (CLAUDE.md §3).
  {
    screenId: "membership",
    name: "Membership",
    kind: "screen",
    variantOf: null,
    figmaNodeId: "340:3795",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Same membership page with the "Leave Korume for now?" cancellation
  // dialog open.
  {
    screenId: "unsubscribe-membership",
    name: "Unsubcribe membership",
    kind: "state-variant",
    variantOf: "membership",
    figmaNodeId: "340:4586",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
  // Same membership page with the payment-method dialog open. ⚠️ The frame
  // offers PayOS + SePay + MoMo; the user ruled 2026-08-23 that PayOS-only
  // stands (CLAUDE.md §3 unchanged — SePay/MoMo deferred, merchant
  // registration). Registering this row records what Figma designed, not
  // what may be built — whoever ports this screen MUST apply the
  // PayOS-only ruling, not the frame's provider list.
  {
    screenId: "choose-method",
    name: "Choose method",
    kind: "state-variant",
    variantOf: "membership",
    figmaNodeId: "340:5402",
    repoOnlyReason: null,
    figmaCheckedAt: "2026-08-23",
    route: null,
    chrome: null,
    impl: "none",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },

  // ===================================================================
  // Superseded frames still on the Figma page (kind: "deprecated").
  // ===================================================================
```

- [ ] **Step 5: Run typecheck and the registry test file**

Run: `npm run typecheck`
Expected: PASS, 0 errors.

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: `T3, T4, T5, T7, T9, T10, T12, T13, R12` all PASS. **`G2` FAILS** — this is expected: the
`stamped` length and the `stampedByDate` per-date map are pinned to pre-Stage-1 values and this task
just changed them (register moved from the `2026-08-12` bucket to `2026-08-23`; 7 new entries were
added, all stamped `2026-08-23`). Do not treat this as a bug. Do not guess the new numbers. Continue to
Step 6.

- [ ] **Step 6: Remeasure the G2 pins from the failing test's own output — do not compute them**

Read the `G2` failure output from Step 5. Vitest's `toEqual` failure prints both `Expected` and
`Received` for the two assertions that now fail:

```ts
    expect(stamped).toHaveLength(75);
```
and
```ts
    expect(Object.fromEntries(stampedByDate)).toEqual({
      "2026-08-12": 72,
      "2026-08-20": 3,
    });
```

In `lib/product/screen-registry.test.ts` (the `G2` test, around line 153-167), replace `75` in
`expect(stamped).toHaveLength(75)` with the exact length the **Received** side of the failure printed.
Replace the object literal `{ "2026-08-12": 72, "2026-08-20": 3 }` with the exact object the
**Received** side printed (it will gain a new `"2026-08-23"` key; the `"2026-08-12"` count will drop by
1 because `register` moved out of it; `"2026-08-20"` is untouched).

Do not use any number written anywhere in this plan — those are illustrative, not measured. The only
valid source for these two numbers is the test run's own output on your machine, right now.

- [ ] **Step 7: Run the test again, confirm G2 (and everything else) is green**

Run: `npm test -- lib/product/screen-registry.test.ts`
Expected: PASS — all tests, including the remeasured `G2`.

Run: `npm test`
Expected: PASS — full suite.

- [ ] **Step 8: Commit**

```bash
git add lib/product/screen-registry.ts lib/product/screen-registry.test.ts
git commit -m "feat(screen-registry): register the 2026-08-23 frame batch (Phase 3 Stage 1)

- register: repo-only -> screen (332:3), R6 conversion
- 5 new screen rows: reset-password, email-otp, error404, error-boundary, membership
- 2 new state-variant rows: unsubscribe-membership, choose-method (both variantOf membership)
- header exclusion list: 335:1588 (second-batch style-guide duplicate)
- landing-page: comment updated, data untouched (open identity question, spec Sec9.1)
- G2 pins remeasured against the updated registry"
```

---

### Task 6: Update `figma-frame-map.md`, run the final Stage 1 gate

**Files:**
- Modify: `docs/product/figma-frame-map.md:15-18`

- [ ] **Step 1: Update the "still owed" note**

Find:

```markdown
> ⚠️ Still owed, unchanged from 2026-08-20: `lib/product/screen-registry.ts` does not know about any
> of these 12 (now 13, since `218:15740` was in the registry's blind spot too by never having been
> screenshotted) frames yet, so registry rows' `figmaCheckedAt` still overstate what was compared —
> that only closes when Screen Registry Phase 3 folds them in.
```

Replace with:

```markdown
> ✅ **Registered 2026-08-23** (Screen Registry Phase 3 Stage 1): 11 of the 13 previously-uncaptured
> frames are now rows in `lib/product/screen-registry.ts` — `register` (converted from `repo-only`),
> plus 5 new `screen` rows and 2 new `state-variant` rows. `335:1588` is excluded (registry header —
> style-guide duplicate of `218:15740`). `347:6277` (the new marketing homepage) is deliberately NOT
> registered — an identity ruling against the existing `landing-page` row is still owed, see that row's
> comment and `mem:screen_registry_phase_3_run_state` §9.1. The GitHub sign-in button conflict (spec
> §9.2) is also still open and must be settled before the auth screens are ported.
```

- [ ] **Step 2: Run the final Stage 1 gate**

Run: `npm run typecheck`
Expected: PASS, 0 errors.

Run: `npm test`
Expected: PASS, full suite green.

Run: `npm run lint`
Expected: PASS (or same warning baseline as `master` — do not introduce new errors).

Run: `npm run build`
Expected: exit 0.

Playwright and a whole-branch review are **deliberately deferred** — Stage 2 (the discovery-pass gate,
then writing approved `spec-only` rows) is still owed on this branch before it merges. Running the full
gate now is a mid-branch checkpoint, not a merge gate.

- [ ] **Step 3: Commit**

```bash
git add docs/product/figma-frame-map.md
git commit -m "docs(figma-frame-map): note the 2026-08-23 batch is now registered"
```

- [ ] **Step 4: Report Stage 1 complete, and what's next**

Stage 1 is done: type change, 5 test changes (T3, R12, G2, plus new T12/T13), and the frame batch are
all committed and green. **Do not proceed to Stage 2 in this session without the user first ruling the
discovery-pass candidate list (spec §6)** — that gate is a product decision, not an engineering task,
and per `CLAUDE.md` §10 `docs/lessons.md` should only be written once at the true end of the branch
(after Stage 2 and the whole-branch review), not now.

---

## Self-Review Notes

- **Spec coverage**: §3.1 items 1–2 (type change, frame batch) — Tasks 1–5. §3.1 items 3–4 (discovery
  pass, Stage 2 rows) are explicitly out of scope for this plan (§3.2, §5.6) — not a gap, a boundary.
  §8.1 (5 test changes) — Tasks 1 (R12), 2 (T3), 3 (T13), 4 (T12), 5 (G2). §8.2 (vacuity handling) —
  built into Tasks 2–4's mutation-check steps. §9 (two open decisions) — Task 5 Steps 1 and 3
  explicitly flag both without resolving either.
- **Placeholder scan**: the only intentional "fill in from measurement" spot is Task 5 Step 6 (G2
  pins), which is explicitly required to be that way by this project's own L-002 lesson and spec §5.5 —
  not a plan-writing shortcut. Every other step has literal code.
- **Type consistency**: `specRef: string | null` (Task 1) matches every later usage (Tasks 2–5) — no
  entry sets it to anything but `null` in Stage 1, since Stage 1 adds no `spec-only` rows.
