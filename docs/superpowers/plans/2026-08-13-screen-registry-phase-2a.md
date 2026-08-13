# Screen Registry Phase 2a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the screen registry tell the truth about what it observed, so that the 21 entries
that were never debt stop being counted as debt, and adjudicate `jlpt-test` without executing it.

**Architecture:** Four sequential edits to *data, types and documents only*. Rename one union member
so its name matches the semantics R6 has always given it; backfill `figmaCheckedAt` from citations,
never from membership; write the ruling that already governs each entry into that entry's comment;
record the `jlpt-test` ruling in the decision register. No application code, API, DB schema or route
implementation is touched — that boundary is itself a locked guard.

**Tech Stack:** TypeScript (strict), Vitest, Next.js 14 App Router. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-13-screen-registry-phase-2a-design.md` (approved
2026-08-13). Read it before Task 1; this plan implements it and does not restate its reasoning.

## Global Constraints

- **Order is fixed:** 2a.1 → 2a.2 → 2a.3 → 2a.4 → whole-branch review. Do not reorder.
- **2a changes no application code.** No file under `app/`, no API route, no `supabase/migrations/`,
  no component. **This includes NOT deleting `/jlpt-test`** — 2a rules, 2b executes.
- **No `ruledBy`, `ruledAt`, or any field recording adjudication** may be added to `ScreenEntry`.
- **No `kind: 'redirect'`** or any schema support for redirects.
- **Do not solve the T3 frameless-`deprecated` gap.** It has no live instance after this phase.
- **Do not re-open any LOCKED ruling** in `decision-register.md` §1 or §2.
- Every assertion added here is written over code that already exists and **cannot fail first** —
  `CLAUDE.md` §7 requires mutation-checking each one: break the thing it guards, watch it go red,
  restore, and report both outputs in the commit message.
- Gate before every commit: `npx tsc --noEmit` · `npx vitest run` · `npx next lint` (0 errors;
  77 warnings is the unchanged baseline = 54 `no-non-null-assertion` + 23 `no-unused-vars`).
- Branch: `screen-registry-phase-2a`, already created off master `c03011f`.

## The four locked guards (user, 2026-08-13)

| # | Guard | Enforced by |
|---|---|---|
| **G1** | Rename completeness — `legacy-unreviewed` survives nowhere current | Task 1 (compile) + Task 4 (sweep, run to exhaustion per `L-024`) |
| **G2** | Backfill exactness — the *set* is evidence-licensed, not merely the right *count* | Task 2, set-equality assertion |
| **G3** | No decision data in the registry — no `ruledBy`/`ruledAt` | Task 1, strengthened R12 test (both directions) |
| **G4** | `jlpt-test` separation — the 2a diff touches no route implementation | Task 5, `git diff --name-only` assertion |

---

## File Structure

| File | Responsibility in 2a |
|---|---|
| `lib/product/screen-registry-types.ts` | Modify — one union member renamed. The only type change. |
| `lib/product/screen-registry.ts` | Modify — 23 reason values renamed, 23 `figmaCheckedAt` backfilled, comments added to 22 entries. Data + prose only. |
| `lib/product/screen-registry.test.ts` | Modify — T9/T10/R12 de-vacuified; new G2 set-equality test. |
| `lib/product/nav-groups.ts` | Modify — one comment referencing the old member name. |
| `docs/superpowers/specs/2026-08-08-screen-registry-design.md` | Modify — R13, T10, §5, §7 risk 6. |
| `docs/product/screen-inventory.md` | Modify — stale "Still open" and "Not yet adjudicated" lists. |
| `docs/product/decision-register.md` | Modify — the `jlpt-test` ruling, as **A16**. |
| `.serena/memories/screen_registry_inputs.md` | Modify — correction banner; it is read as current but written 2026-08-11. |

---

### Task 1: Rename the enum member, and de-vacuify the tests that guard it

**Files:**
- Modify: `lib/product/screen-registry-types.ts:4`
- Modify: `lib/product/screen-registry.ts` (23 occurrences of the value, 2 in comments)
- Modify: `lib/product/nav-groups.ts:12`
- Test: `lib/product/screen-registry.test.ts:56-85`

**Interfaces:**
- Produces: `RepoOnlyReason = "out-of-design-scope" | "no-frame-at-last-pass"`. Every later task and
  all of Phase 2b reads this union. The removed member name is `"legacy-unreviewed"`.

- [ ] **Step 1: Strengthen T9, T10 and R12 first — they are vacuity-prone today**

All three iterate a collection gathered by a pattern with no non-emptiness assertion, so an empty
registry would make them green (`CLAUDE.md` §7). R12 also only checks that present keys are allowed,
never that all 12 are present — so a *missing* field passes. Replace lines 56-85 of
`lib/product/screen-registry.test.ts` with:

```ts
  it("T9: repoOnlyReason is present iff the entry is repo-only", () => {
    const repoOnly = SCREEN_REGISTRY.filter((e) => e.kind === "repo-only");
    // Non-vacuity: without this, an empty filter makes every assertion below
    // unconditionally true (CLAUDE.md §7).
    expect(repoOnly.length).toBeGreaterThan(0);
    for (const entry of SCREEN_REGISTRY) {
      if (entry.kind === "repo-only") {
        expect(entry.repoOnlyReason, entry.screenId).not.toBeNull();
      } else {
        expect(entry.repoOnlyReason, entry.screenId).toBeNull();
      }
    }
  });

  it("T10: out-of-design-scope is restricted to admin chrome", () => {
    const outOfScope = SCREEN_REGISTRY.filter(
      (e) => e.repoOnlyReason === "out-of-design-scope",
    );
    expect(outOfScope.length).toBeGreaterThan(0);
    for (const entry of outOfScope) {
      expect(entry.chrome, entry.screenId).toBe("admin");
    }
  });

  it("R12: every entry carries exactly the twelve allowed fields", () => {
    // The concrete guard on R1. If someone adds `copy`, `layout`, `colors` or
    // `dataNeeds`, the registry has started becoming a second Figma. It is
    // also G3: `ruledBy` / `ruledAt` cannot be added without failing here.
    // Checked in BOTH directions — the older form only rejected unknown keys,
    // so an entry missing a field passed.
    const ALLOWED = [
      "screenId", "name", "kind", "variantOf", "figmaNodeId", "repoOnlyReason",
      "figmaCheckedAt", "route", "chrome", "impl", "navGroup", "navOrder",
    ];
    expect(ALLOWED).toHaveLength(12);
    expect(SCREEN_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of SCREEN_REGISTRY) {
      expect(Object.keys(entry).sort(), entry.screenId).toEqual([...ALLOWED].sort());
    }
  });
