import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REVEAL_FAILSAFE_ATTR } from "@/components/motion/reveal-failsafe";

/**
 * The token system's automated contract (spec §2.9: architectural invariants
 * are enforced by tests, not documentation).
 *
 * - Required tokens exist in globals.css — a deleted/renamed token fails here
 *   before it silently falls back to `unset` in the browser.
 * - Every var() referenced by tailwind.config.ts resolves to a definition in
 *   globals.css — a typo'd var name in the Tailwind mapping is otherwise
 *   invisible (CSS treats it as an empty value at runtime).
 * - The reduce-motion kill-switch survives every globals.css edit
 *   (CLAUDE.md §2.4 non-negotiable).
 */
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");
const tailwind = readFileSync(
  path.join(process.cwd(), "tailwind.config.ts"),
  "utf8",
);

/**
 * The reveal layer's PERSISTENT hidden state: every rule in globals.css that
 * holds landing-page content at opacity 0 until the observer flips it. Gathered
 * once, because two tests below ask about the same five rules and a sixth
 * legitimately-added rule must move one number, not two (CLAUDE.md §6).
 *
 * `[^ ]*` tolerates further conditions on `:root` — the failsafe escape added
 * one — while still requiring the reduce-motion gate to be what each rule
 * starts from. A rule that LOSES its escape still matches here (the `*` takes
 * the empty string) and drops out of the escapable filter, which is what makes
 * that filter a real assertion rather than a restatement of this one.
 */
const revealGates = css.match(
  /:root\[data-reduce-motion="false"\][^ ]* \[data-reveal-scope\] \[data-reveal="pending"\]/g,
);
// STATE PIN: task 4 adds two (the thread rule, the donut rule) — 5 -> 7;
// task 5 adds two more (the hero heading, the hero step) — 7 -> 9, verified
// by running the test and reading the real number, not counted.
const REVEAL_GATE_COUNT = 9;

const REQUIRED_TOKENS = [
  // spacing
  "--space-2xs", "--space-xs", "--space-sm", "--space-md",
  "--space-md-lg",
  "--space-lg", "--space-xl", "--space-2xl", "--space-3xl",
  // layout shell structure
  "--layout-sidebar-width", "--layout-sidebar-collapsed",
  "--layout-content-max", "--layout-companion-width",
  "--layout-gutter", "--layout-column-gap",
  // The sticky site header's height. A shell dimension, not a spacing step:
  // `site-header.tsx` sizes the bar from it and `section.tsx` reserves it as
  // scroll margin so an anchored heading cannot land underneath the bar
  // (task 11 review M1). Two consumers, one definition.
  "--layout-header-height",
  // The marketing pages' content column. Wider than the rest of the app on
  // purpose: frame 347:6277 is 1280 wide and puts its content ~44px from each
  // edge, where Container's app-wide max-w-6xl puts it 96px in (task 12).
  "--layout-marketing-max",
  // radius — declared absolutely, never derived. A calc()-chained scale means
  // one edit to the base silently skews every other step. No unqualified
  // `--radius`: it had zero consumers outside docs/ and was deleted.
  "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl",
  // typography
  "--text-caption", "--text-body", "--text-body-lg", "--text-heading",
  "--text-heading-lg", "--text-title", "--text-display", "--text-hero",
  "--leading-caption", "--leading-body", "--leading-body-lg",
  "--leading-heading", "--leading-heading-lg",
  "--leading-title", "--leading-display", "--leading-hero",
  "--leading-jp",
  "--font-weight-regular", "--font-weight-medium", "--font-weight-semibold",
  "--font-weight-bold",
  "--tracking-tight", "--tracking-wide",
  // elevation
  "--elevation-raised", "--elevation-overlay", "--elevation-floating",
  // motion
  "--duration-fast", "--duration-base", "--duration-slow",
  "--duration-cinematic", "--duration-stagger",
  "--ease-standard", "--ease-out-expo",
  // z-index
  "--z-nav", "--z-overlay", "--z-popover", "--z-toast",
];

