# Landing-page Motion Doctrine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each landing-page section its own motion mechanism and metaphor, bound by one shared thread grammar, so the page reads as authored rather than templated.

**Architecture:** Every section mechanism is plain CSS driven by the existing `RevealScope` IntersectionObserver, so the existing reduce-motion kill switch gates it for free. Exactly two new JS modules exist: a motion gate that mirrors the CSS kill switch's semantics, and a scroll-progress provider consumed by §1 Hero alone. No GSAP, no `animation-timeline`.

**Tech Stack:** Next.js 14 App Router · React 18 · TypeScript strict · Tailwind v3 · Vitest + RTL · Playwright

**Spec:** `docs/superpowers/specs/2026-09-04-landing-page-motion-doctrine-design.md` — read it first; this plan argues from it and does not restate its reasoning.

## Global Constraints

- **CLAUDE.md §2 r4 — reduce-motion.** No content may be hidden by motion in any state, including during a delay. Both kill-switch blocks carry `animation-delay: -1ms !important` and `transition-delay: 0s !important`. Never remove those lines.
- **CLAUDE.md §2 r5 / WCAG AA.** Keyboard reach and focus order unchanged. No scroll hijack.
- **Zero layout shift.** `transform` and `opacity` only. §6's mascot/rail alignment is asserted to 1px in e2e. Document height at 1280 is 4480px.
- **🔒 §4 (`pitch-showcase.tsx`, `pitch-chart.tsx`) and §6 (`capability-chain.tsx`) are FROZEN.** No task touches them. Forbidden: changing the mascot, the geometry, the score, adding a count-up, changing layout, or "cleaning up" their animation.
- **No new duration or easing literals.** Use the existing tokens: `--duration-fast` 150ms · `--duration-base` 300ms · `--duration-slow` 600ms · `--duration-cinematic` 1200ms · `--duration-stagger` 90ms · `--ease-standard` `ease-out` · `--ease-out-expo` `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Every new rule that hides content must carry `:not([data-reveal-failsafe])`**, and `REVEAL_GATE_COUNT` in `lib/design-tokens.test.ts` must be updated in the same commit.
- **No new DOM nodes where an attribute will do.** Attributes on existing elements cannot move measured geometry.
- **Tests first.** A guard written over code that already exists cannot fail first — mutation-check it and report both outputs (CLAUDE.md §7).
- **A collection gathered by a pattern must be asserted non-empty and of the size expected** (L-004), or an empty match makes it unconditionally green.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/motion/motion-enabled.ts` | The motion gate. Resolves "may JS animate now" by mirroring the CSS kill switch exactly. No React. |
| `lib/motion/motion-enabled.test.ts` | Unit tests for the gate, including both inputs and their four combinations. |
| `lib/motion/use-motion-enabled.ts` | `useSyncExternalStore` hook over the gate, for React consumers. |
| `components/motion/scroll-progress.tsx` | The scroll-progress provider. Writes `--section-progress` on opted-in sections. |
| `components/motion/scroll-progress.test.tsx` | Unit tests for the `[0,1]` mapping, deactivation and teardown. |
| `components/marketing/thread-segment.tsx` | The shared thread segment primitive. All morphologies are props, not new components. |
| `components/marketing/thread-segment.test.tsx` | Renders each morphology; asserts token consumption, not geometry. |

**Modified:**

| File | Change |
|---|---|
| `app/globals.css` | Thread tokens in `:root`; one new rule block per section mechanism. |
| `lib/design-tokens.test.ts` | Thread token contract; `REVEAL_GATE_COUNT` bumped per section task. |
| `components/marketing/recommendation-donut.tsx` | Sweep hooks on **both** dashed circles; stale docblock corrected. |
| `components/marketing/hero.tsx`, `hero-video-card.tsx` | Heading block mask-rise; interior sequencing; scroll-progress opt-in. |
| `components/marketing/problem.tsx`, `journey.tsx`, `trust.tsx`, `cta.tsx`, `signoff.tsx` | Section mechanism attributes. |
| `tests/e2e/landing-page.spec.ts` | One behavioural case per new mechanism, each with a positive control. |

**Untouched, deliberately:** `components/marketing/pitch-showcase.tsx`, `pitch-chart.tsx`, `capability-chain.tsx`, `lib/gsap.ts`.

---

# Phase 0 — the engine

Nothing in Phase 01+ may begin before all three tasks here land. The token contract must exist before the first segment renders, or §5 becomes the section that defines the dialect and every later section inherits its accidents.

---

### Task 1: The motion gate

**Files:**
- Create: `lib/motion/motion-enabled.ts`
- Create: `lib/motion/motion-enabled.test.ts`
- Create: `lib/motion/use-motion-enabled.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `motionEnabled(): boolean` · `subscribeMotionEnabled(onChange: (enabled: boolean) => void): () => void` · `REDUCE_MOTION_ATTR: "data-reduce-motion"` · `REDUCE_MOTION_QUERY: "(prefers-reduced-motion: reduce)"` · `useMotionEnabled(): boolean`

**Why this shape.** `app/globals.css` disables motion from **two independent blocks** — `@media (prefers-reduced-motion: reduce)` at line ~614 and `:root[data-reduce-motion="true"]` at line ~627. Either one alone disables it. That is an **OR**, and the gate must reproduce it exactly. If the gate used AND, or read only the attribute, CSS would hold an element static while JS kept animating it: the two lanes would disagree and the disagreement would be invisible to any test that checks only one.

⚠️ `themeInitScript` in `components/providers/theme-provider.tsx` already seeds `data-reduce-motion` from `localStorage` or, when unset, from the OS query. It seeds it **once, before paint** — nothing updates it when the OS setting changes mid-session. Reading the live media query as well is what closes that gap.

- [ ] **Step 1: Write the failing test**

```ts
// lib/motion/motion-enabled.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { motionEnabled, subscribeMotionEnabled, REDUCE_MOTION_ATTR } from "./motion-enabled";

/** Drives the OS query independently of the attribute, so the OR is testable. */
function mockOsReduce(matches: boolean) {
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      addEventListener: (_: string, l: () => void) => listeners.add(l),
      removeEventListener: (_: string, l: () => void) => listeners.delete(l),
    })),
  );
  return listeners;
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute(REDUCE_MOTION_ATTR);
});

