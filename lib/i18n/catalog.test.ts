import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, TYPE, type MessageFormatElement } from "@formatjs/icu-messageformat-parser";
import { routing } from "./routing";
import { NAMESPACES } from "./namespaces";

const MESSAGES_DIR = join(process.cwd(), "messages");

function readCatalog(locale: string, namespace: string): unknown {
  return JSON.parse(
    readFileSync(join(MESSAGES_DIR, locale, `${namespace}.json`), "utf8"),
  );
}

/** Flattens {a: {b: "x"}} to ["a.b"]. Every leaf type counts as a key here
 * (string or not) — this is deliberately broader than `flattenMessages`
 * below, so comparing the two lengths catches a non-string leaf value. */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

/** Flattens {a: {b: "x"}} to {"a.b": "x"}. Only string leaves are collected
 * — a non-string leaf (number, boolean, array) is silently dropped here, so
 * every caller of this function also checks `flattenKeys` length to catch
 * that case (see the "parses as valid ICU" test). */
function flattenMessages(value: unknown, prefix = ""): Record<string, string> {
  if (typeof value === "string") return { [prefix]: value };
  if (typeof value !== "object" || value === null) return {};
  return Object.entries(value as Record<string, unknown>).reduce(
    (acc, [k, v]) => ({
      ...acc,
      ...flattenMessages(v, prefix ? `${prefix}.${k}` : k),
    }),
    {},
  );
}

/**
 * Parses one message, rethrowing with locale/namespace/key/message context
 * on failure. Every test below calls this instead of the raw `parse()` so
 * that ANY test — not just the dedicated "parses as valid ICU" one — fails
 * with a message that pinpoints the exact catalog entry, even if it's
 * filtered to run in isolation (`vitest run -t "..."`) and never reaches the
 * dedicated parse test at all.
 *
 * `parse()`'s defaults (`requiresOtherClause: true`, `shouldParseSkeletons:
 * true`) mirror what `intl-messageformat` — the engine `next-intl`/
 * `use-intl` actually render with — requires at runtime (confirmed against
 * `node_modules/intl-messageformat/intl-messageformat.iife.js`), so a
 * message that fails here would fail to render for a real user, not just
 * fail an artificial lint.
 */
function parseMessage(
  locale: string,
  namespace: string,
  key: string,
  message: string,
): MessageFormatElement[] {
  try {
    return parse(message);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      `${locale}/${namespace}.json → ${key}: ${JSON.stringify(message)} failed to parse as ICU MessageFormat (${reason})`,
    );
  }
}

/**
 * Recursively visits every element of a parsed ICU AST, including branches
 * nested inside `plural`/`select` options and children nested inside tags.
 */
function walk(
  elements: MessageFormatElement[],
  visit: (el: MessageFormatElement) => void,
): void {
  for (const el of elements) {
    visit(el);
    if (el.type === TYPE.select || el.type === TYPE.plural) {
      for (const option of Object.values(el.options)) {
        walk(option.value, visit);
      }
    } else if (el.type === TYPE.tag) {
      walk(el.children, visit);
    }
  }
}

/**
 * True if the message contains an ICU `#` (pound, `TYPE.pound`) anywhere,
 * including nested inside a plural/select branch or a tag. `#` inside a
 * `{count, plural, ...}` branch silently runs the branch's count through
 * `Intl.NumberFormat` (1234 -> "1,234"), which diverges from a plain
 * `{count}` interpolation the moment a count reaches four digits and breaks
 * byte-identity with a pre-extraction plain-number source string. The
 * plan's binding convention (corrected 2026-07-21 after this exact
 * regression shipped once in Task 6's `dashboard.json`) requires a named
 * argument like `{count}` inside every plural branch instead — checked
 * directly here so a `#` cannot silently reappear in any of the eleven
 * catalogs still to come.
 */
function usesPound(elements: MessageFormatElement[]): boolean {
  let found = false;
  walk(elements, (el) => {
    if (el.type === TYPE.pound) found = true;
  });
  return found;
}

/**
 * Argument names referenced anywhere in the message: plain `{name}` args,
 * and the driving argument of `number`/`date`/`time`/`select`/`plural`
 * formats. `#` (pound, `TYPE.pound`) carries no name of its own — it refers
 * to the enclosing plural's argument — so it's intentionally not collected.
 */
