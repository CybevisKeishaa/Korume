import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Spec §4: the token scale existed but only five of thirteen primitives used
 * it. button, card and input appear on nearly every screen — if they still
 * read `px-4 py-2 text-sm gap-2` when porting begins, every ported screen
 * copies those numbers by imitation.
 *
 * This pins the fix. It is narrower than Rule #0 (which forbids arbitrary
 * literals): raw Tailwind numeric spacing is legal Tailwind, just not the
 * design system's vocabulary.
 */
// Two things this regex must NOT do, both verified by measurement against the
// current tree:
//   - `p-2xs` / `py-2xs` / `gap-2xs` are TOKENS. A naive /\bp-\d/ matches their
//     "p-2" prefix and reports five clean files as dirty. Hence the trailing
//     (?![\w-]).
//   - `pt-0` is legitimate — zero needs no token, and card.tsx keeps it. Hence
//     the numeric alternation, which accepts 0.5 but not a bare 0.
const RAW = [
  // `[trblxyse]`, not `[trblxy]` (final whole-branch review F6, 2026-08-07):
  // `logical-properties.test.ts` already bans the physical `pl-`/`pr-`/`ml-`/
  // `mr-` forms in this directory, so the old `[trblxy]` class only ever
  // caught spacing this file's own sibling test already forbade — it never
  // covered the logical `ps-`/`pe-`/`ms-`/`me-` forms this codebase actually
  // uses (see `toast.tsx`'s `end-4`, an inset rather than padding/margin, but
  // the same logical-direction gap). Adding `s`/`e` closes it.
  /\b[pm][trblxyse]?-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // p-6 / px-3 / py-2 / ps-4 / py-0.5
  /\bgap(-[xy])?-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // gap-2
  /\bspace-[xy]-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // space-y-1.5
  /\btext-(xs|sm|base|lg|xl|\dxl)\b/, // text-sm / text-lg / text-base
  // Insets (final whole-branch review F6): `top-`/`bottom-`/`start-`/`end-`/
  // `inset-` never went through `[pm]…`, so `toast.tsx`'s `bottom-4 end-4`
  // (16px = `--space-md`) sailed past every existing pattern undetected. The
  // trailing `(?![\w/-])` also excludes the `/` a fractional inset like
  // `inset-1/2` would introduce — fractions aren't part of the spacing
  // token scale and aren't what this rule is about.
  /\b(?:top|bottom|start|end|inset(?:-[xy])?)-(0\.\d+|[1-9][\d.]*)(?![\w/-])/, // bottom-4 / end-4 / inset-2
];

// Directory-scanned, not hardcoded (final whole-branch review F6): the
// original 8-name list meant a NEW primitive dropped into `components/ui/`
// was free to use `px-4 text-sm` and nothing here would ever see it — and
// `tabs.tsx`/`tooltip.tsx`/`popover.tsx`/`skeleton.tsx` were already sitting
// in the directory, clean today, but unpinned. Mirrors
// `token-scale.test.ts`'s `collectSources` so both enforcement tests read the
// same primitive set.
const EXCLUDED = new Set([
  // Shell geometry, explicitly out of scope for this token-adoption plan
  // (final-fix-wave DO NOT FIX list) — every number in it is a deliberate
  // layout measurement, not a spacing/type-scale primitive.
  "container.tsx",
]);

const uiDir = path.join(process.cwd(), "components/ui");

function collectPrimitives(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      files.push(...collectPrimitives(path.join(dir, entry.name)));
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (entry.name.includes(".test.")) continue;
    if (EXCLUDED.has(entry.name)) continue;
    files.push(entry.name);
  }
  return files;
}

const FILES = collectPrimitives(uiDir);

describe("primitives use the design system's own scales (spec §4)", () => {
  it("scans a non-empty set of primitives", () => {
    expect(FILES.length).toBeGreaterThan(0);
  });

  it.each(FILES)("%s uses no raw Tailwind spacing or font size", (file) => {
    const text = readFileSync(path.join(uiDir, file), "utf8");
    const hits = RAW.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });
});

it("uses the kebab-case field-fill utility, not the camelCase outlier", () => {
  for (const file of ["input.tsx", "select.tsx"]) {
    const text = readFileSync(
      path.join(process.cwd(), "components/ui", file),
      "utf8",
    );
    expect(text).not.toContain("bg-inputBackground");
    expect(text).toContain("bg-input-background");
  }
});