describe("motionEnabled", () => {
  it("is true only when NEITHER the OS nor the app asks for reduced motion", () => {
    mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    expect(motionEnabled()).toBe(true);
  });

  // The OR, one row per combination. This is the whole point of the module:
  // globals.css disables motion from two independent blocks, so either input
  // alone must disable it here too.
  it.each([
    { os: true, app: "false", name: "OS alone" },
    { os: false, app: "true", name: "app toggle alone" },
    { os: true, app: "true", name: "both" },
  ])("is false when $name asks for reduced motion", ({ os, app }) => {
    mockOsReduce(os);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, app);
    expect(motionEnabled()).toBe(false);
  });

  it("treats a missing attribute as 'not reduced' and defers to the OS", () => {
    mockOsReduce(false);
    expect(motionEnabled()).toBe(true);
  });

  it("notifies subscribers when the app toggle mutates after subscribing", async () => {
    mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    const seen: boolean[] = [];
    const unsubscribe = subscribeMotionEnabled((enabled) => seen.push(enabled));

    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "true");
    await vi.waitFor(() => expect(seen).toContain(false));

    unsubscribe();
  });

  it("stops notifying after unsubscribe", async () => {
    mockOsReduce(false);
    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "false");
    const seen: boolean[] = [];
    subscribeMotionEnabled((enabled) => seen.push(enabled))();

    document.documentElement.setAttribute(REDUCE_MOTION_ATTR, "true");
    await new Promise((r) => setTimeout(r, 20));
    expect(seen).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/motion/motion-enabled.test.ts`
Expected: FAIL — `Failed to resolve import "./motion-enabled"`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/motion/motion-enabled.ts

/** The attribute `themeInitScript` sets on <html> before paint. */
export const REDUCE_MOTION_ATTR = "data-reduce-motion";
export const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * May JS animate right now?
 *
 * ⚠️ This is an OR, and it mirrors `app/globals.css` rather than deciding
 * anything of its own. That file disables motion from two independent blocks —
 * `@media (prefers-reduced-motion: reduce)` and `:root[data-reduce-motion="true"]`
 * — so either input alone is enough. A gate that ANDed them, or read only the
 * attribute, would let JS keep animating an element CSS is holding static, and
 * nothing that tests one lane would see it.
 *
 * ⚠️ The attribute alone is not sufficient either: `themeInitScript` seeds it
 * once before paint and never updates it, so an OS setting changed mid-session
 * is visible only through the live media query.
 *
 * Server-side there is no document, and the safe answer is "no motion" — SSR
 * markup is then the static state, which is also what a reduce-motion reader
 * must receive.
 */
export function motionEnabled(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const osReduces = window.matchMedia(REDUCE_MOTION_QUERY).matches;
  const appReduces =
    document.documentElement.getAttribute(REDUCE_MOTION_ATTR) === "true";
  return !(osReduces || appReduces);
}

/**
 * Calls `onChange` whenever the answer changes. Watches both inputs: the media
 * query directly, and the attribute through a MutationObserver, because the app
 * toggle mutates `<html>` and fires no event.
 *
 * Returns an unsubscribe that removes both watchers. Consumers MUST call it —
 * React StrictMode double-mounts in dev.
 */
export function subscribeMotionEnabled(
  onChange: (enabled: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  let last = motionEnabled();
  const emit = () => {
    const next = motionEnabled();
    if (next === last) return;
    last = next;
    onChange(next);
  };

  const query = window.matchMedia(REDUCE_MOTION_QUERY);
  query.addEventListener("change", emit);

  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [REDUCE_MOTION_ATTR],
  });

  return () => {
    query.removeEventListener("change", emit);
    observer.disconnect();
  };
}
```

```ts
// lib/motion/use-motion-enabled.ts
"use client";

import { useSyncExternalStore } from "react";

import { motionEnabled, subscribeMotionEnabled } from "./motion-enabled";

/**
 * React's view of the gate. The server snapshot is `false` so the markup React
 * hydrates against is the static state — the same state a reduce-motion reader
 * keeps, and never a frame of animation assumed before the gate is readable.
 */
export function useMotionEnabled(): boolean {
  return useSyncExternalStore(
    subscribeMotionEnabled,
    motionEnabled,
    () => false,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/motion/motion-enabled.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the OR is load-bearing (mutation check)**

Change `return !(osReduces || appReduces);` to `return !(osReduces && appReduces);`, re-run, and record the output. Expected: the two single-input rows fail. Restore, re-run, record PASS. Report **both** outputs — an OR asserted only by a green suite is not asserted (CLAUDE.md §7).

- [ ] **Step 6: Verify types and lint**

Run: `npx tsc --noEmit` — expected exit 0.
Run: `npm run lint` — expected 0 errors, warning mix unchanged.

- [ ] **Step 7: Commit**

```bash
git add lib/motion/
git commit -m "feat(motion): a gate that mirrors the CSS kill switch's OR

globals.css disables motion from two independent blocks, so either the
OS query or the app toggle alone is enough. The gate reproduces that OR
exactly; an AND would let JS animate what CSS holds static, invisibly."
```

---

### Task 2: The scroll-progress provider

**Files:**
- Create: `components/motion/scroll-progress.tsx`
- Create: `components/motion/scroll-progress.test.tsx`

**Interfaces:**
- Consumes: `motionEnabled`, `subscribeMotionEnabled` from Task 1.
- Produces: `<ScrollProgress />` (renders no DOM) · `SCROLL_PROGRESS_ATTR: "data-scroll-progress"` · `SCROLL_PROGRESS_VAR: "--section-progress"` · `sectionProgress(rect: DOMRect, viewportHeight: number): number`

**Opt-in, not global.** Only elements carrying `data-scroll-progress` are tracked. Per the spec, **§1 Hero is the only consumer**; §2, §3, §5, §7, §8 and §9 stay entrance-driven. Do not add the attribute to a section because the provider exists.

- [ ] **Step 1: Write the failing test**

```tsx
// components/motion/scroll-progress.test.tsx
import { render } from "@/test/render";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ScrollProgress,
  sectionProgress,
  SCROLL_PROGRESS_ATTR,
  SCROLL_PROGRESS_VAR,
} from "./scroll-progress";

function rect(top: number, height: number): DOMRect {
  return { top, height, bottom: top + height } as DOMRect;
}

afterEach(() => vi.unstubAllGlobals());

describe("sectionProgress", () => {
  it("is 0 when the section's top is exactly at the viewport bottom", () => {
    expect(sectionProgress(rect(800, 600), 800)).toBe(0);
  });

  it("is 1 when the section's bottom has reached the viewport top", () => {
    expect(sectionProgress(rect(-600, 600), 800)).toBe(1);
  });

  it("is 0.5 at the midpoint of its travel", () => {
    // total travel = height + viewport = 1400; halfway = top at 800 - 700 = 100
    expect(sectionProgress(rect(100, 600), 800)).toBeCloseTo(0.5, 5);
  });

  it("clamps below 0 and above 1 rather than reporting out-of-range values", () => {
    expect(sectionProgress(rect(2000, 600), 800)).toBe(0);
    expect(sectionProgress(rect(-5000, 600), 800)).toBe(1);
  });
});