const PRIMITIVE_TOKENS = [
  "--void-950", "--void-900", "--void-850", "--void-800",
  "--slate-800", "--slate-400",
  "--paper-50", "--ink-950",
  "--ember-500", "--sand-400",
  "--mint-400", "--coral-400", "--coral-300",
];

// The semantic tier must be a var() alias of a primitive. This list is the
// table from the adoption spec §3.2 plus `--danger-foreground`, added during
// execution — see §3.3. A half-updated list reads as protection while
// leaving new tokens unguarded.
const SEMANTIC_COLOR_TOKENS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--muted", "--muted-foreground", "--input-background",
  "--border", "--input", "--ring",
  "--primary", "--primary-foreground", "--primary-strong",
  "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground", "--accent-strong",
  "--success", "--success-strong",
  "--danger", "--danger-foreground", "--danger-strong",
  "--surface-overlay",
];

describe("design tokens", () => {
  it("defines every required token in globals.css", () => {
    const missing = REQUIRED_TOKENS.filter(
      (token) => !new RegExp(`${token}\\s*:`).test(css),
    );
    expect(missing).toEqual([]);
  });

  it("resolves every var() referenced by tailwind.config.ts", () => {
    const referenced = [...tailwind.matchAll(/var\((--[a-z0-9-]+)\)/g)].map(
      (match) => match[1],
    );
    expect(referenced.length).toBeGreaterThan(0);
    const undefinedVars = referenced.filter(
      (name) => !new RegExp(`${name}\\s*:`).test(css),
    );
    expect(undefinedVars).toEqual([]);
  });

  it("keeps the reduce-motion kill-switch intact", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(':root[data-reduce-motion="true"]');
    // Both blocks must keep collapsing animation AND transition durations.
    const matches = css.match(/animation-duration: 0\.001ms !important/g);
    expect(matches?.length).toBe(2);
  });

  it("collapses animation DELAY under reduce-motion, not only duration", () => {
    // ⚠️ CLAUDE.md §2 rule 4. Collapsing only the duration is not enough: the
    // reveal layer's rules are `animation: reveal-rise … both`, and
    // `animation-fill-mode: both` holds the element at the keyframe's FROM
    // value — `opacity: 0` — for the whole of `animation-delay`. So with the
    // delay left alive, a reduce-motion reader still gets content hidden by
    // motion, for up to `--duration-cinematic * 1.5`.
    //
    // Measured in a real browser at 1280 before this guard existed:
    // `animationName: reveal-rise, animationDuration: 1e-06s (collapsed),
    // animationDelay: 0.09s (NOT collapsed), animationFillMode: both,
    // data-reveal: in, opacity: 0` — hidden across 12 sampled frames spanning
    // ~350ms. The e2e case for this reproduced it only about 1 run in 12,
    // because the assertion has to land inside that window; this test cannot
    // miss it.
    //
    // A NEGATIVE delay rather than `0s`: with a 0.001ms duration, a frame
    // sampled at exactly the animation's start still reads the FROM value.
    // Starting it already-completed makes `both` hold the TO value instead.
    const delays = css.match(/animation-delay: -1ms !important/g);
    // L-004: non-empty AND the expected size — one per reduce-motion block,
    // and there are exactly two blocks (asserted in the test above).
    expect(delays).not.toBeNull();
    expect(delays).toHaveLength(2);
  });

  it("hides a pending reveal only when the init script proved motion is allowed", () => {
    // The gate is `[data-reduce-motion="false"]`, which themeInitScript sets
    // before paint and ONLY when JS ran. With JS off the attribute is absent,
    // so the hidden state never applies and content is visible — motion can
    // never be what hides content (spec §4.1, CLAUDE.md §2.4).
    // The COUNT is not this test's subject, and is pinned in the failsafe test
    // below, which is the one it belongs to (L-031: assert the relation the
    // spec states, not a stronger one today's CSS happens to satisfy).
    expect(revealGates).not.toBeNull();
    expect(revealGates?.length).toBeGreaterThanOrEqual(1);
    // And the hidden state must never be written ungated: a rule that starts at
    // `[data-reveal-scope]` or `[data-reveal="pending"]` would apply with JS off.
    expect(css).not.toMatch(/^\[data-reveal(-scope)?[^\]]*\][^{]*\{\s*opacity:\s*0/m);
  });

  it("lets the failsafe release every hidden rule, not just the first one", () => {
    // The gate proves JS RAN (themeInitScript is inline, in <head>, outside the
    // bundle). It does not prove the OBSERVER ran. If the client bundle never
    // executes — 404, blocked by an extension, hydration aborted — nothing ever
    // flips `pending` to `in`, and the whole page stays at opacity 0. The
    // inline failsafe sets `[data-reveal-failsafe]` after a few seconds, so
    // every hidden rule has to be escapable by it or the page is only partly
    // rescued.
    // L-004: a pattern-gathered collection is asserted non-empty AND at its
    // expected size, or an empty match makes this unconditionally green.
    expect(revealGates).not.toBeNull();
    expect(revealGates).toHaveLength(REVEAL_GATE_COUNT);

    // Built from the exported constant, never from a second copy of the
    // literal: renaming the attribute must break this test, not slip past it
    // while the failsafe silently stops releasing anything.
    const escape = `:not([${REVEAL_FAILSAFE_ATTR}])`;
    const escapable = revealGates?.filter((rule) => rule.includes(escape));
    expect(escapable).toHaveLength(REVEAL_GATE_COUNT);
  });

  /**
   * `@keyframes stroke-draw` (and `donut-sweep`) declare only a `to`, so their
   * implicit `from` is the element's own computed value — and the `pending`
   * rule stops matching the instant the state flips to "in". If the start
   * value lives only there, the animation runs 0 -> 0 and the element simply
   * appears instead of drawing. §4 shipped that defect once for `[data-contour]`
   * and it was pinned below for that ONE selector only.
   *
   * Review fix round 1 (I5): task 4 added two more rules with the identical
   * repeat-or-break shape — `[data-thread-segment] path` and
   * `[data-familiar-arc]` — and neither was covered: deleting either rule's
   * repeated declarations was GREEN. Generalised into one table so a FOURTH
   * rule (any later section's thread segment) is one row, not a forgotten
   * pin. `requiredDasharray` is `null` for the donut arc because its
   * `stroke-dasharray` is set as an SVG attribute (`recommendation-donut.tsx`),
   * never a CSS declaration — there is nothing to repeat there, only the
   * dashoffset and the animation.
   */
  const DASH_REPETITION_CASES: Array<{
    label: string;
    selectorPattern: RegExp;
    requiredDasharray: RegExp | null;
    requiredDashoffset: RegExp;
    requiredAnimation: RegExp;
  }> = [
    {
      label: "[data-contour]",
      selectorPattern: /\[data-reveal="in"\] \[data-contour\] \{([^}]*)\}/,
      requiredDasharray: /stroke-dasharray:\s*1\b/,
      requiredDashoffset: /stroke-dashoffset:\s*1\b/,
      requiredAnimation: /animation:\s*stroke-draw/,
    },
    {
      label: "[data-thread-segment] path",
      selectorPattern: /\[data-reveal="in"\] \[data-thread-segment\] path \{([^}]*)\}/,
      requiredDasharray: /stroke-dasharray:\s*var\(--thread-dash\)/,
      requiredDashoffset: /stroke-dashoffset:\s*var\(--thread-dash\)/,
      requiredAnimation: /animation:\s*stroke-draw/,
    },
    {
      label: "[data-familiar-arc]",
      selectorPattern: /\[data-reveal="in"\] \[data-familiar-arc\] \{([^}]*)\}/,
      requiredDasharray: null,
      requiredDashoffset: /stroke-dashoffset:\s*var\(--donut-circumference\)/,
      requiredAnimation: /animation:\s*donut-sweep/,
    },
  ];

  it.each(DASH_REPETITION_CASES)(
    "repeats $label's dash start value on the revealed rule, not only the pending one",
    ({ selectorPattern, requiredDasharray, requiredDashoffset, requiredAnimation }) => {
      const revealed = css.match(selectorPattern);
      expect(revealed).not.toBeNull();
      const body = revealed?.[1] ?? "";
      if (requiredDasharray) expect(body).toMatch(requiredDasharray);
      expect(body).toMatch(requiredDashoffset);
      expect(body).toMatch(requiredAnimation);
    },
  );

  it("defines the primitive colour palette", () => {
    const missing = PRIMITIVE_TOKENS.filter(
      (token) => !new RegExp(`${token}\\s*:`).test(css),
    );
    expect(missing).toEqual([]);
  });

  it("defines every semantic colour as a var() alias of the correct primitive", () => {
    // Exact mappings from the adoption spec §3.2. Korume is dark-only, so there
    // is one block: `:root`. `--scrim` is deliberately a literal, not an alias.
    const mappings: Record<string, string> = {
      "--background": "--void-950",
      "--foreground": "--paper-50",
      "--card": "--void-850",
      "--card-foreground": "--paper-50",
      "--muted": "--void-900",
      "--muted-foreground": "--slate-400",
      "--input-background": "--void-900",
      "--border": "--slate-800",
      "--input": "--slate-800",
      "--ring": "--ember-500",
      "--primary": "--ember-500",
      "--primary-foreground": "--ink-950",
      "--primary-strong": "--ember-500",
      "--secondary": "--void-800",
      "--secondary-foreground": "--paper-50",
      "--accent": "--sand-400",
      "--accent-foreground": "--ink-950",
      "--accent-strong": "--sand-400",
      "--success": "--mint-400",
      "--success-strong": "--mint-400",
      "--danger": "--coral-400",
      "--danger-foreground": "--ink-950",
      "--danger-strong": "--coral-300",
      "--surface-overlay": "--void-850",
    };

    expect(Object.keys(mappings).sort()).toEqual([...SEMANTIC_COLOR_TOKENS].sort());

    for (const [token, primitive] of Object.entries(mappings)) {
      const pattern = new RegExp(String.raw`${token}:\s*var\(${primitive}\)`);
      expect(css, `${token} should alias ${primitive}`).toMatch(pattern);
    }

    expect(css).toMatch(/--scrim:\s*0 0% 0%/);
  });

  it("ships dark-only: no light theme block exists", () => {
    // The data-theme MECHANISM is retained (provider + toggle component stay);
    // only the values are single-theme. Adding a light block means this test and
    // the contrast test must both go back to asserting two themes.
    expect(css).not.toContain('[data-theme="light"]');
    expect(css).not.toContain('[data-theme="dark"]');
  });

  it("declares color-scheme: dark so UA-rendered chrome matches the palette", () => {
    // Without this, scrollbars, autofill backgrounds, native <select> popups
    // and checkboxes (incl. the reduce-motion toggle, CLAUDE.md §2.4) render
    // light by default even though the whole app is dark.
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark;/);
  });

  it("defines all five typeface roles", () => {
    for (const token of ["--font-sans", "--font-display", "--font-serif", "--font-mono", "--font-jp"]) {
      expect(css, `${token} must be defined`).toMatch(new RegExp(`${token}\\s*:`));
    }
  });

  it("keeps elevation single-theme and Korume-soft", () => {
    // Depth in Korume comes from the surface ladder (--background -> --card ->
    // --secondary), not from shadow: a black shadow on #0b0d11 is nearly
    // invisible by construction, which is the "almost invisible" quality the
    // design asks for. These three tokens only assist.
    expect(css).toMatch(/--elevation-raised:\s*0 1px 2px 0 rgb\(0 0 0 \/ 0\.24\)/);
    expect(css).toMatch(/--elevation-overlay:\s*0 8px 20px -4px rgb\(0 0 0 \/ 0\.32\)/);
    expect(css).toMatch(/--elevation-floating:\s*0 18px 40px -8px rgb\(0 0 0 \/ 0\.18\)/);
    // Each elevation token is defined exactly once — the dark override block is
    // gone with the rest of the two-theme structure.
    for (const token of ["--elevation-raised", "--elevation-overlay", "--elevation-floating"]) {
      expect(css.match(new RegExp(`${token}\\s*:`, "g"))?.length).toBe(1);
    }
  });

  it("keeps layout structure tokens out of the spacing namespace", () => {
    // --space-* is distance between elements; --layout-* is shell structure.
    // A structural dimension declared as a spacing step would let a later
    // contributor use `p-sidebar`, which is meaningless. Plan C1, spec D5.
    const layoutNames = css.match(/--layout-[a-z-]+(?=:)/g) ?? [];
    expect(layoutNames.length).toBeGreaterThanOrEqual(6);
    expect(layoutNames.filter((name) => name.startsWith("--layout-space"))).toEqual([]);

    const spacingNames = css.match(/--space-[a-z0-9-]+(?=:)/g) ?? [];
    expect(spacingNames).toContain("--space-md-lg");
    expect(spacingNames.some((name) => /sidebar|companion|content|gutter/.test(name))).toBe(false);
  });

  it("declares layout distances by reference to the spacing scale, never as raw px", () => {
    // D7: no new value may enter the system. --layout-gutter and
    // --layout-column-gap hold measured 36/28 rounded to existing steps, and
    // they must say so by referencing the step, not by restating a number.
    expect(css).toMatch(/--layout-gutter:\s*var\(--space-xl\)/);
    expect(css).toMatch(/--layout-column-gap:\s*var\(--space-lg\)/);
  });
});

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
    const easeMatch = css.match(/--thread-ease:\s*([^;]+);/)?.[1]?.trim();
    const durationMatch = css.match(/--thread-duration:\s*([^;]+);/)?.[1]?.trim();
    expect(easeMatch).toBeDefined();
    expect(durationMatch).toBeDefined();
    expect(easeMatch).toMatch(/^var\(--ease-[a-z0-9-]+\)$/);
    expect(durationMatch).toMatch(/^var\(--duration-[a-z0-9-]+\)$/);

    // Extract and verify the referenced tokens exist in globals.css
    const easeRef = easeMatch?.match(/var\(--ease-[a-z0-9-]+\)/)?.[0];
    const durationRef = durationMatch?.match(/var\(--duration-[a-z0-9-]+\)/)?.[0];
    if (easeRef) {
      const tokenName = easeRef.slice(4, -1); // Extract "--ease-..." from "var(...)"
      expect(css).toContain(`${tokenName}:`);
    }
    if (durationRef) {
      const tokenName = durationRef.slice(4, -1);
      expect(css).toContain(`${tokenName}:`);
    }
  });

  it("keeps thread colour as a var() alias, never a literal", () => {
    const colour = css.match(/--thread-color:\s*([^;]+);/)?.[1]?.trim();
    expect(colour).toBeDefined();
    expect(colour).toMatch(/^var\(--[a-z0-9-]+\)$/);
  });
});