function argNames(elements: MessageFormatElement[]): string[] {
  const names = new Set<string>();
  walk(elements, (el) => {
    switch (el.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
      case TYPE.select:
      case TYPE.plural:
        names.add(el.value);
        break;
      default:
        break;
    }
  });
  return [...names].sort();
}

interface PluralInfo {
  arg: string;
  branches: string[];
  /** `@formatjs` parses `selectordinal` as `TYPE.plural` with
   * `pluralType: "ordinal"` — there is no separate ordinal AST node. Cardinal
   * and ordinal CLDR category sets genuinely differ per locale (e.g. `en`
   * ordinal is `["one","two","few","other"]`, not `en` cardinal's
   * `["one","other"]`), so callers MUST resolve `Intl.PluralRules` with this
   * `type`, not assume the default `"cardinal"`. */
  pluralType: Intl.PluralRulesOptions["type"];
  /** `offset:N` shifts every branch's implicit count before CLDR category
   * selection (`{count, plural, offset:1 one {...} other {...}}` selects
   * `"one"` at `count = 2`, not `count = 1`). Two locales with the same
   * branches but different offsets render different text at the same count
   * — a silent per-locale off-by-one — so callers compare this too. */
  offset: number;
}

/** Every `plural`/`selectordinal` element in the message (there can be more
 * than one), each with its driving argument name, sorted branch-key set,
 * resolved plural type, and offset. */
function plurals(elements: MessageFormatElement[]): PluralInfo[] {
  const found: PluralInfo[] = [];
  walk(elements, (el) => {
    if (el.type === TYPE.plural) {
      found.push({
        arg: el.value,
        branches: Object.keys(el.options).sort(),
        pluralType: el.pluralType,
        offset: el.offset,
      });
    }
  });
  return found;
}

/** Every `select` element's driving argument name (there can be more than
 * one per message). */
function selectArgs(elements: MessageFormatElement[]): string[] {
  const found: string[] = [];
  walk(elements, (el) => {
    if (el.type === TYPE.select) found.push(el.value);
  });
  return found;
}

interface ArgShape {
  kind: "plural" | "selectordinal" | "select";
  /** Only meaningful for `kind: "plural" | "selectordinal"`; omitted for
   * `"select"`, which has no offset concept. `toEqual` (used everywhere this
   * is compared) treats a missing property and an `undefined` property as
   * equal, so this doesn't need to be forced to a sentinel. */
  offset?: number;
}

/**
 * For a message, which arguments are modeled as `plural`, `selectordinal`,
 * or `select`, keyed by argument name — e.g. `[["count", { kind: "plural",
 * offset: 0 }], ["gender", { kind: "select" }]]`, sorted for stable
 * comparison. Built from `plurals()` and `selectArgs()` above rather than a
 * fresh AST walk, since both already collect exactly this.
 *
 * This keys by argument NAME only — nesting position and multiplicity (e.g.
 * a `count` plural nested inside a `gender` select vs. the same two
 * arguments placed side by side) are deliberately not compared. Translators
 * legitimately restructure nesting to fit target-language word order, and
 * both structures render correctly, so treating that as a mismatch would be
 * a false positive, not a caught bug.
 */
function argShapes(elements: MessageFormatElement[]): [string, ArgShape][] {
  const shapes = new Map<string, ArgShape>();
  for (const { arg, pluralType, offset } of plurals(elements)) {
    shapes.set(arg, { kind: pluralType === "ordinal" ? "selectordinal" : "plural", offset });
  }
  for (const arg of selectArgs(elements)) shapes.set(arg, { kind: "select" });
  return [...shapes.entries()].sort(([a], [b]) => a.localeCompare(b));
}