describe("<ScrollProgress />", () => {
  it("writes the final value once and starts no loop when motion is off", () => {
    document.documentElement.setAttribute("data-reduce-motion", "true");
    const section = document.createElement("section");
    section.setAttribute(SCROLL_PROGRESS_ATTR, "");
    document.body.append(section);
    const raf = vi.spyOn(window, "requestAnimationFrame");

    render(<ScrollProgress />);

    expect(section.style.getPropertyValue(SCROLL_PROGRESS_VAR)).toBe("1");
    expect(raf).not.toHaveBeenCalled();

    section.remove();
    document.documentElement.removeAttribute("data-reduce-motion");
  });

  it("disconnects its observer and cancels its frame on unmount", () => {
    document.documentElement.setAttribute("data-reduce-motion", "false");
    const disconnect = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = disconnect;
      },
    );
    const cancel = vi.spyOn(window, "cancelAnimationFrame");

    const { unmount } = render(<ScrollProgress />);
    unmount();

    expect(disconnect).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
    document.documentElement.removeAttribute("data-reduce-motion");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/motion/scroll-progress.test.tsx`
Expected: FAIL — `Failed to resolve import "./scroll-progress"`.

- [ ] **Step 3: Write the implementation**

```tsx
// components/motion/scroll-progress.tsx
"use client";

import { useEffect } from "react";

import { motionEnabled, subscribeMotionEnabled } from "@/lib/motion/motion-enabled";

/** Opt-in marker. A section without it is never tracked. */
export const SCROLL_PROGRESS_ATTR = "data-scroll-progress";
/** The custom property CSS reads. */
export const SCROLL_PROGRESS_VAR = "--section-progress";

/**
 * How far a section has travelled through the viewport, normalized to [0,1]:
 * 0 the instant its top touches the viewport bottom, 1 the instant its bottom
 * leaves the viewport top. Pure, so the mapping is testable without a DOM.
 */
export function sectionProgress(rect: DOMRect, viewportHeight: number): number {
  const total = rect.height + viewportHeight;
  if (total <= 0) return 0;
  const travelled = viewportHeight - rect.top;
  return Math.min(1, Math.max(0, travelled / total));
}

/**
 * Writes `--section-progress` on every `[data-scroll-progress]` section while it
 * is on screen. Renders no DOM: it is a behaviour, and a wrapper element would
 * move measured geometry.
 *
 * ⚠️ This is a CAPABILITY, not an obligation (spec §6.3). §1 Hero is its only
 * consumer. Wiring an entrance-driven section to it because it happens to exist
 * is the same failure mode as putting a thread segment in every section.
 *
 * Only intersecting sections compute — the observer adds and removes them from
 * the active set — and the rAF loop stops entirely when that set is empty.
 */
export function ScrollProgress(): null {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(`[${SCROLL_PROGRESS_ATTR}]`),
    );
    if (sections.length === 0) return;

    // Motion off: the final state, written once. Never an intermediate value,
    // never a loop. This is the same answer a reduce-motion reader gets from
    // the CSS lane, which is the point of sharing one gate.
    const settle = () => {
      for (const section of sections) {
        section.style.setProperty(SCROLL_PROGRESS_VAR, "1");
      }
    };

    if (!motionEnabled()) {
      settle();
      return subscribeMotionEnabled(() => {});
    }

    const active = new Set<HTMLElement>();
    let frame = 0;

    const tick = () => {
      for (const section of active) {
        const progress = sectionProgress(
          section.getBoundingClientRect(),
          window.innerHeight,
        );
        section.style.setProperty(SCROLL_PROGRESS_VAR, progress.toFixed(4));
      }
      frame = active.size > 0 ? window.requestAnimationFrame(tick) : 0;
    };

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const section = entry.target as HTMLElement;
        if (entry.isIntersecting) active.add(section);
        else active.delete(section);
      }
      if (active.size > 0 && frame === 0) frame = window.requestAnimationFrame(tick);
    });

    for (const section of sections) observer.observe(section);

    // The toggle can flip mid-session. Settling on the spot beats waiting for
    // the next scroll, which may never come.
    const unsubscribe = subscribeMotionEnabled((enabled) => {
      if (enabled) return;
      window.cancelAnimationFrame(frame);
      frame = 0;
      active.clear();
      settle();
    });

    return () => {
      unsubscribe();
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run components/motion/scroll-progress.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify types and lint**

Run: `npx tsc --noEmit` — exit 0. Run: `npm run lint` — 0 errors.

- [ ] **Step 6: Commit**

```bash
git add components/motion/scroll-progress.tsx components/motion/scroll-progress.test.tsx
git commit -m "feat(motion): opt-in scroll-progress provider

Writes --section-progress on [data-scroll-progress] sections only, and
only while they intersect. Motion off writes the final value once and
starts no loop. A capability, not global choreography: Hero is its only
consumer."
```

---

### Task 3: Thread tokens and the continuity contract

**Files:**
- Modify: `app/globals.css` (`:root`, beside the existing duration tokens)
- Modify: `lib/design-tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the seven invariant tokens, consumed by every segment from Task 4 onward.

**The contract's two halves** (spec §3.2). Invariant: width, colour, opacity, cap, dash, easing, duration — no section may define its own. Local geometry: position, length, curvature, orientation, bends, connection points — every section decides freely. **Continuity is same grammar, different geometry**; a test that pinned geometry would forbid the variety this work exists to create.

⚠️ The scan test that asserts segments consume these tokens belongs to **Task 4**, not here — at this point zero segments exist, and a pattern-gathered assertion over an empty collection is unconditionally green (L-004). Here we assert only that the tokens exist, which can fail first.

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/design-tokens.test.ts

/**
 * The Thread's invariant half (spec §3.2). Local geometry — position, length,
 * curvature, orientation, bends — is deliberately NOT here: sections differ in
 * shape and share only grammar. Pinning geometry would forbid the variety.
 */
const THREAD_TOKENS = [
  "--thread-width",
  "--thread-color",
  "--thread-opacity",
  "--thread-cap",
  "--thread-dash",
  "--thread-ease",
  "--thread-duration",
];

describe("thread token contract", () => {
  it.each(THREAD_TOKENS)("defines %s in :root", (token) => {
    expect(css).toContain(`${token}:`);
  });

  it("derives the thread's timing from existing tokens, inventing no literal", () => {
    const ease = css.match(/--thread-ease:\s*([^;]+);/)?.[1].trim();
    const duration = css.match(/--thread-duration:\s*([^;]+);/)?.[1].trim();
    expect(ease).toBeDefined();
    expect(duration).toBeDefined();
    expect(ease).toMatch(/^var\(--ease-/);
    expect(duration).toMatch(/^var\(--duration-/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts -t "thread token contract"`
Expected: FAIL — 8 tests red, `expected '…' to contain '--thread-width:'`.

- [ ] **Step 3: Add the tokens**

In `app/globals.css`, in the `:root` block immediately after `--ease-out-expo`:

```css
  /**
   * The Korume Learning Thread — its INVARIANT half (spec §3.2). Every thread
   * segment consumes these and none may define its own. Continuity is same
   * grammar, different geometry: position, length, curvature, orientation and
   * bends are each section's own business, and are deliberately absent here.
   *
   * Timing derives from the existing scales rather than inventing literals, so
   * a change to the page's rhythm moves the thread with it.
   */
  --thread-width: 2px;
  --thread-color: var(--accent);
  --thread-opacity: 0.9;
  --thread-cap: round;
  --thread-dash: 1;
  --thread-ease: var(--ease-standard);
  --thread-duration: var(--duration-slow);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/design-tokens.test.ts`
Expected: PASS, all tests including the 8 new ones.

- [ ] **Step 5: Mutation-check the derivation assertion**

Change `--thread-duration: var(--duration-slow);` to `--thread-duration: 600ms;`, re-run, record the RED (`expected '600ms' to match /^var\(--duration-/`). Restore, re-run, record the GREEN. Report both — this guard was written over a value that already existed by the time it ran.

- [ ] **Step 6: Commit**

```bash
git add app/globals.css lib/design-tokens.test.ts
git commit -m "feat(motion): the thread's invariant tokens, and a test that pins them

Seven tokens no section may redefine. Local geometry is deliberately
absent from the contract: continuity is same grammar, different
geometry, and pinning shape would forbid the variety this exists for.

The scan asserting segments CONSUME them lands with the first segment
(§5) — over zero segments it would be unconditionally green (L-004)."
```

---

# Phase 01 — §5 Recommendation, the motion laboratory

Wiring, not invention: the hooks and the geometry already exist. It exercises reveal, SVG geometry, the tokens, timing and the gate at the lowest available risk — and closes a live prose defect.

---

### Task 4: §5's donut sweep, and the first thread segment

**Files:**
- Modify: `components/marketing/recommendation-donut.tsx`
- Modify: `components/marketing/recommendation.tsx`
- Modify: `app/globals.css`
- Modify: `lib/design-tokens.test.ts`
- Create: `components/marketing/thread-segment.tsx`
- Create: `components/marketing/thread-segment.test.tsx`

**Interfaces:**
- Consumes: the thread tokens from Task 3.
- Produces: `<ThreadSegment morphology={...} />` · `THREAD_SEGMENT_ATTR: "data-thread-segment"` · `THREAD_MORPHOLOGIES: readonly ["line", "connection", "resolution"]`

⚠️ **The trap in this file, found by reading it.** `recommendation-donut.tsx` renders **two** circles carrying `strokeDasharray`: a blurred glow circle with no data attribute, and the crisp `data-familiar-arc`. A rule targeting only `[data-familiar-arc]` draws the crisp line while the glow already shows the full ring — a halo tracing a path its line has not reached. **Both circles must sweep.** Give the glow circle `data-familiar-arc="glow"` and target the attribute, not its value.

⚠️ **The stale docblock.** The file says *"The whole-page motion pass is a later task. Nothing here declares a transition, keyframe or scroll trigger, so this section's reduced-motion obligation is satisfied vacuously"*. That pass has run, and after this task the claim is false twice over. Correct it in this commit or the file argues its §2 r4 obligation from a dead premise.

⚠️ **`@keyframes stroke-draw` declares only a `to`.** Its implicit `from` is the element's live computed value, and the `pending` rule stops matching the instant the state flips. The dash declarations must be repeated on the `"in"` rule — this is the defect §4 shipped for one commit.

- [ ] **Step 1: Write the failing tests**

```tsx
// components/marketing/thread-segment.test.tsx
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { ThreadSegment, THREAD_MORPHOLOGIES, THREAD_SEGMENT_ATTR } from "./thread-segment";

describe("<ThreadSegment />", () => {
  it("offers every morphology the spec names", () => {
    expect(THREAD_MORPHOLOGIES).toEqual(["line", "connection", "resolution"]);
    expect(THREAD_MORPHOLOGIES.length).toBeGreaterThan(0);
  });

  it.each(THREAD_MORPHOLOGIES)("renders the %s morphology, marked and hidden from AT", (m) => {
    const { container } = render(<ThreadSegment morphology={m} />);
    const svg = container.querySelector(`[${THREAD_SEGMENT_ATTR}]`);
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute(THREAD_SEGMENT_ATTR, m);
    // The thread carries no information a screen reader needs; the section's
    // own copy does. It must not appear in the accessibility tree.
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
```

```ts
// append to lib/design-tokens.test.ts

/**
 * The contract's enforcement half: every thread rule must consume the shared
 * tokens and none may hardcode the invariants. Gathered by pattern, so the
 * count is asserted too — an empty match would make every claim below
 * unconditionally true (L-004).
 *
 * ⚠️ Bump THREAD_RULE_COUNT with each section that adds a segment. It is a
 * state pin, not an invariant: it says "this many exist today", and a section
 * that silently loses its thread is what it catches.
 */
const threadRules = css.match(/\[data-thread-segment[^\]]*\][^{]*\{[^}]*\}/g) ?? [];
const THREAD_RULE_COUNT = 2;

describe("thread continuity contract", () => {
  it("finds the thread rules it is about to make claims about", () => {
    expect(threadRules.length).toBe(THREAD_RULE_COUNT);
  });

  it("hardcodes none of the invariants in any thread rule", () => {
    // Local geometry is free; these seven are not.
    const forbidden = /stroke-width:\s*\d|stroke-linecap:\s*(?!var)|animation-timing-function:\s*(?!var)|stroke-dasharray:\s*(?!var|1\b)/;
    for (const rule of threadRules) {
      expect(rule, `a thread rule redefines an invariant:\n${rule}`).not.toMatch(forbidden);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run components/marketing/thread-segment.test.tsx lib/design-tokens.test.ts -t thread`
Expected: FAIL — the component does not resolve; `threadRules.length` is 0, not 2.

- [ ] **Step 3: Create the thread segment primitive**

```tsx
// components/marketing/thread-segment.tsx

/**
 * The Korume Learning Thread, as a segment (spec §3).
 *
 * ⚠️ There is no page-spanning thread element. Each section owns its own
 * segment; continuity comes from the shared tokens in `app/globals.css`, not
 * from DOM topology. Two adjacent segments may differ completely in geometry.
 *
 * ⚠️ Morphology is a PROP, never a new component. §4's pitch contours and §6's
 * chain cascade are the KNOWLEDGE CURVE and PATH morphologies already, realised
 * by shipped mechanisms — they are frozen and get no segment (spec §3.3).
 */
export const THREAD_SEGMENT_ATTR = "data-thread-segment";

export const THREAD_MORPHOLOGIES = ["line", "connection", "resolution"] as const;
export type ThreadMorphology = (typeof THREAD_MORPHOLOGIES)[number];

/** Local geometry per morphology — free to differ, by design. */
const PATHS: Record<ThreadMorphology, string> = {
  line: "M 12 0 L 12 64",
  connection: "M 0 12 L 96 12",
  resolution: "M 12 0 C 12 28 12 40 4 56",
};

const VIEWBOXES: Record<ThreadMorphology, string> = {
  line: "0 0 24 64",
  connection: "0 0 96 24",
  resolution: "0 0 24 64",
};

export function ThreadSegment({
  morphology,
  className,
}: {
  morphology: ThreadMorphology;
  className?: string;
}) {
  return (
    <svg
      {...{ [THREAD_SEGMENT_ATTR]: morphology }}
      viewBox={VIEWBOXES[morphology]}
      aria-hidden="true"
      focusable="false"
      className={className}
      preserveAspectRatio="none"
    >
      <path d={PATHS[morphology]} fill="none" pathLength={1} />
    </svg>
  );
}
```

- [ ] **Step 4: Add the two CSS rules**

In `app/globals.css`, after the existing §5 rules:

```css
/* The thread's shared grammar. Every segment consumes the invariant tokens;
   geometry lives in the component, where it is free to differ per section. */
[data-thread-segment] path {
  stroke: var(--thread-color);
  stroke-width: var(--thread-width);
  stroke-linecap: var(--thread-cap);
  opacity: var(--thread-opacity);
  stroke-dasharray: var(--thread-dash);
}

:root[data-reduce-motion="false"]:not([data-reveal-failsafe]) [data-reveal-scope] [data-reveal="pending"] [data-thread-segment] path {
  stroke-dashoffset: var(--thread-dash);
}

[data-reveal-scope] [data-reveal="in"] [data-thread-segment] path {
  /* ⚠️ Repeated, not inherited from the `pending` rule above: `stroke-draw`
     declares only a `to`, so its implicit `from` is the live computed value —
     and `pending` stops matching the instant the state flips. Without this the
     animation runs 0 -> 0 and the segment simply appears. */
  stroke-dasharray: var(--thread-dash);
  stroke-dashoffset: var(--thread-dash);
  animation: stroke-draw var(--thread-duration) var(--thread-ease) both;
}
```

- [ ] **Step 5: Sweep the donut — BOTH circles**

In `components/marketing/recommendation-donut.tsx`, give the glow circle a marker so the rule reaches it:

```tsx
        <circle
          data-familiar-arc="glow"
          cx={centre}
```

and leave the crisp circle's bare `data-familiar-arc` as it is. Then in `app/globals.css`:

```css
/* §5's calibration sweep. The attribute, not its value: the ring is drawn
   TWICE — a blurred glow and the crisp line on top — and animating only the
   crisp one leaves a halo tracing a path its own line has not reached. */
:root[data-reduce-motion="false"]:not([data-reveal-failsafe]) [data-reveal-scope] [data-reveal="pending"] [data-familiar-arc] {
  stroke-dashoffset: var(--donut-circumference);
}

[data-reveal-scope] [data-reveal="in"] [data-familiar-arc] {
  stroke-dashoffset: var(--donut-circumference);
  animation: donut-sweep var(--duration-cinematic) var(--ease-out-expo) both;
  animation-delay: calc(var(--duration-stagger) * 2);
}

@keyframes donut-sweep {
  to {
    stroke-dashoffset: 0;
  }
}
```

In `recommendation-donut.tsx`, expose the circumference to CSS on the `<svg>` so the keyframe has a real length to travel:

```tsx
      style={{ ["--donut-circumference" as string]: `${CIRCUMFERENCE}` }}
```

- [ ] **Step 6: Correct the stale docblock**

Replace the `## NO MOTION` block in `recommendation-donut.tsx` with:

```
 * ## MOTION
 *
 * The arc sweeps 0 -> 96 on entrance via `stroke-dashoffset` (spec §5). The
 * geometry was built for exactly this and needed no re-authoring.
 *
 * ⚠️ BOTH dashed circles sweep — the blurred glow and the crisp line. They
 * share `[data-familiar-arc]`; the glow carries the value "glow" only so a
 * reader can tell them apart. Animating one alone leaves a halo ahead of its
 * own line.
 *
 * Reduce-motion is handled by the global kill switch in `app/globals.css`,
 * which collapses duration AND delay. This section's obligation is satisfied
 * by that gate, not vacuously — an earlier version of this docblock claimed
 * the latter and was false from the moment the motion pass ran.
```

- [ ] **Step 7: Add the thread segment to §5**

In `components/marketing/recommendation.tsx`, render `<ThreadSegment morphology="connection" />` inside the existing section wrapper, with no new layout container — place it on an element that already exists.

- [ ] **Step 8: Bump the reveal gate count**

`REVEAL_GATE_COUNT` in `lib/design-tokens.test.ts` moves from `5` to `7` (the thread rule and the donut rule each add one).

- [ ] **Step 9: Run the full suite**

Run: `npm test -- --reporter=dot > /tmp/suite.txt 2>&1; tail -30 /tmp/suite.txt`
Expected: PASS. ⚠️ Read the file, not the terminal tail alone — `pitch-contour.test.tsx` and `waveform.test.tsx` flake under parallel load and a failure must have a name before it is called a flake (L-009). Re-run standalone before believing either.

- [ ] **Step 10: Verify in the browser at a real width**

```bash
npm run build && npx next start -p 3000
```
Load `/en`, scroll to §5, and confirm the glow and the crisp line sweep **together**. Then toggle reduce-motion and confirm the ring is complete and static, with no flash.

⚠️ A dead dev server reports no defect at any width — a 500 page has no §5 at all. Assert the page rendered (9 sections) before trusting any browser measurement.

- [ ] **Step 11: Commit**

```bash
git add components/marketing/ app/globals.css lib/design-tokens.test.ts
git commit -m "feat(marketing): §5 calibration sweep, and the thread's first segment

The donut's geometry was authored for this sweep and left unwired. Both
dashed circles animate: the ring is drawn twice, and sweeping only the
crisp line leaves the glow tracing a path ahead of it.

Corrects the docblock's 'the whole-page motion pass is a later task' —
false since A-MOTION, and it was carrying the file's reduce-motion
argument."
```

---

# Phase 02 — §1 Hero, the architecture proof

The only section that consumes the scroll-progress provider. If Hero works, the engine is proven.

---

### Task 5: §1's heading block and interior sequencing

**Files:**
- Modify: `components/marketing/hero.tsx`
- Modify: `components/marketing/hero-video-card.tsx`
- Modify: `app/globals.css`
- Modify: `lib/design-tokens.test.ts`

**Interfaces:**
- Consumes: the reveal substrate; the thread tokens.
- Produces: `data-hero-step` on the video card's interior elements.

⚠️ **The heading reveals as ONE BLOCK, never line by line** (spec §5). A per-line reveal needs a JS measure pass or hard-coded `<span>`s over a single catalog string that wraps to a different number of lines in English and Vietnamese at every width. Do not add spans. Do not measure.

- [ ] **Step 1: Write the failing test**

```ts
// append to lib/design-tokens.test.ts
describe("§1 hero entrance", () => {
  it("reveals the heading as one masked block, not per line", () => {
    expect(css).toMatch(/@keyframes hero-heading-rise/);
    // A per-line implementation would need nth-child stepping. Its absence is
    // the assertion: this must stay multilingual-safe with no measure pass.
    const rule = css.match(/\[data-hero-heading\][^{]*\{[^}]*\}/g) ?? [];
    expect(rule.length).toBeGreaterThan(0);
    for (const r of rule) expect(r).not.toMatch(/nth-child/);
  });

  it("steps the video card's interior off one token", () => {
    const steps = css.match(/\[data-hero-step\]/g) ?? [];
    expect(steps.length).toBeGreaterThan(0);
    expect(css).toMatch(/--hero-step[^;]*var\(--duration-stagger\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/design-tokens.test.ts -t "hero entrance"`
Expected: FAIL — no `hero-heading-rise` keyframe.

- [ ] **Step 3: Add the CSS**

```css
/* §1's heading arrives as a single masked block. Deliberately NOT per line:
   the heading is one catalog string that wraps to a different number of lines
   in en and vi at every width, so a per-line reveal would need a measure pass
   or hard-coded spans. Neither is worth one effect. */
:root[data-reduce-motion="false"]:not([data-reveal-failsafe]) [data-reveal-scope] [data-reveal="pending"] [data-hero-heading] {
  opacity: 0;
}

[data-reveal-scope] [data-reveal="in"] [data-hero-heading] {
  animation: hero-heading-rise var(--duration-slow) var(--ease-out-expo) both;
}

@keyframes hero-heading-rise {
  from {
    opacity: 0;
    transform: translateY(var(--space-md));
    clip-path: inset(0 0 100% 0);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    clip-path: inset(0 0 0 0);
  }
}

/* The video card's interior, stepped off one token: image, then metadata,
   then the companion. The card itself already rose with the section. */
:root[data-reduce-motion="false"]:not([data-reveal-failsafe]) [data-reveal-scope] [data-reveal="pending"] [data-hero-step] {
  opacity: 0;
}

[data-reveal-scope] [data-reveal="in"] [data-hero-step] {
  animation: reveal-fade var(--duration-base) var(--ease-standard) both;
  animation-delay: calc(var(--duration-stagger) * (var(--hero-step, 0) + 3));
}
```

- [ ] **Step 4: Add the attributes**

In `hero.tsx`, add `data-hero-heading` to the heading element already rendered by `Section`. In `hero-video-card.tsx`, add `data-hero-step` with `style={{ "--hero-step": n }}` to the still, the transport bar, the sentence rail and the mascot — on elements that already exist. Add no wrapper.

- [ ] **Step 5: Bump the gate count and run**

`REVEAL_GATE_COUNT` 7 → 9. Run: `npx vitest run lib/design-tokens.test.ts` — expected PASS.

- [ ] **Step 6: Mutation-check the "no per-line" guard**

Add `[data-hero-heading]:nth-child(2) { opacity: 0; }` to globals.css, re-run, record the RED. Remove it, re-run, record the GREEN.

- [ ] **Step 7: Commit**

```bash
git add components/marketing/hero.tsx components/marketing/hero-video-card.tsx app/globals.css lib/design-tokens.test.ts
git commit -m "feat(marketing): §1 heading as one masked block, card interior stepped

Per-line reveal was ruled out: one catalog string wraps to a different
line count in en and vi at every width, so it would need a measure pass
or hard-coded spans. The cinematic beat moves inside the video card."
```

---

### Task 6: §1's scroll-linked camera push

**Files:**
- Modify: `app/[locale]/(marketing)/page.tsx` (mount `<ScrollProgress />`)
- Modify: `components/marketing/hero.tsx` (opt in)
- Modify: `app/globals.css`
- Modify: `tests/e2e/landing-page.spec.ts`

**Interfaces:**
- Consumes: `ScrollProgress`, `SCROLL_PROGRESS_ATTR` from Task 2.
- Produces: nothing downstream.

⚠️ **The scroll distance is an open item (spec §11).** Do not freeze a pixel number in CSS from this document. Implement the mapping off `--section-progress`, then choose the felt range against a render at 1280 **and** 390, and record the chosen value in the commit message.

- [ ] **Step 1: Write the failing e2e case**

```ts
// append to tests/e2e/landing-page.spec.ts
test("§1's video card recedes as the hero leaves, and is untouched at rest", async ({ page }) => {
  await page.goto("/en");

  // POSITIVE CONTROL: prove the card is at its resting scale before asserting
  // that it moves. Without this the case passes vacuously against a build that
  // stopped applying the transform at all.
  const card = page.locator("[data-hero-card]");
  await expect(card).toBeVisible();
  const atRest = await card.evaluate((el) => getComputedStyle(el).transform);
  expect(atRest === "none" || atRest === "matrix(1, 0, 0, 1, 0, 0)").toBe(true);

  await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
  await expect
    .poll(async () => card.evaluate((el) => getComputedStyle(el).transform))
    .not.toBe(atRest);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/e2e/landing-page.spec.ts -g "recedes"`
Expected: FAIL — no `[data-hero-card]`.

- [ ] **Step 3: Mount the provider and opt §1 in**

In `app/[locale]/(marketing)/page.tsx`, render `<ScrollProgress />` beside the existing `<RevealScope />`. In `hero.tsx`, put `data-scroll-progress` on the `<Section>`'s own element and `data-hero-card` on the existing video-card wrapper. No new elements.

- [ ] **Step 4: Add the CSS**

```css
/* §1's camera push. Driven by --section-progress, which only §1 opts into:
   the provider is a capability, not global choreography (spec §6.3).
   Transform only — the card must not move a single pixel of layout. */
[data-hero-card] {
  transform: scale(calc(1 - 0.06 * var(--section-progress, 0)));
  transform-origin: center top;
}
```

- [ ] **Step 5: Run the e2e case**

Run: `npm run build && npx next start -p 3000` in one shell, then `npx playwright test tests/e2e/landing-page.spec.ts -g "recedes"`.
Expected: PASS.

⚠️ Playwright's config hardcodes `:3000` with `reuseExistingServer: true`, so it attaches to whatever is already there — **including a server serving a build you have since changed.** Free the port and restart on the rebuilt output before believing a result.

- [ ] **Step 6: Choose the scroll range against a render**

Load `/en` at 1280 and at 390, scroll the hero out slowly, and judge whether `0.06` is the right recession. Adjust the coefficient only. Record the chosen value and both widths in the commit message; do not leave it undocumented.

- [ ] **Step 7: Verify reduce-motion**

Toggle reduce-motion on, reload, scroll. The card must sit at its final scale and never animate. Confirm `--section-progress` reads `1`.

- [ ] **Step 8: Commit**

```bash
git add app/ components/marketing/hero.tsx tests/e2e/landing-page.spec.ts
git commit -m "feat(marketing): §1's scroll-linked camera push

Hero is the only consumer of the scroll-progress provider. Recession
coefficient chosen against a render at 1280 and 390, not derived on
paper — the first hero clamp shipped inside its bound and visibly wrong."
```

---

# Phase 03–07 — the remaining entrance-driven sections

All four follow the same shape as Task 5: attributes on existing elements, one CSS rule block, a `REVEAL_GATE_COUNT` bump, a mutation check, and an e2e case with a positive control. **None of them touches the scroll-progress provider** — they are entrance-driven and stay that way.

---

### Task 7: §2 node assembly

**Files:** `components/marketing/problem.tsx` · `problem-connectors.tsx` · `app/globals.css` · `lib/design-tokens.test.ts`

**Interfaces:** Consumes the thread tokens. Produces `--node-step` on each chip.

The six chips arrive scattered and assemble; the constellation's connectors then draw between them via `stroke-dashoffset`; the centre sentence lands last. Replace the current flat `reveal-fade` stagger.

- [ ] **Step 1: Write the failing test** — assert `@keyframes node-assemble` exists, that the connector rule draws (`stroke-dashoffset`), and that the chips' delay derives from `--duration-stagger` with the connectors landing after the last chip:

```ts
describe("§2 node assembly", () => {
  it("assembles the chips before drawing the connectors between them", () => {
    expect(css).toMatch(/@keyframes node-assemble/);
    const connector = css.match(/\[data-reveal="in"\][^{]*\[data-connector\][^{]*\{[^}]*\}/g) ?? [];
    expect(connector.length).toBeGreaterThan(0);
    for (const rule of connector) expect(rule).toMatch(/stroke-dashoffset/);
  });
});
```

- [ ] **Step 2: Run it** — `npx vitest run lib/design-tokens.test.ts -t "node assembly"`. Expected FAIL.
- [ ] **Step 3: Implement** — `@keyframes node-assemble` translating each chip from a per-chip offset to 0 with opacity; connectors drawing after `calc(var(--duration-stagger) * 8)`; centre sentence last.
- [ ] **Step 4: Run it** — expected PASS. Bump `REVEAL_GATE_COUNT`.
- [ ] **Step 5: Mutation-check** — remove `stroke-dashoffset` from the connector rule, record RED, restore, record GREEN.
- [ ] **Step 6: ⚠️ RENDER REVIEW — this task is not done when the suite is green.** Spec §5's acceptance criterion: *"At rest, the six capabilities must read as one connected learning system rather than six independent cards."* No test can carry this. Build, serve, look at it at 1280, and put the render in front of the owner. **If it reads as six cards flying in, the task is not finished** — re-approach before moving on.
- [ ] **Step 7: Commit** once the render is accepted.

---

### Task 8: §3 learning conveyor

**Files:** `components/marketing/journey.tsx` · `app/globals.css` · `lib/design-tokens.test.ts`

**Interfaces:** Consumes the thread tokens. Produces `--conveyor-step` on each of the five steps.

Semantic choreography, fixed: `Video → Sentence → Vocabulary → Grammar → SRS`. Each step wakes as the thread reaches it, handed off rather than revealed together. **Not a horizontal-scroll pin.**

- [ ] **Step 1: Write the failing test** — assert the five steps step off one token and that the hand-off is ordered, not simultaneous:

```ts
describe("§3 conveyor", () => {
  it("hands each step off in order rather than revealing them together", () => {
    expect(css).toMatch(/@keyframes conveyor-handoff/);
    const rule = css.match(/\[data-reveal="in"\][^{]*\[data-step\][^{]*\{[^}]*\}/g) ?? [];
    expect(rule.length).toBeGreaterThan(0);
    for (const r of rule) expect(r).toMatch(/var\(--conveyor-step/);
  });
});
```

- [ ] **Step 2: Run it** — expected FAIL.
- [ ] **Step 3: Implement** — `@keyframes conveyor-handoff`, delay `calc(var(--duration-stagger) * var(--conveyor-step))`, `--conveyor-step` set 0–4 on the existing step elements. ⚠️ `journey-art.tsx`'s eight glyphs stay still — stepping every small element is the noisy reading the brief rules out.
- [ ] **Step 4: Run it** — expected PASS. Bump `REVEAL_GATE_COUNT`.
- [ ] **Step 5: Mutation-check** — set every `--conveyor-step` to `0`, record the RED, restore, record the GREEN.
- [ ] **Step 6: ⚠️ RENDER REVIEW — the timing is an open item (spec §11).** Decide against a render: how much the cards overlap, whether the hand-off is too fast, how long the outgoing step holds, whether the next enters by translate or opacity, and whether the thread leads the eye. Record the chosen values in the commit message.
- [ ] **Step 7: Commit** once the render is accepted.

---

### Task 9: §7 quiet lock

**Files:** `components/marketing/trust.tsx` · `app/globals.css` · `lib/design-tokens.test.ts`

**Interfaces:** Consumes `<ThreadSegment morphology="line" />`.

The page's deceleration zone, at roughly 30–40% of §1's intensity. The thread arrives, enters a lock, and stops; the three privacy cards then arrive slowly, in sequence.

- [ ] **Step 1: Write the failing test** — assert §7's cards are slower than §1's heading, so "quiet" is a measured property and not a comment:

```ts
describe("§7 is quieter than §1", () => {
  it("gives its cards a longer, gentler entrance than the hero heading", () => {
    const trust = css.match(/\[data-reveal="in"\][^{]*\[data-trust-card\][^{]*\{[^}]*\}/g) ?? [];
    expect(trust.length).toBeGreaterThan(0);
    for (const rule of trust) expect(rule).toMatch(/var\(--duration-slow\)/);
  });
});
```

- [ ] **Step 2: Run it** — expected FAIL (the current rule already uses `--duration-slow`; if it passes on the first run, that is a defect in the test — tighten it to assert the lock rule too, then re-run and see it red before implementing).
- [ ] **Step 3: Implement** — the `line` segment terminating at a lock element; cards on `--duration-slow` with `--card-step`.
- [ ] **Step 4: Run it** — expected PASS. Bump `REVEAL_GATE_COUNT` and `THREAD_RULE_COUNT`.
- [ ] **Step 5: Mutation-check** and record both outputs.
- [ ] **Step 6: Commit.**

---

### Task 10: §8 CTA invitation

**Files:** `components/marketing/cta.tsx` · `app/globals.css` · `lib/design-tokens.test.ts`

**Interfaces:** Consumes `<ThreadSegment morphology="line" />`.

⚠️ **The thread does not complete here.** §8 is a continuation, not the destination — the segment passes through rather than landing. A new scene, never a character arriving from §6: background settles `1.03 → 1.00`, the orb floats, the mascot breathes almost imperceptibly, the CTA reveals last.

- [ ] **Step 1: Write the failing test** — assert the CTA button is the last thing to arrive in its section:

```ts
describe("§8 invitation", () => {
  it("reveals the call to action last", () => {
    const rule = css.match(/\[data-reveal="in"\][^{]*\[data-cta-action\][^{]*\{[^}]*\}/g) ?? [];
    expect(rule.length).toBeGreaterThan(0);
    for (const r of rule) expect(r).toMatch(/animation-delay/);
  });
});
```

- [ ] **Step 2: Run it** — expected FAIL.
- [ ] **Step 3: Implement** — `data-cta-action` on the existing button; the background scale on the existing wrapper; a `line` segment that exits the section's bottom edge rather than terminating at the button.
- [ ] **Step 4: Run it** — expected PASS. Bump both counts.
- [ ] **Step 5: Mutation-check** and record both outputs.
- [ ] **Step 6: Commit.**

---

### Task 11: §9 thread resolution

**Files:** `components/marketing/signoff.tsx` · `app/globals.css` · `lib/design-tokens.test.ts`

**Interfaces:** Consumes `<ThreadSegment morphology="resolution" />`.

The page's exhale. No large new device: the thread slows, softens its curve, loses opacity and settles. The footer below stays fully still, with `resting.png` asleep on its book — **do not animate the footer mascot.**

- [ ] **Step 1: Write the failing test**

```ts
describe("§9 resolution", () => {
  it("settles the thread rather than drawing it, and leaves the footer still", () => {
    const rule = css.match(/\[data-thread-segment="resolution"\][^{]*\{[^}]*\}/g) ?? [];
    expect(rule.length).toBeGreaterThan(0);
    for (const r of rule) expect(r).toMatch(/opacity/);
    // The footer mascot is static by doctrine (spec §4). Nothing may animate it.
    expect(css).not.toMatch(/\[data-footer-mascot\][^{]*\{[^}]*animation:/);
  });
});
```

- [ ] **Step 2: Run it** — expected FAIL.
- [ ] **Step 3: Implement** — the `resolution` segment fading as it settles; §9's copy on the standard entrance; `data-footer-mascot` added to `site-footer.tsx`'s image purely so the guard has a subject.
- [ ] **Step 4: Run it** — expected PASS. Bump both counts.
- [ ] **Step 5: Mutation-check the footer guard** — add `[data-footer-mascot] { animation: reveal-fade 1s; }`, record the RED, remove it, record the GREEN. This guard exists to stop a future contributor animating the one mascot the doctrine keeps still.
- [ ] **Step 6: Commit.**

---

### Task 12: Whole-branch review and the lessons pass

**Files:** `docs/lessons.md`

Required by CLAUDE.md §9 before merge, and by `L-011` even though every task was reviewed on its own.

- [ ] **Step 1: Run the full gate, each command run and its output read**

```bash
npx tsc --noEmit
npm run lint
npm test -- --reporter=dot > /tmp/suite.txt 2>&1; tail -40 /tmp/suite.txt
npm run build
npx next start -p 3000 &
npx playwright test tests/e2e/landing-page.spec.ts
```

⚠️ Never quote a test or file count from this plan — run the command (L-002). ⚠️ Do not record `playwright 27/27` without local Supabase: five specs fail with `ECONNREFUSED 127.0.0.1:54321` and none touches the landing page.

- [ ] **Step 2: Verify reduce-motion by sampling every frame through load, not once**

The §2 r4 defect found on 2026-09-04 passed a single-sample e2e 21/21 twice and fired roughly 1 run in 12. Run an in-page `requestAnimationFrame` loop that records `animationDuration`, `animationDelay` and `opacity` for every revealed element across the whole load, with reduce-motion on. Expected: zero frames at opacity 0.

- [ ] **Step 3: Dispatch a `code-reviewer` over the whole branch**

⚠️ Budget for this failing: three reviewers were lost to session rate limits across two sessions on this project. If it dies, do the review inline and say so in the report's Coverage section — a partial review recorded as complete is worse than a partial review.

- [ ] **Step 4: Apply the fix wave, then review the fix wave (`L-012`)**

On this page, the review of the fix wave has caught a defect the wave itself created, twice.

- [ ] **Step 5: Write the lessons pass**

Merge into existing `L-NNN` entries where one applies; append a new id only for a genuinely new lesson. Technical CSS/DOM facts go to `mem:project_status` § Key gotchas, not `docs/lessons.md` — that file's scope is process.

- [ ] **Step 6: Commit.**

---

## Self-Review

**Spec coverage.** §2 doctrine → Global Constraints + Tasks 7–11. §3 thread + morphologies + §3.3 → Tasks 3, 4, and the frozen exclusions. §3.2 invariant/geometry split → Task 3 Step 3 and Task 4's contract scan. §4 mascot map → §4 and §6 frozen in Global Constraints; footer stillness guarded in Task 11. §5 per-section mechanisms → Tasks 4–11, one each, §4 and §6 deliberately absent. §6.1 no GSAP / no `animation-timeline` → Global Constraints and Task 2's design. §6.2 gate → Task 1. §6.3 provider + opt-in → Task 2 and Task 6. §6.4 substrate unchanged → the `REVEAL_GATE_COUNT` bumps. §7 non-negotiables → Global Constraints. §9 testing → each task's mutation check plus Task 12. §10 sequencing → the phase order. §11 open items → Tasks 6, 7 and 8 each carry an explicit render review.

**Placeholders.** None. The three genuinely open values (§1's coefficient, §3's hand-off timing, §2's system reading) are open *by the spec's decision* and each has a named step that closes it against a render, with the outcome recorded in a commit message — that is a decision procedure, not a TBD.

**Type consistency.** `motionEnabled` / `subscribeMotionEnabled` / `REDUCE_MOTION_ATTR` are defined in Task 1 and consumed under those exact names in Task 2. `SCROLL_PROGRESS_ATTR` / `SCROLL_PROGRESS_VAR` / `sectionProgress` are defined in Task 2 and consumed in Task 6. `ThreadSegment` / `THREAD_MORPHOLOGIES` / `THREAD_SEGMENT_ATTR` are defined in Task 4 and consumed in Tasks 9, 10, 11 — with `resolution` present in the morphology list from the start, so Task 11 needs no widening. `REVEAL_GATE_COUNT` starts at 5 and is bumped by every task that adds a hidden rule; `THREAD_RULE_COUNT` starts at 2 in Task 4 and is bumped in Tasks 9, 10 and 11.
