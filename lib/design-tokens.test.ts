import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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

const REQUIRED_TOKENS = [
  // spacing
  "--space-2xs", "--space-xs", "--space-sm", "--space-md",
  "--space-lg", "--space-xl", "--space-2xl", "--space-3xl",
  // radius — declared absolutely, never derived. A calc()-chained scale means
  // one edit to the base silently skews every other step.
  "--radius", "--radius-sm", "--radius-md", "--radius-lg", "--radius-xl",
  // typography
  "--text-caption", "--text-body", "--text-body-lg", "--text-heading",
  "--text-title", "--text-display",
  "--leading-caption", "--leading-body", "--leading-body-lg",
  "--leading-heading", "--leading-title", "--leading-display", "--leading-jp",
  "--font-weight-regular", "--font-weight-medium", "--font-weight-semibold",
  "--font-weight-bold",
  "--tracking-tight", "--tracking-wide",
  // elevation
  "--elevation-raised", "--elevation-overlay", "--elevation-floating",
  // motion
  "--duration-fast", "--duration-base", "--duration-slow",
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
// WHOLE table from the adoption spec §3.2 — a half-updated list reads as
// protection while leaving new tokens unguarded.
const SEMANTIC_COLOR_TOKENS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--muted", "--muted-foreground", "--input-background",
  "--border", "--input", "--ring",
  "--primary", "--primary-foreground", "--primary-strong",
  "--secondary", "--secondary-foreground",
  "--accent", "--accent-foreground", "--accent-strong",
  "--success", "--success-strong",
  "--danger", "--danger-strong",
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
});