```

- [ ] **Step 2: Mutation-check all three, one at a time**

These are guards over existing code and cannot fail first. For each, break the guarded thing, record
the red output, restore, confirm green.

Run: `npx vitest run lib/product/screen-registry.test.ts`

```bash
# T9 non-vacuity: temporarily change the filter to kind === "nonexistent"
#   Expected: FAIL "expected +0 to be greater than 0"
# T10 non-vacuity: same, filter on a reason that no entry has
#   Expected: FAIL "expected +0 to be greater than 0"
# R12 both-directions: temporarily delete `navOrder` from ONE entry in
#   screen-registry.ts (e.g. `landing-page`)
#   Expected: FAIL naming that entry, arrays differing by "navOrder"
```

Record each red output verbatim; it goes in the Step 6 commit message.

- [ ] **Step 3: Rename the union member**

`lib/product/screen-registry-types.ts:4`:

```ts
export type RepoOnlyReason = "out-of-design-scope" | "no-frame-at-last-pass";
```

- [ ] **Step 4: Let the compiler enumerate every site, then fix them**

Run: `npx tsc --noEmit`
Expected: errors at every `repoOnlyReason: "legacy-unreviewed"` in
`lib/product/screen-registry.ts` — 23 of them. This is the completeness proof for G1 in code; do
**not** hand-search for them.

Replace each with `repoOnlyReason: "no-frame-at-last-pass"`. Then fix the two prose mentions:
- `lib/product/screen-registry.ts` — the section header comment near line 650 (`repo-only,
  legacy-unreviewed unless chrome is admin`) and the `playlists` comment's "named debt for Phase 2".
- `lib/product/nav-groups.ts:12` — `internal debt labels (\`legacy-unreviewed\`, \`figmaCheckedAt\`)`
  becomes `internal survey fields (\`repoOnlyReason\`, \`figmaCheckedAt\`)`.

- [ ] **Step 5: Verify — rename is complete in code, and nothing else moved**

```bash
npx tsc --noEmit                                   # expect exit 0
npx vitest run lib/product/                        # expect all green
grep -rn "legacy-unreviewed" lib/ ; echo "exit=$?" # expect NO matches (exit=1)
git diff --stat                                    # expect only the 4 files above
```

- [ ] **Step 6: Commit**

```bash
git add lib/product/
git commit -m "refactor(registry): legacy-unreviewed -> no-frame-at-last-pass"
```

The message must carry the three mutation-check outputs from Step 2 and state that `tsc` — not a
hand search — enumerated the 23 call sites.

---

### Task 2: Backfill `figmaCheckedAt` from citations, and lock the exact set

**Files:**
- Modify: `lib/product/screen-registry.ts` (23 entries)
- Test: `lib/product/screen-registry.test.ts` (new test, append to the existing `describe`)

**Interfaces:**
- Consumes: the renamed union from Task 1.
- Produces: exactly **74** entries with a non-null `figmaCheckedAt`, and exactly **5** with `null` —
  the five `/admin/*` screenIds. Task 4's documentation edits state this figure.

- [ ] **Step 1: Write the failing test first — set equality, not count (G2)**

Append to `lib/product/screen-registry.test.ts`:

```ts
  it("G2: figmaCheckedAt is null on exactly the out-of-design-scope entries", () => {
    // Phase 2a backfilled the stamp from CITATIONS, never from membership in
    // `repo-only`. Every entry the Phase 0 pass demonstrably examined carries
    // that pass's own date, 2026-08-12.
    //
    // The five /admin/* routes deliberately keep `null`: `out-of-design-scope`
    // means Figma will never cover them, so "compared against Figma at time X"
    // (R7) is not a claim that can honestly be made about them. A null here
    // therefore means one of two true things — never compared, or never
    // comparable — and never "we forgot".
    //
    // Asserted as a SET, not a count: a blanket stamp that happened to hit the
    // right total would pass a count assertion and fail this one.
    const unstamped = SCREEN_REGISTRY.filter((e) => e.figmaCheckedAt === null)
      .map((e) => e.screenId)
      .sort();
    expect(unstamped).toEqual([
      "admin",
      "admin-content",
      "admin-content-type",
      "admin-style-guide",
      "admin-videos",
    ]);

    const stamped = SCREEN_REGISTRY.filter((e) => e.figmaCheckedAt !== null);
    expect(stamped).toHaveLength(74);
    for (const entry of stamped) {
      expect(entry.figmaCheckedAt, entry.screenId).toBe("2026-08-12");
    }
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/product/screen-registry.test.ts -t "G2"`
Expected: FAIL — the received array holds 28 ids (the 23 below plus the 5 admin ones), because no
backfill has happened yet.

- [ ] **Step 3: Backfill the 23, each licensed by a citation**

In `lib/product/screen-registry.ts`, set `figmaCheckedAt: "2026-08-12"` on exactly these entries.
**Change nothing else on them.** The citation column is why each one is licensed — verify the line
says what this table claims before changing the entry; if any does not, stop and report it rather
than stamping it.

| # | screenId | Citation |
|---|---|---|
| 1 | `kanji` | registry comment — `screen-inventory.md` §6.0 |
| 2 | `vocab` | registry comment §4 · `screen-inventory.md:217` |
| 3 | `grammar` | registry comment — §17.1 |
| 4 | `reading` | registry comment · `screen-inventory.md:192` |
| 5 | `review` | registry comment §3 · `:203` · `:239` |
| 6 | `mining` | registry comment §3 · `:205` |
| 7 | `playlists` | registry comment (R6) · `:206` |
| 8 | `challenges` | registry comment §3 · `:207` |
| 9 | `community` | registry comment §3 · `:192` |
| 10 | `leaderboard` | registry comment · `:192` |
| 11 | `weeklyReport` | registry comment §12.4 · `:208` |
| 12 | `statistics` | registry comment §3 · `:207` |
| 13 | `achievements` | registry comment §3 · `:207` |
| 14 | `landing-page` | registry comment — §19.0 |
| 15 | `jlpt-test` | registry comment · `:210` |
| 16 | `register` | `screen-inventory.md:201` · `:239-240` |
| 17 | `community-detail` | `screen-inventory.md:192-193` |
| 18 | `community-peer-review` | `screen-inventory.md:192-193` |
| 19 | `reading-detail` | `screen-inventory.md:192-193` |
| 20 | `vocab-detail` | `screen-inventory.md:192-193` · `:217` |
| 21 | `vocab-review` | `screen-inventory.md:192-193` · `:217` |
| 22 | `mining-review` | `screen-inventory.md:205` |
| 23 | `playlists-detail` | `screen-inventory.md:206` |

- [ ] **Step 4: Run the test and watch it pass**

Run: `npx vitest run lib/product/screen-registry.test.ts -t "G2"`
Expected: PASS.

- [ ] **Step 5: Mutation-check the set assertion in both directions**

```bash
# (a) Over-stamp: set figmaCheckedAt on `admin-videos` too.
#     Expected: FAIL — received array is missing "admin-videos"
# (b) Under-stamp: revert `register` to null.
#     Expected: FAIL — received array has an extra "register"
# Restore after each; confirm green.
```

(b) is the important one: it proves the test catches a *missed* entry, which a count-only assertion
that happened to balance would not.

- [ ] **Step 6: Full gate, then commit**

```bash
npx tsc --noEmit && npx vitest run && npx next lint
git add lib/product/
git commit -m "feat(registry): backfill figmaCheckedAt from citations, not membership"
```

Message carries both mutation outputs and states the 74/5 split with the admin rationale.

---

### Task 3: Write the governing ruling into each entry's comment

**Files:**
- Modify: `lib/product/screen-registry.ts` (22 entries — 15 group A, 7 group B)

**Interfaces:**
- Consumes: nothing new. Comment-only task; **no field values change.**
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm this task changes no data**

Before starting, note the invariant for Step 4: `git diff` for this task must show only comment
lines. If a field value changes, the task has exceeded its scope.

- [ ] **Step 2: Group A — the 15, named individually**

`L-023` is exactly this shape: a collective claim ("all legacy entries adjudicated") is how fourteen
get done and the fifteenth ships unnoticed. Tick each one.

Add or correct the comment above each entry so it cites the ruling that already governs it. Entries
marked *(none today)* have **no comment at all** — that absence is why `register` was nearly
misfiled as an open question.

- [ ] 1. `vocab` — **A10**, hidden, code kept, explicitly not `deprecated` *(comment exists; keep, drop "debt" phrasing if present)*
- [ ] 2. `reading` — **A10**, same terms *(exists)*
- [ ] 3. `community` — **A10**, product reason: an empty community advertises emptiness *(exists)*
- [ ] 4. `leaderboard` — **A10**, same reason *(exists)*
- [ ] 5. `challenges` — **A5**, absorbed into Roadmap *(exists)*
- [ ] 6. `weeklyReport` — **A2**, absorbed into Companion; §12.4 rules OUT `Growth Areas` as its frame *(exists)*
- [ ] 7. `statistics` — **A4**, absorbed into the Dashboard *(exists)*
- [ ] 8. `achievements` — **A4**, summary on Dashboard, gallery on Profile *(exists)*
- [ ] 9. `playlists` — **A11**, stays its own screen *(exists; remove "named debt for Phase 2")*
- [ ] 10. `mining` — **A7**, relabelled `Collection`; `screenId` deliberately unchanged *(exists)*
- [ ] 11. `landing-page` — **P16**, no landing page exists yet, known and accepted *(exists; add the P16 citation, which is currently missing)*
- [ ] 12. `register` — `screen-inventory.md:201` *"Figma has `Login` but no register frame"*; `:239-240` lists it frameless-without-conflict ***(none today)***
- [ ] 13. `kanji` — nav row under **A1**; `repo-only` by judgement call, §6.0 *(exists)*
- [ ] 14. `grammar` — nav row under **A1**; §17.1 judgement call *(exists)*
- [ ] 15. `review` — nav row under **A1**; frameless, §3 *(exists)*

- [ ] **Step 3: Group B — the 7 sub-routes, each naming its parent's ruling**

All seven have **no comment at all** today. Each gets one stating that it inherits, so none of them
ever reads as independent debt again. Example wording for `vocab-detail`:

```ts
  // Inherits /vocab's ruling (A10): hidden, code kept, not deprecated. This is
  // not an independent decision — an acquisition-loop sub-route is reached by
  // drilling into its parent and is never a nav row of its own.
  // Frameless per `screen-inventory.md:192-193`, which names it explicitly.
```

- [ ] 1. `community-detail` — parent `/community`, **A10**
- [ ] 2. `community-peer-review` — parent `/community`, **A10**
- [ ] 3. `reading-detail` — parent `/reading`, **A10**
- [ ] 4. `vocab-detail` — parent `/vocab`, **A10**
- [ ] 5. `vocab-review` — parent `/vocab`, **A10**
- [ ] 6. `playlists-detail` — parent `/playlists`, **A11**
- [ ] 7. `mining-review` — parent `/mining`, **A7**

- [ ] **Step 4: Verify no data moved, then commit**

```bash
npx tsc --noEmit && npx vitest run lib/product/
git diff -U0 lib/product/screen-registry.ts | grep -E "^[+-]" | grep -vE "^[+-]{3}" | grep -vE "^[+-]\s*//"
# Expected: NO OUTPUT. Any line here is a data change and must be reverted.
git add lib/product/screen-registry.ts
git commit -m "docs(registry): cite the ruling that governs each repo-only entry"
```

---

### Task 4: Amend the spec and the stale lists, sweeping to exhaustion

**Files:**
- Modify: `docs/superpowers/specs/2026-08-08-screen-registry-design.md` (R13, T10, §5, §7 risk 6)
- Modify: `docs/product/screen-inventory.md` (`:197-211`, `:255-265`)
- Modify: `.serena/memories/screen_registry_inputs.md`

- [ ] **Step 1: Amend the design spec's four sites**

- **R13 rationale** — delete "…where Phase 2 counts it as debt". A reason member records an
  observation (R6), not a verdict.
- **T10** — logic unchanged (`out-of-design-scope` ⇒ `chrome === 'admin'`); rename the other member
  where the prose names it.
- **§5** — the Phase 2 work-list clause must stop naming the enum. Replace the generator with:
  *entries whose `figmaCheckedAt` is null or stale*. Note in one line that Phase 2a measured the
  original clause and found 21 of 23 were never debt.
- **§7 risk 6** — "everything else lands in `legacy-unreviewed`, which is countable and reported by
  Phase 2" → rename, and drop the debt framing while keeping the anti-dumping-ground point, which
  is still true and still the reason the enum has no "unknown" member.

- [ ] **Step 2: Clean the two stale lists in `screen-inventory.md`**

These are a **false backlog for this very phase** — the reason this is reconciliation and not scope
creep.

- `:255-265` "### Still open" — item **1** (the vocab-shelf conflict) is resolved **at `:1502-1506`
  of the same file**: the shelf sits inside Companion home, so it is companion-owned and hiding
  `/vocab` costs it nothing. Item **3** is settled by **A12**, item **7** by **A11**. Strike those
  three, each with a pointer to what settled it. Leave items 2, 4, 5, 6 open — they are genuinely
  open and **not** in 2a's scope.
- `:197-211` "Not yet adjudicated" — retitle and mark each row that now has a ruling, pointing at
  `decision-register.md` §2. `/jlpt-test`'s row points at **A16** from Task 5.

- [ ] **Step 3: Add a correction banner to the inputs memory**

`.serena/memories/screen_registry_inputs.md` is dated 2026-08-11 but is read as current. Add at the
top — do not rewrite its body, which is a historical record:

```markdown
> ⚠️ **CORRECTION (2026-08-13).** Two claims below are stale. **A10 shipped in Phase 1b**, not
> Phase 2 — all four routes carry `navGroup: null` at HEAD. And `legacy-unreviewed` was renamed to
> `no-frame-at-last-pass` in Phase 2a, which also measured that 21 of the 23 entries it labelled
> were never debt. **The registry at HEAD is the current inventory; this file is historical input.**
```

- [ ] **Step 4: G1 — sweep to exhaustion, not to the first hit**

`L-024`'s newest evidence is a sweep on this branch family that stopped at its first hit.

```bash
grep -rn "legacy-unreviewed" --exclude-dir=.git .
```

Expected survivors, and **only** these — every one a dated historical artifact that must keep the
old name to stay a true record of its own moment:
- `docs/superpowers/plans/2026-08-12-screen-registry-phase-1a.md` (3)
- `docs/superpowers/specs/2026-08-13-screen-registry-phase-2a-design.md` (6 — it quotes the old name
  to explain the rename)
- `.serena/memories/screen_registry_inputs.md` (3, now under the correction banner)

Zero in `lib/`, zero in `docs/product/`, zero in the 2026-08-08 design spec. Then sweep the debt
phrasing too, which the rename does not catch:

```bash
grep -rniE "phase 2 debt|named debt" --exclude-dir=.git .
```

- [ ] **Step 5: Commit**

```bash
git add docs/ .serena/
git commit -m "docs(spec): a reason member is an observation, not debt"
```

---

### Task 5: Adjudicate `jlpt-test` — the ruling only

**Files:**
- Modify: `docs/product/decision-register.md` (§2 table + prose)

- [ ] **Step 1: Add A16 to the §2 table**

```markdown
| A16 | **`/jlpt-test` is dead route code — remove it in 2b.** No callers; its redirect target is itself superseded by A9 | ruled 2026-08-13 · execution deferred to **2b** |
```

- [ ] **Step 2: Write the ruling's prose, with the measurement that supports it**

```markdown
**A16 — `/jlpt-test` is dead route code and is removed in Phase 2b.** The route is eight lines, a
bare `redirect()` to `/jlpt`, commented *"Old placeholder route — the JLPT test engine now lives at
`/jlpt` (Layer 5)"*. Measured 2026-08-13: **no app code references the route** — every `jlpt-test`
hit in code is a component filename (`jlpt-test-runner` / `-list` / `-card`).

Three names exist for one thing, which is why this is a reconciliation item and not a cleanup:
`japanese-learning-app-spec.md:76` says `/jlpt-test`, the repo runs `/jlpt`, and **A9** locks
`/certification`.

⚠️ **2a rules; 2b executes.** Phase 2b performs exactly four edits: delete
`app/[locale]/(protected)/(app)/jlpt-test/page.tsx`; delete `/jlpt-test` from `PROTECTED_PREFIXES`
(`lib/supabase/route-protection.ts:14`); amend `japanese-learning-app-spec.md:76`; and
**mutation-check** `lib/supabase/route-protection.test.ts` — its filesystem-driven coverage test is
the existing guard for this class, and 2b must prove it goes RED on a prefix left behind for a
deleted route rather than run it green and call that evidence.

**No `kind: 'redirect'` was added.** Doing so in 2a would model a hypothetical 2b redirect. If 2b
genuinely needs `/jlpt` → `/certification` to survive as one, that is a real artifact with a real
shape and the schema decision can be made against it then.
```

- [ ] **Step 3: G4 — prove the whole branch touched no route implementation**

```bash
git diff --name-only master...HEAD
```

Expected: **no path beginning `app/`, `supabase/`, or `components/`.** If any appears, 2a has
executed something it was only allowed to rule on. This is the guard, so run it and paste the
output; do not assert it from memory.

- [ ] **Step 4: Full gate, then commit**

```bash
npx tsc --noEmit && npx vitest run && npx next lint && npx next build
git add docs/product/decision-register.md
git commit -m "feat(product): A16 — /jlpt-test is dead route code, removed in 2b"
```

---

### Task 6: Whole-branch review and close-out

**Files:** none — review and records only.

- [ ] **Step 1: Re-run the four guards and paste real output**

```bash
grep -rn "legacy-unreviewed" lib/ docs/product/ docs/superpowers/specs/2026-08-08-*.md  # G1: none
npx vitest run lib/product/screen-registry.test.ts -t "G2"                              # G2: pass
npx vitest run lib/product/screen-registry.test.ts -t "R12"                             # G3: pass
git diff --name-only master...HEAD | grep -E "^(app|supabase|components)/"              # G4: none
```

- [ ] **Step 2: Whole-branch review**

`CLAUDE.md` §9 requires it even when every task was reviewed on its own (`L-011`). Dispatch
`code-reviewer` over `master...HEAD`. Point it at: the spec, the four guards, and the fact that
**this branch is meant to contain zero application-code changes** — a single `app/` path in the diff
is a Critical finding on its own.

- [ ] **Step 3: Close the review, then review the fix wave**

`L-012`: a fix wave earns its own review. If the wave changes no application code and its assertions
are mutation-checked, that may be recorded as the reason not to recurse further — state it, do not
skip it silently.

- [ ] **Step 4: Record lessons and update memory**

`CLAUDE.md` §9 — write to `docs/lessons.md` per its four entry rules, merging into an existing entry
where one applies rather than appending. Update `.serena/memories/screen_registry_run_state.md` **in
the same pass that changes what it describes** (`L-026`'s newest evidence is that memory going stale
at a branch tip).

- [ ] **Step 5: Merge**

```bash
git checkout master && git merge --no-ff screen-registry-phase-2a
```

Then Phase 2b: A9 `/jlpt` → `/certification` plus its migration, and A16's execution.

---

## Self-Review

**Spec coverage.** §3a.1 → Task 1 + Task 4. §3a.2 → Task 2. §3a.3 → Task 3 (comments) + Task 4
(stale lists). §3a.4 → Task 5. §4 (T3 left open, 33 `impl:'none'` confirmed as fact not commitment)
→ Global Constraints + no task touches them, which is the correct implementation of "leave open".
§5 verification → each task's gate plus Task 6. §6 order → Global Constraints. §7 out-of-scope →
Global Constraints + G4.

**Placeholder scan.** No TBD/TODO. Every code step carries the actual code; every table row carries
the actual citation; every mutation-check names the expected failure text.

**Type consistency.** `RepoOnlyReason` is defined once in Task 1 and referenced by that exact name
in Tasks 2 and 4. `figmaCheckedAt`, `repoOnlyReason`, `screenId`, `navGroup`, `navOrder` match
`ScreenEntry` in `lib/product/screen-registry-types.ts`. The 74/5 split in Task 2 Step 1 matches
Task 2's Interfaces block and Task 4's documentation edits.

**One decision this plan makes that the spec did not.** The spec's backfill table says "cited
evidence ⇒ stamp". Measurement then found that **all 28** repo-only entries have a citation,
including the five `/admin/*` routes via `screen-inventory.md:211`. Stamping those five would assert
a Figma comparison that never happened and, being `out-of-design-scope`, never will — so they keep
`null`, and the reason is written into the G2 test itself. This is flagged rather than buried: it is
a judgement call about five entries, and reversing it means changing one array in one test.
