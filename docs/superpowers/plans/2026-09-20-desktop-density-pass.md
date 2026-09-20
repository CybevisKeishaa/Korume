# Desktop Density Pass Implementation Plan

> **For agentic workers:** this repository runs the two-harness protocol
> (`.codex/docs/workflow.md` §8). **Codex implements this plan** task by task, under TDD, running
> `code-reviewer` and checkpointing `docs/superpowers/run-state/desktop-density-pass.md` after each
> accepted task. Claude reviews the whole branch afterwards and merges. Do not dispatch subagents
> per task; that is the other harness's workflow, not this repo's. Steps use checkbox (`- [ ]`)
> syntax for tracking.

**Goal:** make the app shell render at a 1280 CSS viewport the composition it was designed to
render, which today only appears at browser zoom 90%.

**Architecture:** four shell dimensions were ported as pixel constants off a 1536-wide Figma canvas.
Each becomes either a share of the canvas (rail width, search-field width) or the token that was
already measured and left unused (sidebar width, card radius). No new token, no new breakpoint, no
change to the type scale.

**Tech Stack:** Next.js App Router, React 18, Tailwind (tokens in `app/globals.css`, mapped in
`tailwind.config.ts`), Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-20-desktop-density-pass-design.md` — read it first; §2 is
the measurement table every number below comes from, and §4 is the five decisions.

## Global Constraints

- **No new token, no new breakpoint, no type-scale change** (spec D5). One token is *removed*:
  `--radius-xl`.
- **Every number written here is either an existing token or a frame measurement recorded in spec
  §2.** Do not round, re-derive or "improve" a value; if one looks wrong, stop and say so.
- **Do not touch the public marketing header or footer.** Measured 1:1 with frame `347:6277`, which
  is itself 1280 wide (spec §3). Changing them would be a regression.
- **Do not touch the type scale.** Body 14 px / caption 12 px match the frame.
- Commit message style: this repo writes a sentence, not a ticket id. End every commit with
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` only if Claude wrote the commit; Codex
  signs its own.
- Run tests from the worktree, not the main checkout.

## File Structure

| file | responsibility after this branch |
|---|---|
| `app/globals.css` | `--layout-companion-width` becomes a clamp; `--radius-xl` is deleted |
| `tailwind.config.ts` | `borderRadius.xl` mapping is deleted |
| `components/layout/two-column-shell.tsx` | owns the shell grid geometry; rail track is a share |
| `components/layout/app-nav.tsx` | consumes `w-sidebar` instead of a literal |
| `components/shadowing/hub-*.tsx` (5 files) | card surfaces at `rounded-lg` |
| `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx` | one card surface + the search row cap |
| `components/style-guide/token-sections.tsx`, `style-guide.test.tsx` | the radius scale they document loses its `xl` rung |
| `docs/design/screens/adaptive-layouts.md` | gains the frame-fidelity rule the next port follows |

---

### Task 1: The sidebar consumes the token that already exists (D2)

Smallest change, no dependencies, and it proves the gate works before anything harder lands.

