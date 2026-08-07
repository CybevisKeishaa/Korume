import { readFileSync } from "node:fs";
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
  /\b[pm][trblxy]?-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // p-6 / px-3 / py-2 / py-0.5
  /\bgap(-[xy])?-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // gap-2
  /\bspace-[xy]-(0\.\d+|[1-9][\d.]*)(?![\w-])/, // space-y-1.5
  /\btext-(xs|sm|base|lg|xl|\dxl)\b/, // text-sm / text-lg / text-base
];

const FILES = [
  "button.tsx",
  "card.tsx",
  "input.tsx",
  "label.tsx",
  "badge.tsx",
  "dialog.tsx",
  "toast.tsx",
  "select.tsx",
];

describe("primitives use the design system's own scales (spec §4)", () => {
  it.each(FILES)("%s uses no raw Tailwind spacing or font size", (file) => {
    const text = readFileSync(
      path.join(process.cwd(), "components/ui", file),
      "utf8",
    );
    const hits = RAW.filter((pattern) => pattern.test(text));
    expect(hits).toEqual([]);
  });
});
