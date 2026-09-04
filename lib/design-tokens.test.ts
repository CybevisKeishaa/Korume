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
const REVEAL_GATE_COUNT = 5;

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

  it("declares the contour dash offset on the revealed rule, not only the pending one", () => {
    // `@keyframes stroke-draw` declares only a `to`, so its implicit `from` is
    // the element's own computed value — and the `pending` rule stops matching
    // the instant the state flips to "in". If the start value lives only there,
    // the animation runs 0 -> 0 and §4's contours appear instead of drawing.
    // That shipped once and no unit test could see it, so it is pinned here.
    const revealed = css.match(
      /\[data-reveal="in"\] \[data-contour\] \{([^}]*)\}/,
    );
    expect(revealed).not.toBeNull();
    const body = revealed?.[1] ?? "";
    expect(body).toMatch(/stroke-dasharray:\s*1/);
    expect(body).toMatch(/stroke-dashoffset:\s*1/);
    expect(body).toMatch(/animation:\s*stroke-draw/);
  });

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
