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
  "--vermilion-300", "--vermilion-400", "--vermilion-500", "--vermilion-700",
  "--indigo-300", "--indigo-600",
  "--green-400", "--green-600", "--green-700",
  "--red-300", "--red-400", "--red-600", "--red-700",
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
    // Exact mappings extracted from globals.css (source of truth).
    // These enforce the contract: each semantic token must alias EXACTLY the correct primitive.
    const lightMappings: Record<string, string> = {
      "--background": "--washi-50",
      "--foreground": "--sumi-900",
      "--card": "--white",
      "--card-foreground": "--sumi-900",
      "--muted": "--neutral-100",
      "--muted-foreground": "--neutral-600",
      "--border": "--neutral-300",
      "--input": "--neutral-300",
      "--ring": "--vermilion-500",
      "--primary": "--vermilion-500",
      "--primary-foreground": "--washi-50",
      "--accent": "--indigo-600",
      "--accent-foreground": "--washi-50",
      "--success": "--green-600",
      "--danger": "--red-600",
      "--surface-overlay": "--white",
    };

    const darkMappings: Record<string, string> = {
      "--background": "--ink-950",
      "--foreground": "--washi-100",
      "--card": "--ink-900",
      "--card-foreground": "--washi-100",
      "--muted": "--ink-800",
      "--muted-foreground": "--neutral-400",
      "--border": "--ink-700",
      "--input": "--ink-700",
      "--ring": "--vermilion-400",
      "--primary": "--vermilion-400",
      "--primary-foreground": "--ink-950",
      "--accent": "--indigo-300",
      "--accent-foreground": "--ink-950",
      "--success": "--green-400",
      "--danger": "--red-400",
      "--surface-overlay": "--ink-900",
    };

    // Extract light block (everything before first [data-theme="dark"])
    const lightBlockEnd = css.indexOf('[data-theme="dark"]');
    const lightBlock = css.substring(0, lightBlockEnd);

    // Extract first [data-theme="dark"] colour block (not the elevation overrides block)
    const darkStart = css.indexOf('[data-theme="dark"]');
    const blockOpenBrace = css.indexOf("{", darkStart);
    let braceCount = 1;
    let endPos = blockOpenBrace + 1;
    while (endPos < css.length && braceCount > 0) {
      if (css[endPos] === "{") braceCount++;
      if (css[endPos] === "}") braceCount--;
      endPos++;
    }
    const darkBlock = css.substring(darkStart, endPos);

    // Assert light theme: each semantic token aliases exactly the expected primitive
    for (const [token, primitive] of Object.entries(lightMappings)) {
      const pattern = new RegExp(String.raw`${token}:\s*var\(${primitive}\)`);
      expect(lightBlock, `Light theme: ${token} should alias ${primitive}`).toMatch(pattern);
    }

    // Assert dark theme: each semantic token aliases exactly the expected primitive
    for (const [token, primitive] of Object.entries(darkMappings)) {
      const pattern = new RegExp(String.raw`${token}:\s*var\(${primitive}\)`);
      expect(darkBlock, `Dark theme: ${token} should alias ${primitive}`).toMatch(pattern);
    }

    // --scrim is theme-independent: defined in light, NOT redefined in dark
    expect(css).toMatch(/--scrim:\s*0 0% 0%/);
    expect(darkBlock).not.toMatch(/--scrim/);
  });
});
