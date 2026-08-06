import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { StyleGuide } from "./style-guide";

/**
 * Smoke coverage only: every section of the executable spec renders inside
 * the real providers. Behaviour of each primitive is covered by its own
 * test file; visual verification is the page's own job (D9).
 *
 * ToastProvider wraps the render because PrimitiveSections calls useToast();
 * ThemeProvider wraps it because ThemeToggle/ReduceMotionToggle call
 * useTheme(). The real page gets both from app/[locale]/layout.tsx, nested
 * in this same order (ThemeProvider > ToastProvider > children).
 */
function renderGuide() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <StyleGuide />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe("StyleGuide", () => {
  it("renders every section", () => {
    renderGuide();
    for (const heading of [
      "Colour",
      "Typography",
      "Spacing",
      "Radius",
      "Elevation",
      "Motion",
      "Z-index",
      "Primitives",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading }),
      ).toBeInTheDocument();
    }
  });

  it("shows the locale-stress samples (VN diacritics + Japanese)", () => {
    renderGuide();
    // getAllByText, not getByText: the Vietnamese sample line is repeated
    // once per row of TYPE_SCALE in token-sections.tsx (by design — every
    // type-scale step demos the same stress string), so multiple matches
    // are expected here.
    expect(
      screen.getAllByText(/Học tiếng Nhật qua phim/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/映画で日本語を学ぶ/)).toBeInTheDocument();
  });

  it("shows all five font-role samples, each carrying a two-tier-diacritic VN sample (or JP for font-jp)", () => {
    renderGuide();
    // The four Latin roles (font-sans/display/serif/mono) share one VN
    // stress string — repeated once per role, so getAllByText.
    expect(
      screen.getAllByText(/Học tiếng Nhật cùng Korume/).length,
    ).toBe(4);
    expect(screen.getByText(/日本語 · 話す · ひらがな/)).toBeInTheDocument();
    for (const cls of ["font-sans", "font-display", "font-serif", "font-mono", "font-jp"]) {
      expect(screen.getByText(cls)).toBeInTheDocument();
    }
  });

  it("shows all four radius steps with their pixel values", () => {
    renderGuide();
    for (const [cls, px] of [
      ["rounded-sm", 8],
      ["rounded-md", 14],
      ["rounded-lg", 20],
      ["rounded-xl", 28],
    ] as const) {
      expect(screen.getByText(new RegExp(`${cls} · ${px}px`))).toBeInTheDocument();
    }
  });

  it("lists every colour token defined in globals.css", () => {
    // token-sections.tsx claims "a token added to globals.css without being
    // listed here shows up in review". That was only a comment, and it did
    // silently drift when the -strong text tones landed. This makes the claim
    // real: the executable spec (D9) cannot under-report the palette.
    const css = readFileSync(
      path.join(process.cwd(), "app/globals.css"),
      "utf8",
    );
    // Colour tokens only: `H S% L%` triples (primitives) and var() aliases of
    // them (semantics). Excludes spacing/type/elevation/motion/z, which the
    // other sections own.
    const colourTokens = new Set<string>();
    for (const [, name] of css.matchAll(
      /(--[a-z0-9-]+):\s*\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%/g,
    )) {
      if (name) colourTokens.add(name);
    }
    // The alias pass must check its TARGET, not just its shape: `--x: var(--y)`
    // is not colour-specific syntax — the foundation block uses the exact same
    // pattern for non-colour fallbacks (e.g. `--font-display: var(--font-sans)`
    // in the typography system, spec 2026-08-06 §4). Only count an alias whose
    // target already landed in colourTokens from the primitive pass above, so
    // a future non-colour var() alias doesn't silently get treated as a colour
    // and fail this test for the wrong reason. Every current semantic aliases
    // a PRIMITIVE directly (verified against app/globals.css, 2026-08-06) —
    // none aliases another semantic — so one pass over colourTokens as it
    // stood after the primitive loop is sufficient; if that ever changes, this
    // needs to iterate to a fixed point instead of a single pass.
    for (const [, name, target] of css.matchAll(
      /(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/g,
    )) {
      if (name && target && colourTokens.has(target)) colourTokens.add(name);
    }

    renderGuide();
    const missing = [...colourTokens].filter(
      (token) => screen.queryAllByText(token).length === 0,
    );
    expect(missing, "colour tokens missing from the style guide").toEqual([]);
  });

  it("demos every primitive", () => {
    renderGuide();
    for (const name of [
      "Button",
      "Badge",
      "Skeleton",
      "Dialog",
      "Tabs",
      "Select",
      "Tooltip",
      "Popover",
      "Toast",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });
});
