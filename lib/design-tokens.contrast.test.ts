import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * WCAG AA contrast contract for the semantic colour tiers (CLAUDE.md §5 — a11y
 * is a requirement, not a nice-to-have; spec §2.9 — invariants are enforced by
 * tests, not reviewer memory).
 *
 * Values are parsed out of `app/globals.css` rather than duplicated here, so a
 * token edit that breaks contrast fails THIS test rather than shipping.
 *
 * The pairing that matters most is the "tint" pattern used in 13 places
 * (badge, app-nav active state, admin shell, auth error, JLPT navigator,
 * dictation view, recommendation rail…):
 *
 *     bg-<c>/10 text-<c>-strong
 *
 * A 10%-alpha fill barely shifts the surface, so the text is effectively
 * sitting on the raw surface — and the tint still costs ~0.7 of contrast
 * versus the bare surface. Measuring the BLENDED background is therefore not
 * a detail; measuring the unblended one would report a pass that users do not
 * experience.
 *
 * Bar is a flat 4.5:1: badge text is 12px at weight 500, which is not "large
 * text" under WCAG 2.1 (that needs 18.66px bold or 24px), so no pairing here
 * qualifies for the 3:1 exemption.
 */
const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

const AA_NORMAL_TEXT = 4.5;

type Hsl = readonly [number, number, number];
type Rgb = readonly [number, number, number];

/** Parses `--ember-500: 24 100% 62%;` definitions into an HSL lookup. */
function parsePrimitives(source: string): Map<string, Hsl> {
  const primitives = new Map<string, Hsl>();
  const pattern = /(--[a-z0-9-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/g;
  for (const match of source.matchAll(pattern)) {
    const [, name, h, s, l] = match;
    if (name && h && s && l) primitives.set(name, [Number(h), Number(s), Number(l)]);
  }
  return primitives;
}

const primitives = parsePrimitives(css);

/** Parses `--primary: var(--ember-500)` aliases. */
function parseAliases(source: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const match of source.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/g)) {
    const [, name, target] = match;
    if (name && target) aliases.set(name, target);
  }
  return aliases;
}

/**
 * Korume ships dark-only (2026-08-06 adoption spec §2.2): every semantic value
 * lives in `:root` and there is no second theme block to diff against. The
 * `data-theme` mechanism is retained, so if a light block is ever added this
 * file must go back to asserting both.
 */
const theme = parseAliases(css);

function resolve(token: string): Hsl {
  const target = theme.get(token);
  if (!target) throw new Error(`${token} is not defined as a var() alias`);
  const hsl = primitives.get(target);
  if (!hsl) throw new Error(`${token} aliases ${target}, which has no HSL definition`);
  return hsl;
}

function hslToRgb([h, s, l]: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Composites `fg` at `alpha` over `bg` — what `bg-primary/10` actually paints. */
function alphaBlend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}

/** Surfaces a tinted element can actually sit on in this app. */
const SURFACES = ["--card", "--background", "--muted"] as const;

/** The four semantic colours used with the `bg-X/10 text-X-strong` pattern. */
const TINTED = ["primary", "accent", "success", "danger"] as const;

describe("design token contrast (WCAG AA)", () => {
  it("defines a -strong text tone for every tinted colour", () => {
    const missing = TINTED.filter((name) => !theme.has(`--${name}-strong`));
    expect(missing).toEqual([]);
  });

  it("tinted pattern (bg-X/10 + text-X-strong) meets 4.5:1 on every surface", () => {
    const failures: string[] = [];
    for (const name of TINTED) {
      const fill = hslToRgb(resolve(`--${name}`));
      const text = hslToRgb(resolve(`--${name}-strong`));
      for (const surface of SURFACES) {
        const blended = alphaBlend(fill, hslToRgb(resolve(surface)), 0.1);
        const ratio = contrastRatio(text, blended);
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(
            `${name}-strong on ${surface} tint: ${ratio.toFixed(2)}:1 (needs ${AA_NORMAL_TEXT})`,
          );
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("plain -strong text meets 4.5:1 on every surface", () => {
    const failures: string[] = [];
    for (const name of TINTED) {
      const text = hslToRgb(resolve(`--${name}-strong`));
      for (const surface of SURFACES) {
        const ratio = contrastRatio(text, hslToRgb(resolve(surface)));
        if (ratio < AA_NORMAL_TEXT) {
          failures.push(`${name}-strong on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("solid fills keep their paired foreground legible", () => {
    const failures: string[] = [];
    for (const [fill, foreground] of [
      ["--primary", "--primary-foreground"],
      ["--accent", "--accent-foreground"],
      ["--secondary", "--secondary-foreground"],
    ] as const) {
      const ratio = contrastRatio(hslToRgb(resolve(foreground)), hslToRgb(resolve(fill)));
      if (ratio < AA_NORMAL_TEXT) failures.push(`${foreground} on ${fill}: ${ratio.toFixed(2)}:1`);
    }
    expect(failures).toEqual([]);
  });

  it("body and muted text meet 4.5:1 on every surface", () => {
    const failures: string[] = [];
    for (const text of ["--foreground", "--muted-foreground"] as const) {
      for (const surface of SURFACES) {
        const ratio = contrastRatio(hslToRgb(resolve(text)), hslToRgb(resolve(surface)));
        if (ratio < AA_NORMAL_TEXT) failures.push(`${text} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }
    expect(failures).toEqual([]);
  });
});
