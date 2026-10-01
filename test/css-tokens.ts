/**
 * HSL token parsing and WCAG contrast maths shared by the token contrast tests
 * (`lib/design-tokens.contrast.test.ts`, `lib/shadowing-workspace/reading-theme.contrast.test.ts`).
 * Values come out of `app/globals.css`, so a token edit that breaks contrast fails a test, not a learner.
 */
export type Hsl = readonly [number, number, number];
export type Rgb = readonly [number, number, number];

/** Parses `--ember-500: 24 100% 62%;` definitions into an HSL lookup. */
export function parsePrimitives(source: string): Map<string, Hsl> {
  const primitives = new Map<string, Hsl>();
  const pattern = /(--[a-z0-9-]+):\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/g;
  for (const match of source.matchAll(pattern)) {
    const [, name, h, s, l] = match;
    if (name && h && s && l) primitives.set(name, [Number(h), Number(s), Number(l)]);
  }
  return primitives;
}

/** Parses `--primary: var(--ember-500)` aliases. */
export function parseAliases(source: string): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const match of source.matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)/g)) {
    const [, name, target] = match;
    if (name && target) aliases.set(name, target);
  }
  return aliases;
}

/** The body of the one rule whose selector is exactly `selector` (e.g. `[data-atmosphere="rainy_day"]`). */
export function ruleBody(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`no rule for ${selector}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  return source.slice(open + 1, close);
}

/** `--name: 0.12;` inside a rule body. */
export function numberToken(body: string, name: string): number {
  const match = new RegExp(`${name}:\\s*(\\d+(?:\\.\\d+)?)\\s*;`).exec(body);
  if (!match?.[1]) throw new Error(`${name} is not a plain number here`);
  return Number(match[1]);
}

export function hslToRgb([h, s, l]: Hsl): Rgb {
  const sat = s / 100;
  const light = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) =>
    light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

/** Composites `fg` at `alpha` over `bg` — what `bg-primary/10` actually paints. */
export function alphaBlend(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return [
    fg[0] * alpha + bg[0] * (1 - alpha),
    fg[1] * alpha + bg[1] * (1 - alpha),
    fg[2] * alpha + bg[2] * (1 - alpha),
  ];
}