describe("catalog", () => {
  it("declares every namespace that exists on disk, for every locale", () => {
    for (const locale of routing.locales) {
      const onDisk = readdirSync(join(MESSAGES_DIR, locale))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, ""))
        .sort();
      expect(onDisk).toEqual([...NAMESPACES].sort());
    }
  });

  it("has identical key sets across all locales", () => {
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceKeys = flattenKeys(readCatalog(reference, namespace)).sort();
      for (const locale of routing.locales) {
        const keys = flattenKeys(readCatalog(locale, namespace)).sort();
        expect(keys, `${locale}/${namespace}.json`).toEqual(referenceKeys);
      }
    }
  });

  it("parses as valid ICU MessageFormat in every locale", () => {
    // Every locale's messages must actually ICU-parse. Before this test,
    // only `en` was ever rendered by the unit suite (`test/render.tsx`
    // pins the locale), so a malformed `vi` message — an unbalanced brace,
    // a misspelt `plural`/`select` keyword — shipped undetected and broke
    // only for Vietnamese users, this product's primary audience.
    for (const locale of routing.locales) {
      for (const namespace of NAMESPACES) {
        const raw = readCatalog(locale, namespace);
        const messages = flattenMessages(raw);
        // Every leaf `flattenKeys` finds must have survived into `messages`
        // as a string — if the lengths differ, some catalog value isn't a
        // string (number, boolean, array, ...) and `flattenMessages` silently
        // dropped it, which would otherwise let it skip every check below.
        expect(
          flattenKeys(raw).length,
          `${locale}/${namespace}.json: contains a non-string leaf value`,
        ).toBe(Object.keys(messages).length);
        for (const [key, message] of Object.entries(messages)) {
          // Call directly rather than wrapping in `expect(fn).not.toThrow()`:
          // vitest truncates a thrown Error's message when reporting a
          // not.toThrow() failure ("...but 'Error: vi/dashboard.json →
          // srsDue.tit…' was thrown"), while an uncaught throw here fails
          // the test with parseMessage()'s full locus-precise message intact.
          parseMessage(locale, namespace, key, message);
        }
      }
    }
  });

  it("has identical ICU argument names for every message across all locales", () => {
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceMessages = flattenMessages(readCatalog(reference, namespace));
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, referenceMessage] of Object.entries(referenceMessages)) {
          const referenceArgs = argNames(parseMessage(reference, namespace, key, referenceMessage));
          const localeMessage = messages[key];
          if (localeMessage === undefined) {
            // The "identical key sets" test above already fails the suite
            // for this — surface a message that says so rather than
            // silently treating a missing message as "zero arguments" and
            // producing a confusing diff here too.
            throw new Error(
              `${locale}/${namespace}.json → ${key}: message is missing (see "has identical key sets" failure)`,
            );
          }
          const localeArgs = argNames(parseMessage(locale, namespace, key, localeMessage));
          expect(localeArgs, `${locale}/${namespace}.json → ${key}`).toEqual(referenceArgs);
        }
      }
    }
  });

  it("requires every plural's branch set to exactly match its locale's CLDR categories", () => {
    // CLDR plural categories genuinely differ per language: `vi` resolves
    // only "other", `en` resolves "one"/"other". A locale's plural must
    // handle every category `Intl.PluralRules` can actually select for it —
    // skipping one (e.g. an `en` plural with only an `other` branch) means
    // real `en` users whose count selects "one" see the unformatted
    // "other" text ("1 items"). The OLD regex-count check caught this only
    // by accident (by requiring equal branch COUNTS across locales); this
    // asserts it directly, per locale, against the real CLDR data.
    //
    // A locale's plural must also carry no *extra* linguistic category CLDR
    // never selects for it — that's unreachable dead code, which is exactly
    // why `messages/vi/dashboard.json`'s `srsDue.due` used to carry a
    // duplicated `one` branch: CLDR `vi` never selects `one`.
    //
    // Net effect: `branches \ {=N} === CLDR(locale, type)`, exactly (not a
    // subset in either direction). Explicit exact-match branches (`=0`,
    // `=1`, ...) are exempt entirely — they're numeral literals, not
    // linguistic categories, so any locale may add them freely without
    // needing to match CLDR or match each other across locales.
    //
    // `type` matters: `@formatjs` parses `selectordinal` as `TYPE.plural`
    // with `pluralType: "ordinal"`, and ordinal CLDR categories genuinely
    // differ from cardinal ones per locale (`en` ordinal is
    // `["one","two","few","other"]`; `en` cardinal is `["one","other"]`).
    // Resolving `Intl.PluralRules` with the plural's own `pluralType` — not
    // assuming the default `"cardinal"` — is what lets a correct `en`
    // `selectordinal` ("1st", "2nd", "3rd", "4th day") coexist with `vi`'s
    // cardinal-shaped `srsDue.due` in the same catalog.
    const EXACT_MATCH = /^=\d+$/;
    for (const namespace of NAMESPACES) {
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, message] of Object.entries(messages)) {
          for (const { branches, pluralType } of plurals(parseMessage(locale, namespace, key, message))) {
            const requiredCategories = [
              ...new Intl.PluralRules(locale, { type: pluralType }).resolvedOptions().pluralCategories,
            ].sort();
            const linguisticBranches = branches.filter((b) => !EXACT_MATCH.test(b)).sort();
            expect(
              linguisticBranches,
              `${locale}/${namespace}.json → ${key}: ${pluralType} plural branches must exactly ` +
                `match the CLDR ${pluralType} categories locale "${locale}" resolves ` +
                `(${JSON.stringify(requiredCategories)})`,
            ).toEqual(requiredCategories);
          }
        }
      }
    }
  });

  it("forbids ICU `#` anywhere in a message — plural branches must use a named argument like {count} instead", () => {
    // `#` is convenient shorthand but runs the enclosing plural's count
    // through `Intl.NumberFormat` unconditionally (1234 -> "1,234" in en),
    // which a plain `{count}` interpolation does not do. That silently
    // breaks byte-identity with a pre-extraction source string the moment a
    // real count reaches four digits, and it shipped once already
    // undetected (Task 6, `dashboard.json`'s `srsDue.due`). Every catalog
    // message in every namespace/locale is checked directly here, with a
    // locus-precise failure message, rather than relying on a human
    // reviewer to notice a bare `#` in a diff.
    for (const namespace of NAMESPACES) {
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, message] of Object.entries(messages)) {
          const elements = parseMessage(locale, namespace, key, message);
          expect(
            usesPound(elements),
            `${locale}/${namespace}.json → ${key}: ${JSON.stringify(message)} uses ICU "#" — ` +
              `"#" runs through Intl.NumberFormat (1234 -> "1,234"); use a named argument like ` +
              `{count} inside the plural branch instead`,
          ).toBe(false);
        }
      }
    }
  });

  it("requires the same arguments to be modeled as plural/selectordinal/select across all locales", () => {
    // A `plural`/`selectordinal`/`select` silently downgraded to a plain
    // string interpolation in one locale still renders *something* for
    // every real user — intl-messageformat doesn't throw, it just never
    // selects a branch, so `{count, plural, one {...} other {...}}`
    // rendered as `{count}` prints the bare count. That's invisible in `vi`
    // today only because `vi` never selects more than one branch anyway; it
    // is wrong in any locale (including future ones) with more than one
    // category, and for `select` (e.g. `{gender, select, male {...} female
    // {...} other {...}}` downgraded to `{gender}`) it's wrong immediately,
    // since the raw selector value ("male") has no branch mapped to it at
    // all. Either way the catalogs become structurally inconsistent —
    // argument *names* can match (the "ICU argument names" test above would
    // pass) while the shape translators must fill in silently diverges.
    // Checked directly here rather than relying on rendering to surface it.
    //
    // A cardinal-in-one-locale / ordinal-in-the-other swap (both parse as
    // `TYPE.plural`) and an `offset:` divergence (same branches, different
    // count shift) are equally invisible to a bare kind check, so `argShapes`
    // compares plural type and offset too, not just "is this a plural".
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceMessages = flattenMessages(readCatalog(reference, namespace));
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, referenceMessage] of Object.entries(referenceMessages)) {
          const referenceShapes = argShapes(parseMessage(reference, namespace, key, referenceMessage));
          const localeMessage = messages[key];
          if (localeMessage === undefined) {
            throw new Error(
              `${locale}/${namespace}.json → ${key}: message is missing (see "has identical key sets" failure)`,
            );
          }
          const localeShapes = argShapes(parseMessage(locale, namespace, key, localeMessage));
          expect(localeShapes, `${locale}/${namespace}.json → ${key}`).toEqual(referenceShapes);
        }
      }
    }
  });
});
