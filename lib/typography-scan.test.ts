import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TYPE_EXEMPTIONS } from "./typography-allowlist";

/**
 * Spec G1 (type-normalization, 2026-10-14). Interface type in the learner app uses the --text-* tokens only.
 * Walks DIRECTORIES, not a list of files: a new screen is in scope the day it is created, which is exactly
 * what the per-directory scopes of components/ui/token-scale.test.ts could not give.
 */
const ROOTS = ["components", "app/[locale]/(protected)/(app)", "app/[locale]/(protected)/(focus)"];
/** Declared out of scope by the spec (§1), not exemptions. */
const OUT_OF_SCOPE = ["components/admin/", "components/auth/", "components/marketing/", "components/vocabulary-print/", "components/style-guide/"];
/** CSS rules out of scope: the printable worksheet, set in physical units. */
const OUT_OF_SCOPE_SELECTOR = /^\.vp-/;
/** Spec O5 is complete: no cluster is pending. This stays empty — a new exclusion is an allowlist entry
 *  (one element, one reason) or a migration, never a pending directory. */
export const PENDING_MIGRATION: readonly string[] = [];

const SIZE_CLASS = /(?<![\w-])(text-(?:xs|sm|base|lg|xl|[2-9]xl)|text-\[(?:\d|\.|length:|calc\(|clamp\(|min\(|max\()[^\]]*\])(?![\w-])/g;
const LEADING_CLASS = /(?<![\w-])(leading-(?:none|tight|snug|normal|relaxed|loose|\d+)|leading-\[[^\]]+\])(?![\w-])/g;
const INLINE = /\b(fontSize|lineHeight)\s*:/g;
const TOKEN_VALUE = /^var\(--(?:text|leading)-[a-z-]+\)$/;

interface Violation { file: string; line: number; text: string; kind: "size" | "leading"; selector?: string }

const posix = (p: string) => p.split(path.sep).join("/");

function sourceFiles(): string[] {
  return ROOTS.flatMap((root) =>
    (readdirSync(root, { recursive: true }) as string[])
      .map((rel) => posix(path.join(root, rel)))
      .filter((file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file))
      .filter((file) => !OUT_OF_SCOPE.some((dir) => file.startsWith(dir))));
}

export function scanSource(file: string, text: string): Violation[] {
  const out: Violation[] = [];
  text.split(/\r?\n/).forEach((lineText, index) => {
    for (const m of lineText.matchAll(SIZE_CLASS)) out.push({ file, line: index + 1, text: m[1]!, kind: "size" });
    for (const m of lineText.matchAll(LEADING_CLASS)) out.push({ file, line: index + 1, text: m[1]!, kind: "leading" });
    for (const m of lineText.matchAll(INLINE)) out.push({ file, line: index + 1, text: `${m[1]}:`, kind: m[1] === "lineHeight" ? "leading" : "size" });
  });
  return out;
}

export function scanCss(file: string, css: string): Violation[] {
  const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")); // keep line numbers
  const out: Violation[] = [];
  for (const rule of blanked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1]!.trim().replace(/\s+/g, " ");
    if (OUT_OF_SCOPE_SELECTOR.test(selector)) continue;
    const line = blanked.slice(0, rule.index! + rule[1]!.length).split("\n").length;
    for (const decl of rule[2]!.matchAll(/(?:^|;)\s*(font-size|line-height)\s*:\s*([^;]+)/g)) {
      const value = decl[2]!.trim();
      if (TOKEN_VALUE.test(value) || value === "inherit") continue;
      out.push({ file, line, text: `${selector} { ${decl[1]}: ${value} }`, kind: decl[1] === "line-height" ? "leading" : "size", selector });
    }
  }
  return out;
}

const lines = new Map<string, string[]>();
const lineOf = (v: Violation) => {
  if (!lines.has(v.file)) lines.set(v.file, readFileSync(v.file, "utf8").split(/\r?\n/));
  return lines.get(v.file)![v.line - 1] ?? "";
};
const exempts = (v: Violation) => TYPE_EXEMPTIONS.find((entry) =>
  entry.file === v.file
  && (v.selector !== undefined ? entry.match === v.selector : lineOf(v).includes(entry.match))
  && (entry.scope === "all" || v.kind === "leading"));
const under = (v: Violation, prefix: string) =>
  prefix.startsWith("css:") ? v.selector?.startsWith(prefix.slice(4)) === true : v.file.startsWith(prefix);
const pending = (v: Violation) => PENDING_MIGRATION.some((prefix) => under(v, prefix));

const files = sourceFiles();
const all = [
  ...files.flatMap((file) => scanSource(file, readFileSync(file, "utf8"))),
  ...scanCss("app/globals.css", readFileSync("app/globals.css", "utf8")),
];
const format = (v: Violation) => `${v.file}:${v.line}  ${v.text}`;

describe("typography scan (spec G1)", () => {
  it("walks a real tree", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain("components/dashboard/dashboard-header.tsx");
    expect(files.some((file) => file.startsWith("components/admin/"))).toBe(false);
  });

  it("recognises what it must and nothing it must not", () => {
    const hits = scanSource("x.tsx", 'a="md:text-sm text-xl/7 text-[13px] text-[.9rem] leading-7 leading-[1.2]" style={{ fontSize: 3 }}').map((v) => v.text);
    expect(hits).toEqual(["text-sm", "text-xl", "text-[13px]", "text-[.9rem]", "leading-7", "leading-[1.2]", "fontSize:"]);
    const clean = 'a="text-body text-caption text-heading-lg text-muted-foreground text-[hsl(var(--x))] context-sm leading-body"';
    expect(scanSource("x.tsx", clean)).toEqual([]);
    const css = ".a { font-size: var(--text-body); line-height: var(--leading-body); }\n.b { font-size: calc(11 * var(--d)); }\n.vp-x { font-size: 9pt; }";
    expect(scanCss("x.css", css).map((v) => v.text)).toEqual([".b { font-size: calc(11 * var(--d)) }"]);
  });

  it("finds no interface type outside the tokens", () => {
    const open = all.filter((v) => !exempts(v) && !pending(v)).map(format);
    expect(open, open.join("\n")).toEqual([]);
  });

  it("keeps every allowlist entry alive and specific", () => {
    for (const entry of TYPE_EXEMPTIONS) {
      const used = all.some((v) => exempts(v) === entry);
      const marked = readFileSync(entry.file, "utf8").includes(`data-type-exempt="${entry.id}"`);
      expect(used || marked, `stale allowlist entry ${entry.id}`).toBe(true);
      expect(entry.reason.length, `${entry.id} needs a reason`).toBeGreaterThan(20);
      expect(entry.match.trim().length, `${entry.id} needs a specific match`).toBeGreaterThan(3);
    }
    expect(new Set(TYPE_EXEMPTIONS.map((entry) => entry.id)).size).toBe(TYPE_EXEMPTIONS.length);
  });

  it("has nothing pending (spec §9: no out-of-list exclusion at merge)", () => {
    expect(PENDING_MIGRATION).toEqual([]);
  });

  it("keeps PENDING_MIGRATION honest: every prefix still has work", () => {
    for (const prefix of PENDING_MIGRATION) {
      expect(all.some((v) => !exempts(v) && under(v, prefix)), `${prefix} has no violations left — delete it`).toBe(true);
    }
  });
});
