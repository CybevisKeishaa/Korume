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
}

/** Every `plural` element in the message (there can be more than one), each
 * with its driving argument name and the sorted set of its branch keys. */
function plurals(elements: MessageFormatElement[]): PluralInfo[] {
  const found: PluralInfo[] = [];
  walk(elements, (el) => {
    if (el.type === TYPE.plural) {
      found.push({ arg: el.value, branches: Object.keys(el.options).sort() });
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

/**
 * For a message, which arguments are modeled as `plural` or `select`,
 * keyed by argument name — e.g. `[["count", "plural"], ["gender",
 * "select"]]`, sorted for stable comparison. Built from `plurals()` and
 * `selectArgs()` above rather than a fresh AST walk, since both already
 * collect exactly this.
 */
function argKinds(elements: MessageFormatElement[]): [string, "plural" | "select"][] {
  const kinds = new Map<string, "plural" | "select">();
  for (const { arg } of plurals(elements)) kinds.set(arg, "plural");
  for (const arg of selectArgs(elements)) kinds.set(arg, "select");
  return [...kinds.entries()].sort(([a], [b]) => a.localeCompare(b));
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
          expect(() => parseMessage(locale, namespace, key, message)).not.toThrow();
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
    // Net effect: `branches \ {=N} === CLDR(locale)`, exactly (not a
    // subset in either direction). Explicit exact-match branches (`=0`,
    // `=1`, ...) are exempt entirely — they're numeral literals, not
    // linguistic categories, so any locale may add them freely without
    // needing to match CLDR or match each other across locales.
    const EXACT_MATCH = /^=\d+$/;
    for (const namespace of NAMESPACES) {
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        const requiredCategories = [
          ...new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
        ].sort();
        for (const [key, message] of Object.entries(messages)) {
          for (const { branches } of plurals(parseMessage(locale, namespace, key, message))) {
            const linguisticBranches = branches.filter((b) => !EXACT_MATCH.test(b)).sort();
            expect(
              linguisticBranches,
              `${locale}/${namespace}.json → ${key}: plural branches must exactly match the ` +
                `CLDR categories locale "${locale}" resolves (${JSON.stringify(requiredCategories)})`,
            ).toEqual(requiredCategories);
          }
        }
      }
    }
  });

  it("requires the same arguments to be modeled as plural/select across all locales", () => {
    // A `plural` or `select` silently downgraded to a plain string
    // interpolation in one locale still renders *something* for every real
    // user — intl-messageformat doesn't throw, it just never selects a
    // branch, so `{count, plural, one {...} other {...}}` rendered as
    // `{count}` prints the bare count. That's invisible in `vi` today only
    // because `vi` never selects more than one branch anyway; it is wrong
    // in any locale (including future ones) with more than one category,
    // and for `select` (e.g. `{gender, select, male {...} female {...}
    // other {...}}` downgraded to `{gender}`) it's wrong immediately, since
    // the raw selector value ("male") has no branch mapped to it at all.
    // Either way the catalogs become structurally inconsistent — argument
    // *names* can match (the "ICU argument names" test above would pass)
    // while the shape translators must fill in silently diverges. Checked
    // directly here rather than relying on rendering to surface it.
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceMessages = flattenMessages(readCatalog(reference, namespace));
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, referenceMessage] of Object.entries(referenceMessages)) {
          const referenceKinds = argKinds(parseMessage(reference, namespace, key, referenceMessage));
          const localeMessage = messages[key];
          if (localeMessage === undefined) {
            throw new Error(
              `${locale}/${namespace}.json → ${key}: message is missing (see "has identical key sets" failure)`,
            );
          }
          const localeKinds = argKinds(parseMessage(locale, namespace, key, localeMessage));
          expect(localeKinds, `${locale}/${namespace}.json → ${key}`).toEqual(referenceKinds);
        }
      }
    }
  });
});
