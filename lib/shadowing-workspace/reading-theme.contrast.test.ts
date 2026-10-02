import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { READING_COLOR_PRESET_OPTIONS, READING_EMPHASIS_OPTIONS, STUDY_ATMOSPHERE_OPTIONS } from "@/lib/preferences/options";
import { alphaBlend, contrastRatio, hslToRgb, numberToken, parseAliases, parsePrimitives, ruleBody, type Rgb } from "@/test/css-tokens";

/**
 * spec §6.2: contrast is verified on the cross product `reading_color_preset × atmosphere` (4 × 7) against
 * the EFFECTIVE background — the preset surface, then the atmosphere's glass, then its temperature overlay,
 * exactly the layers `.reading-surface` paints — ≥ 4.5:1 for body text. The current sentence adds the
 * emphasis tint on top, so it is checked at every emphasis.
 */
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8").replace(/\r\n/g, "\n");
const primitives = parsePrimitives(css);
// Only what `:root` itself declares: a whole-file alias map is last-one-wins, so a token missing from a preset
// rule would silently be measured with ANOTHER preset's value (T10 review M-3).
const rootAliases = parseAliases([...css.matchAll(/^:root \{([\s\S]*?)\n\}/gm)].map((match) => match[1]).join("\n"));
const AA = 4.5;

function colour(body: string, token: string): Rgb {
  const target = parseAliases(body).get(token) ?? rootAliases.get(token);
  if (!target) throw new Error(`${token} is not a var() alias`);
  const hsl = primitives.get(target);
  if (!hsl) throw new Error(`${token} aliases ${target}, which has no HSL primitive`);
  return hslToRgb(hsl);
}

describe("reading theme contrast (spec §6.2, WCAG AA)", () => {
  it("finds every reading colour in its own preset rule, never by fallback", () => {
    for (const preset of READING_COLOR_PRESET_OPTIONS) {
      const own = parseAliases(ruleBody(css, `[data-reading-preset="${preset}"]`));
      for (const token of ["--reading-surface", "--reading-foreground", "--reading-muted", "--reading-current-surface"]) expect(own.has(token), `${preset} ${token}`).toBe(true);
    }
  });

  it("covers every preset, atmosphere and emphasis the options module defines", () => {
    for (const preset of READING_COLOR_PRESET_OPTIONS) expect(() => ruleBody(css, `[data-reading-preset="${preset}"]`)).not.toThrow();
    for (const atmosphere of STUDY_ATMOSPHERE_OPTIONS) expect(() => ruleBody(css, `[data-atmosphere="${atmosphere}"]`)).not.toThrow();
    for (const emphasis of READING_EMPHASIS_OPTIONS) expect(() => ruleBody(css, `[data-reading-emphasis="${emphasis}"]`)).not.toThrow();
  });

  it("keeps foreground, muted and accent text ≥ 4.5:1 on every effective surface", () => {
    const failures: string[] = [];
    const accent = colour("", "--primary-strong");
    for (const preset of READING_COLOR_PRESET_OPTIONS) {
      const presetBody = ruleBody(css, `[data-reading-preset="${preset}"]`);
      const foreground = colour(presetBody, "--reading-foreground");
      const muted = colour(presetBody, "--reading-muted");
      const tint = colour(presetBody, "--reading-current-surface");
      for (const atmosphere of STUDY_ATMOSPHERE_OPTIONS) {
        const place = ruleBody(css, `[data-atmosphere="${atmosphere}"]`);
        const glassed = alphaBlend(colour(place, "--atmosphere-glass"), colour(presetBody, "--reading-surface"), numberToken(place, "--atmosphere-glass-alpha"));
        const surface = alphaBlend(colour(place, "--atmosphere-overlay"), glassed, numberToken(place, "--atmosphere-overlay-alpha"));
        const surfaces: [string, Rgb][] = [["surface", surface]];
        for (const emphasis of READING_EMPHASIS_OPTIONS) {
          const alpha = numberToken(ruleBody(css, `[data-reading-emphasis="${emphasis}"]`), "--reading-current-alpha");
          surfaces.push([`current sentence (${emphasis})`, alphaBlend(tint, surface, alpha)]);
        }
        for (const [where, background] of surfaces) {
          for (const [text, rgb] of [["--reading-foreground", foreground], ["--reading-muted", muted], ["--primary-strong", accent]] as const) {
            const ratio = contrastRatio(rgb, background);
            if (ratio < AA) failures.push(`${preset} × ${atmosphere}: ${text} on ${where} ${ratio.toFixed(2)}:1`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("Part 1b drawer and popover contrast (plan Task 15, WCAG AA)", () => {
  /** The text tokens the drawer tabs, cards and the selection popover actually paint with. */
  const APP_TEXT = ["--foreground", "--muted-foreground", "--primary-strong"] as const;

  it("keeps the drawer's text ≥ 4.5:1 on the drawer's own surface, every preset × atmosphere", () => {
    // The drawer is a `.reading-surface`: the preset surface under the atmosphere's glass and overlay.
    const failures: string[] = [];
    for (const preset of READING_COLOR_PRESET_OPTIONS) {
      const presetBody = ruleBody(css, `[data-reading-preset="${preset}"]`);
      for (const atmosphere of STUDY_ATMOSPHERE_OPTIONS) {
        const place = ruleBody(css, `[data-atmosphere="${atmosphere}"]`);
        const glassed = alphaBlend(colour(place, "--atmosphere-glass"), colour(presetBody, "--reading-surface"), numberToken(place, "--atmosphere-glass-alpha"));
        const surface = alphaBlend(colour(place, "--atmosphere-overlay"), glassed, numberToken(place, "--atmosphere-overlay-alpha"));
        for (const text of APP_TEXT) {
          const ratio = contrastRatio(colour(presetBody, text), surface);
          if (ratio < AA) failures.push(`${preset} × ${atmosphere}: ${text} ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps the selection popover's text ≥ 4.5:1 on its overlay surface, every preset", () => {
    const failures: string[] = [];
    for (const preset of READING_COLOR_PRESET_OPTIONS) {
      const presetBody = ruleBody(css, `[data-reading-preset="${preset}"]`);
      // `bg-overlay` is `--surface-overlay` (tailwind.config.ts).
      const surface = colour(presetBody, "--surface-overlay");
      for (const text of APP_TEXT) {
        const ratio = contrastRatio(colour(presetBody, text), surface);
        if (ratio < AA) failures.push(`${preset}: ${text} ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("study environment CSS (spec §6.2)", () => {
  it("removes particles under Reduce Motion — the app toggle and the OS setting — instead of slowing them", () => {
    expect(css).toMatch(/:root\[data-reduce-motion="true"\] \.atmosphere-particles \{\s*display: none;\s*\}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.atmosphere-particles \{\s*display: none;\s*\}\s*\}/);
  });

  it("never lets an atmosphere set a text colour", () => {
    for (const atmosphere of STUDY_ATMOSPHERE_OPTIONS) {
      const body = ruleBody(css, `[data-atmosphere="${atmosphere}"]`);
      expect(body, atmosphere).not.toMatch(/(^|[\s;])color\s*:/);
      expect(body, atmosphere).not.toMatch(/--reading-(foreground|muted)\s*:/);
    }
  });
});