/**
 * The contract's enforcement half: every thread rule must consume the shared
 * tokens and none may hardcode the invariants. Gathered by pattern, so the
 * count is asserted too — an empty match would make every claim below
 * unconditionally true (L-004).
 *
 * ⚠️ THREAD_RULE_COUNT is a STATE PIN, not an invariant: it says "this many
 * exist today". Every task that touches it RUNS the test, reads the actual
 * number, and sets the constant to it — never a number counted in your head.
 * Task 4 adds three matching rules (base, pending, in). Later sections bump it
 * only if they actually add a matching rule; several add none.
 */
const threadRules = css.match(/\[data-thread-segment[^\]]*\][^{]*\{[^}]*\}/g) ?? [];
const THREAD_RULE_COUNT = 3;

describe("thread continuity contract", () => {
  it("finds the thread rules it is about to make claims about", () => {
    expect(threadRules.length).toBe(THREAD_RULE_COUNT);
  });

  it("wraps --thread-color in hsl(), not a bare var()", () => {
    // Review fix round 1 (I3a). Every colour token in this file (spec §2.5) is
    // stored as bare HSL channels — `--accent: 29 75% 64%` — specifically so
    // Tailwind can compose `hsl(var(--accent) / <alpha-value>)`. Consuming one
    // as a raw `var()` in a plain CSS `stroke`/`color`/`background` property
    // hands the engine the invalid colour `29 75% 64%`; the whole declaration
    // is dropped and falls back to its initial value (`stroke: none`). That
    // shipped here once already — the thread segment was in the DOM, fully
    // drawn, `data-reveal="in"`, and invisible — and no existing test could
    // see it: nothing asserted the wrap, and the e2e that exists for "motion
    // never hides content" measures opacity only (I3b covers that gap).
    //
    // Checked against `threadRules` (the rule BODIES), not the raw `css`
    // string: this file's own docblock, two paragraphs up, quotes the broken
    // form (`stroke: var(--thread-color)`) as prose explaining the bug it
    // fixed — asserting on `css` directly makes this test fail against its
    // own correct code, for a reason that has nothing to do with the CSS.
    const threadRuleText = threadRules.join("\n");
    expect(threadRuleText).toMatch(/stroke:\s*hsl\(var\(--thread-color\)\)/);
    expect(threadRuleText).not.toMatch(/stroke:\s*var\(--thread-color\)/);
  });

  it("hardcodes none of the invariants in any thread rule", () => {
    // Local geometry is free; these seven are not.
    //
    // ⚠️ The negative lookahead sits directly after the colon, with no `\s*`
    // ahead of it: `stroke-linecap:\s*(?!var)` backtracks `\s*` to zero width
    // whenever the value is `var(...)` with a leading space (the file's own
    // style everywhere else), so the lookahead ends up checking " va" against
    // "var" — which never matches "var" literally — and the rule reads as
    // hardcoded even though it consumes the token. Verified both ways: with
    // the backtracking form, `stroke-linecap: var(--thread-cap);` (the actual
    // rule below) flags as a false positive; with the optional whitespace
    // moved INSIDE the lookahead, as here, it does not, and `stroke-linecap:
    // round;` still does.
    //
    // ⚠️ Review fix round 1 (I1): the FIRST version of this guard only checked
    // four of the seven `--thread-*` tokens — colour, opacity, and the
    // duration/easing pair written INSIDE the `animation:` shorthand (the only
    // form this repo uses; `animation-timing-function:` as a longhand appears
    // nowhere) all walked straight through. `stroke: #ff0000`, `opacity: 0.4`,
    // and either half of `animation: stroke-draw 600ms
    // cubic-bezier(0.16, 1, 0.3, 1) both` were all invisible to it. The two new
    // alternatives below close those: `stroke:` and `opacity:` follow the same
    // whitespace-inside-the-lookahead shape as `stroke-linecap:` above, and the
    // `animation:` alternative asserts the two tokens after `stroke-draw` are
    // EXACTLY `var(--thread-duration) var(--thread-ease)` — catching a
    // hardcoded duration, a hardcoded easing, or both, in one check. (The
    // lookahead ends on `(?=\s|;)`, not `\b`: `\b` requires a word/non-word
    // transition, and there is none between `)` and the following space, so a
    // trailing `\b` here would never match the correct value and the whole
    // alternative would false-positive on every well-formed rule — caught by
    // running the "good" CSS through it before trusting the pattern.)
    const forbidden =
      /stroke-width:\s*\d|stroke-linecap:(?!\s*var)|animation-timing-function:(?!\s*var)|stroke-dasharray:(?!\s*(?:var|1\b))|stroke:(?!\s*hsl\(var\(--thread-color\)\))|opacity:(?!\s*var\(--thread-opacity\))|animation:\s*stroke-draw\s+(?!var\(--thread-duration\)\s+var\(--thread-ease\)(?=\s|;))/;
    for (const rule of threadRules) {
      expect(rule, `a thread rule redefines an invariant:\n${rule}`).not.toMatch(forbidden);
    }
  });
});

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
