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
  "--washi-50", "--washi-100", "--white", "--sumi-900",
  "--neutral-100", "--neutral-300", "--neutral-400", "--neutral-600",
  "--ink-700", "--ink-800", "--ink-900", "--ink-950",
  "--vermilion-400", "--vermilion-500",
  "--indigo-300", "--indigo-600",
  "--green-400", "--green-600", "--red-400", "--red-600",
];

// The semantic tier must be var() aliases of primitives in BOTH themes —
// that indirection is the whole point (L9b restyles by remapping it).
const SEMANTIC_COLOR_TOKENS = [
  "--background", "--foreground", "--card", "--card-foreground",
  "--muted", "--muted-foreground", "--border", "--input", "--ring",
  "--primary", "--primary-foreground", "--accent", "--accent-foreground",
  "--success", "--danger", "--surface-overlay",
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

  it("defines every semantic colour as a var() alias of a primitive, in both themes", () => {
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const token of SEMANTIC_COLOR_TOKENS) {
      expect(css).toMatch(new RegExp(`${token}:\\s*var\\(--`));
      expect(darkBlock).toMatch(new RegExp(`${token}:\\s*var\\(--`));
    }
    // --scrim is theme-independent: defined once, not remapped in dark.
    expect(css).toMatch(/--scrim:\s*0 0% 0%/);
  });
});
