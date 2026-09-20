import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import resolveConfig from "tailwindcss/resolveConfig";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import tailwindConfig from "../../tailwind.config";
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

function collectProductSources(directory: string): string[] {
  const sources: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) sources.push(...collectProductSources(file));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) sources.push(file);
  }
  return sources;
}

/**
 * Comments are removed so that a utility *named in prose* is not counted as a
 * call site (`docs/lessons.md` L-002: anchor the assertion to code, not to the
 * word). `//` preceded by `:` is left alone so a URL inside a string survives.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/**
 * True when the file draws `utility` anywhere in its code, as a whole class
 * token. Deliberately NOT anchored to `className=`: this repo extracts class
 * strings into module constants (`PHOTO_LEFT_FADE`, `CTA_SCRIM`,
 * `SHOWCASE_COLUMNS`, …) that reach the DOM through a template literal, and a
 * `className=`-anchored match walks straight past every one of them. That hole
 * was demonstrated on 2026-09-21: `rounded-xl` added to `PHOTO_LEFT_FADE`
 * rendered live and the guard stayed green.
 */
function drawsUtility(source: string, utility: string): boolean {
  const escaped = utility.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(stripComments(source));
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

  it("shows all three radius steps with their pixel values", () => {
    renderGuide();
    for (const [cls, px] of [
      ["rounded-sm", 8],
      ["rounded-md", 14],
      ["rounded-lg", 20],
    ] as const) {
      expect(screen.getByText(new RegExp(`${cls} · ${px}px`))).toBeInTheDocument();
    }
  });

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
    expect(resolveConfig(tailwindConfig).theme.borderRadius.xl).toBeUndefined();

    const productSources = ["components", "app"].flatMap((root) =>
      collectProductSources(path.join(process.cwd(), root)),
    );
    expect(productSources.length).toBeGreaterThan(6);
    const sourcesWith = (utility: string) => productSources.filter((file) =>
      drawsUtility(readFileSync(file, "utf8"), utility),
    );
    expect(sourcesWith("rounded-xl")).toEqual([]);
    expect(sourcesWith("rounded-[22px]")).toEqual([]);
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