**Files:**
- Modify: `components/layout/app-nav.tsx:47`
- Test: `components/layout/app-nav.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing later tasks depend on. `w-sidebar` resolves to
  `var(--layout-sidebar-width)` = 224px, already mapped in `tailwind.config.ts:93`.

- [ ] **Step 1: Write the failing test**

Append inside the existing `describe("AppNav", …)` block in
`components/layout/app-nav.test.tsx`:

```tsx
  it("sizes the rail from the measured layout token, not a literal", () => {
    // --layout-sidebar-width is 224px, measured off Figma frame 149:2 and
    // exposed as w-sidebar. The literal w-60 (240px) that shipped here was
    // 7% wider than the frame and took that width out of the main column.
    renderNav();
    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("w-sidebar");
    expect(nav.className).not.toContain("w-60");
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/layout/app-nav.test.tsx -t "measured layout token"`
Expected: FAIL — the class list contains `w-60`, not `w-sidebar`.

- [ ] **Step 3: Make it pass**

In `components/layout/app-nav.tsx:47`, replace the `w-60` in that className with `w-sidebar`:

```tsx
          className="flex h-screen w-sidebar flex-col gap-1 border-r border-border bg-card p-4"
```

- [ ] **Step 4: Run the file's whole suite**

Run: `npx vitest run components/layout/app-nav.test.tsx`
Expected: PASS, every test in the file, no snapshot surprises.

- [ ] **Step 5: Commit**

```bash
git add components/layout/app-nav.tsx components/layout/app-nav.test.tsx
git commit -m "fix(nav): the sidebar uses the width that was measured for it"
```

---

### Task 2: The companion rail is a proportion (D1)

The defect the owner actually saw. Depends on nothing, but do it after Task 1 so the sidebar is
already at 224 when you measure the result.

**Files:**
- Modify: `app/globals.css:144`
- Modify: `components/layout/two-column-shell.tsx`
- Test: `components/layout/two-column-shell.test.tsx`

**Interfaces:**
- Consumes: Task 1's `w-sidebar` only indirectly (the acceptance number in Step 6 assumes it).
- Produces: `--layout-companion-width` changes meaning from "the rail's width" to "the rail's
  track", so **any consumer that applies it as an element width is now wrong**. Two exist:
  `two-column-shell.tsx` (fixed here) and `components/marketing/hero-video-card.tsx` (check it in
  Step 5 — if it uses the value as a fixed width on a non-grid element it must keep a constant,
  and the cleanest fix there is to inline `300px` with a comment rather than re-point the token).

- [ ] **Step 1: Write the failing tests**

Replace the two existing assertions that pin the old geometry. In
`components/layout/two-column-shell.test.tsx`, in the test named
`"keeps the rail sticky at its layout-token width"`, replace this line:

```tsx
    expect(rail.className).toContain("w-[--layout-companion-width]");
```

with:

```tsx
    // The rail is a GRID TRACK now, not an element width. A percentage in the
    // track resolves against the grid content box; the same percentage on the
    // aside would resolve against the track, i.e. 27.5% of 27.5%.
    expect(rail.className).toContain("w-full");
    expect(rail.className).not.toContain("w-[--layout-companion-width]");
```

And in the test named `"keeps main and rail in the desktop grid without hiding the rail"`, replace:

```tsx
    expect(shell.className).toContain("grid-cols-[minmax(0,1fr)_var(--layout-companion-width)]");
```

with:

```tsx
    // 27.5% is frame 149:2's rail, 339 of a 1240 container. 21.25rem (340px)
    // is that frame's own rail width, so the track never exceeds what was
    // drawn; 15rem is the floor below which the rail stops being usable.
    expect(shell.className).toContain("grid-cols-[minmax(0,1fr)_var(--layout-companion-width)]");
    expect(shell.className).not.toContain("_300px]");
```

Then add a new test at the end of the `describe` block, which is the one that pins the token itself:

```tsx
  it("defines the rail track as a share of the shell, capped at the frame width", async () => {
    // Read the declaration out of the stylesheet rather than the DOM: jsdom
    // does not resolve clamp(), so asserting a computed width here would be a
    // false green (docs/lessons.md: prove the subject exists first).
    const css = await import("node:fs/promises").then((fs) =>
      fs.readFile("app/globals.css", "utf8"),
    );
    expect(css).toContain("--layout-companion-width: clamp(15rem, 27.5%, 21.25rem);");
    expect(css).not.toContain("--layout-companion-width: 300px;");
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run components/layout/two-column-shell.test.tsx`
Expected: FAIL on the new token test and on the `w-full` assertion. The
`grid-cols-[…]` assertion still passes — the class text is unchanged, only the variable behind it
moves. That is intended: the `_300px]` negative is what makes it falsifiable.

- [ ] **Step 3: Change the token**

In `app/globals.css`, replace line 144 and extend the comment block above it:

```css
  /* The companion rail. A SHARE of the shell, not a constant: frame 149:2
     draws it 339 wide inside a 1240 container (27.3%), and shipping the
     constant meant the rail held 27.8% of the shell at a 1422 viewport but
     32.0% at 1280 — the main column, not the rail, absorbed the whole
     difference. 21.25rem (340px) is the frame's own rail width and caps the
     track; 15rem is the floor below which the rail stops being usable.
     Measured 2026-09-20; see the desktop-density-pass spec §2. */
  --layout-companion-width: clamp(15rem, 27.5%, 21.25rem);
```

- [ ] **Step 4: Fix the aside**

In `components/layout/two-column-shell.tsx`, the `<aside>`:

```tsx
        <aside
          aria-label={railLabel}
          className="sticky top-md-lg w-full shrink-0 self-start"
        >
```

And correct the docblock, which currently asserts the retired claim:

```tsx
/**
 * The Hub/Explore desktop content shell: a flexible main column beside an
 * optional sticky companion rail. Geometry lives here and nowhere else. The
 * rail is a share of the shell — 27.5%, frame 149:2's 339 of 1240 — capped at
 * that frame's own 340px. It was a fixed 300px until 2026-09-20; at a 1280
 * viewport that constant took 19% off the main column, which is the whole of
 * what read as "the right side is too big". The rail must never be the only
 * place information appears.
 */
```

- [ ] **Step 5: Check the other consumer**

Run: `grep -rn "layout-companion" components app`
Expected: three files — this one, its test, and `components/marketing/hero-video-card.tsx`. Open
the marketing one and read how it applies the value. If it sets a fixed element width outside a
grid track, replace the token there with a literal `300px` plus a one-line comment saying the
marketing card is not the app shell and does not share its track. If it is inside a grid track,
leave it. **Either way, say in the run state which of the two it was** — do not leave this silent.

- [ ] **Step 6: Run the suite and measure the result**

Run: `npx vitest run components/layout/`
Expected: PASS.

Then, with the dev server running, open `/vi/shadowing` at a **1280** viewport and evaluate:

```js
const shell = document.querySelector('main .grid');
getComputedStyle(shell).gridTemplateColumns;
```

Expected: roughly `684px 269px` (the exact split depends on the scrollbar). **If the first number
is still near 613, the change did not land** — the acceptance figure in the spec's §8 is ~684.
Record the actual string in the run state.

- [ ] **Step 7: Commit**

```bash
git add app/globals.css components/layout/two-column-shell.tsx components/layout/two-column-shell.test.tsx
git commit -m "fix(layout): the companion rail is a share of the shell, not 300 pixels"
```

---

### Task 3: One card radius, and the unused rung goes (D3)

**Files:**
- Modify: `components/shadowing/hub-companion-rail.tsx:39,44,49,54`
- Modify: `components/shadowing/hub-empty-state.tsx:16`
- Modify: `components/shadowing/hub-featured-hero.tsx:30`
- Modify: `components/shadowing/hub-lesson-card.tsx:43`
- Modify: `components/shadowing/hub-library-section.tsx:167`
- Modify: `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx:131`
- Modify: `app/globals.css` (delete `--radius-xl`), `tailwind.config.ts:79` (delete the `xl` key)
- Modify/Test: `components/style-guide/token-sections.tsx:53`,
  `components/style-guide/style-guide.test.tsx:79`

**Interfaces:**
- Consumes: nothing.
- Produces: the radius scale becomes `sm 8 / md 14 / lg 20`. After this task the class
  `rounded-xl` resolves to nothing at all, which is why the Tailwind key must go with the variable.

- [ ] **Step 1: Write the failing test**

Add to `components/style-guide/style-guide.test.tsx` (a new `it`, alongside the existing radius
table assertion):

```tsx
  it("has no radius rung that nothing draws", async () => {
    // Frame 149:2 draws rounded-[22px] on every card surface, from the
    // 339x225 rail card to the 873x280 featured hero. 28px was never in the
    // design, and an unused rung is how the sidebar defect survived: the
    // correct token sat there while the code hardcoded a different number.
    const fs = await import("node:fs/promises");
    const [css, tw] = await Promise.all([
      fs.readFile("app/globals.css", "utf8"),
      fs.readFile("tailwind.config.ts", "utf8"),
    ]);
    expect(css).not.toContain("--radius-xl");
    expect(tw).not.toContain('xl: "var(--radius-xl)"');
  });
```

And change the existing radius table entry at `style-guide.test.tsx:79` — delete the
`["rounded-xl", 28],` row.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run components/style-guide/style-guide.test.tsx`
Expected: FAIL — both files still contain the rung.

- [ ] **Step 3: Move the nine call sites**

In each of the six files listed above, change `rounded-xl` to `rounded-lg`. Nine occurrences, no
other edit. Verify with:

Run: `grep -rn "rounded-xl" components app`
Expected: only `components/style-guide/token-sections.tsx:53` remains at this point.

- [ ] **Step 4: Delete the rung**

In `app/globals.css`, delete the `--radius-xl: 28px;` line and amend the radius comment block so it
records why there are three rungs and not four:

```css
  /* Radius. `lg` moves 12px -> 20px to match the Figma cards (the design draws
     rounded-[22px] on EVERY card surface, from the 339x225 rail card to the
     873x280 featured hero — measured 2026-09-20). `sm` is kept because chips,
     badges and field interiors need a radius well below the card value. There
     is deliberately no `xl`: 28px appears nowhere in the design file, and the
     rung it occupied was being applied to 91px-tall cards, rounding 31% of
     their short side. Steps are ABSOLUTE, not calc()-derived. */
```

In `tailwind.config.ts`, delete the line `xl: "var(--radius-xl)",` from the `borderRadius` map.

In `components/style-guide/token-sections.tsx:53`, delete the
`{ cls: "rounded-xl", px: 28 },` entry.

- [ ] **Step 5: Run the affected suites**

Run: `npx vitest run components/style-guide/ components/shadowing/`
Expected: PASS. If a shadowing snapshot pins `rounded-xl`, update it and **read the diff** — it
should contain nothing but the radius class.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css tailwind.config.ts components/shadowing components/style-guide "app/[locale]/(protected)/(app)/shadowing/explore/page.tsx"
git commit -m "fix(tokens): cards round at the radius the design actually draws"
```

---

### Task 4: The explore search field is a control, not a banner (D4)

**Files:**
- Modify: `app/[locale]/(protected)/(app)/shadowing/explore/page.tsx:82-85`
- Test: `app/[locale]/(protected)/(app)/shadowing/explore/page.test.tsx` — it already exists, it
  already renders the page as an async server component, and it already queries this form by its
  `search` role. Extend it; do not create a second file.

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

The assertion is on the markup, not on a computed width — jsdom does not resolve `clamp()`, so a
computed-width assertion here would pass while measuring nothing. Append inside
`describe("ExplorePage", …)`:

```tsx
  it("caps the search row at the frame width instead of filling the column", async () => {
    // Frame 200:7705 draws the field 440 wide inside a 1312 content region
    // (33.5%). Shipped, flex-1 on the input gave it 818px at a 1280 viewport.
    // 27.5rem = 440px is the frame value and the cap; 18rem is the floor.
    render(await ExplorePage({ searchParams: {} }));
    const input = screen.getByLabelText("shadowing.hub.sections.search");
    const row = input.parentElement as HTMLElement;

    expect(row.className).toContain("max-w-[clamp(18rem,33.5%,27.5rem)]");
    expect(input.className).toContain("h-10");
    expect(input.className).not.toContain("h-11");
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run "app/[locale]/(protected)/(app)/shadowing/explore/page.test.tsx" -t "caps the search row"`
Expected: FAIL — the row has no max-width and the input is `h-11`.

- [ ] **Step 3: Make it pass**

In `explore/page.tsx`, the wrapper and the input:

```tsx
            <div className="flex max-w-[clamp(18rem,33.5%,27.5rem)] gap-sm">
              <input id="explore-search" name="q" defaultValue={query.q} placeholder={tHub("search.placeholder")} className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-md text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
```

Leave the submit button's own classes alone; it sizes to its text and the row now bounds it.

- [ ] **Step 4: Run and check the rendered width**

Run: `npx vitest run "app/[locale]/(protected)/(app)/shadowing/explore/page.test.tsx"`
Expected: PASS, the whole file.

Then at a 1280 viewport on `/vi/shadowing/explore`:

```js
Math.round(document.querySelector('#explore-search').getBoundingClientRect().width);
```

Expected: roughly 250–320, not 818. Record the number in the run state.

- [ ] **Step 5: Commit**

```bash
git add "app/[locale]/(protected)/(app)/shadowing/explore" 
git commit -m "fix(explore): the search field stops at the width it was drawn"
```

---

### Task 5: Write down the rule, then gate the branch

The rule is the deliverable the owner actually asked for — every screen ported after this one
follows it. Without it this branch fixes four symptoms and teaches nothing.

**Files:**
- Modify: `docs/design/screens/adaptive-layouts.md` (append a section; the file uses `#`-level
  headings, not `##`)
- Modify: `docs/superpowers/run-state/desktop-density-pass.md`

- [ ] **Step 1: Append the rule**

At the end of `docs/design/screens/adaptive-layouts.md`:

```markdown
# Frame Fidelity: shares, not constants

A shell dimension read off a Figma frame is a **share of that frame's canvas**, not a pixel
constant — unless the element is a fixed control (icon button, avatar, form-row height).

- App frames in the Korume file are drawn on a **1536** canvas. The auth, error and membership
  batch and the marketing page are drawn on **1280**. Divide by the canvas the frame was drawn on.
- A constant is allowed only as the `max` of a `clamp()`, where it caps the share at the value the
  designer actually drew.
- A percentage belongs on the grid **track**, never on the element sitting in that track — a
  percentage there resolves against the track and applies itself twice.

Why this exists: the companion rail shipped as a fixed `300px` measured off a 1536 frame. At a 1422
viewport it held 27.8% of the shell, matching the frame's 27.3%; at 1280 it held 32.0% and the main
column lost 19% of its width. Nothing about the rail was wrong at the width it was drawn for. See
`docs/superpowers/specs/2026-09-20-desktop-density-pass-design.md`.
```

- [ ] **Step 2: Commit the rule**

```bash
git add docs/design/screens/adaptive-layouts.md
git commit -m "docs(design): a dimension off a frame is a share, not a constant"
```

- [ ] **Step 3: Run the full gate, reading each result**

```bash
npm run verify:protocol
npm run typecheck
npx vitest run --reporter=dot
npm run lint
npm run build
```

Playwright **is owed** on this branch — it changes rendered chrome on live routes. Two configs
apply and both are run:

```bash
npx playwright test --config=playwright.c3.config.ts   # testMatch: shadowing-explore.spec.ts
npm run test:e2e                                        # the default config, testDir tests/e2e
```

Record both results. If the default suite was already red on `master` at `ec402f6`, say so and
name the failing specs rather than attributing them to this branch.

- [ ] **Step 4: Measure at three widths**

On `/vi/shadowing` and `/vi/shadowing/explore`, at viewport widths **1280, 1422 and 1920**, record
`getComputedStyle(document.querySelector('main .grid')).gridTemplateColumns` for each. Expected
rail share: 27.5% at 1280 and 1422; capped at 340px by 1920. Put the six strings in the run state —
they are the evidence that D1 generalises rather than happening to work at one width.

- [ ] **Step 5: Checkpoint and hand back**

Fill in `## Accepted commits` and `## Verification` in
`docs/superpowers/run-state/desktop-density-pass.md` with the real figures, then change the owner
line to `- Owner: Claude` and commit. That line is the only handoff signal.

```bash
git add docs/superpowers/run-state/desktop-density-pass.md
git commit -m "docs(run-state): density pass measured and gated, handing back for review"
```

---

## Self-review against the spec

- **D1** — Task 2. **D2** — Task 1. **D3** — Task 3. **D4** — Task 4. **D5** — enforced by the
  Global Constraints and by Task 3's "no unused rung" test.
- **Spec §5's rule** — Task 5, Step 1.
- **Spec §7's tests** — T1 and the token pin in Task 2 Step 1; T2 in Task 1; T3 in Task 3 Step 1;
  T4 in Task 4; T5 is the "read the diff" instruction in Task 3 Step 5.
- **Spec §8's gate** — Task 5, Steps 3 and 4, including the ~684 px acceptance number, which Task 2
  Step 6 checks early so a failure surfaces before three more tasks land on top of it.
- **Not covered by any task, deliberately:** the public header and footer (spec §3 measured them
  correct), the type scale, and the Auth + Error port, which is the next branch.
