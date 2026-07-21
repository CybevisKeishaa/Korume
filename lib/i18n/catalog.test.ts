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

/** Flattens {a: {b: "x"}} to ["a.b"]. */
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

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
 * Recursively visits every element of a parsed ICU AST, including branches
 * nested inside `plural`/`select` options and children nested inside tags.
 * `parse()` (default options: `requiresOtherClause: true`,
 * `shouldParseSkeletons: true`) mirrors what `intl-messageformat` — the
 * engine next-intl actually renders with — requires at runtime, so a message
 * that fails here would fail to render for a real user.
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
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, message] of Object.entries(messages)) {
          expect(
            () => parse(message),
            `${locale}/${namespace}.json → ${key}: ${JSON.stringify(message)}`,
          ).not.toThrow();
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
          const referenceArgs = argNames(parse(referenceMessage));
          const localeMessage = messages[key];
          const localeArgs = localeMessage === undefined ? [] : argNames(parse(localeMessage));
          expect(localeArgs, `${locale}/${namespace}.json → ${key}`).toEqual(referenceArgs);
        }
      }
    }
  });

  it("keeps plural structure sound and branch categories valid per locale", () => {
    // CLDR plural categories genuinely differ per language: `vi` resolves
    // only "other", `en` resolves "one"/"other". Requiring identical branch
    // SETS across locales (the old regex-count check effectively did, by
    // requiring the same number of `{count}` occurrences) is linguistically
    // wrong — it is exactly why `messages/vi/dashboard.json`'s `srsDue.due`
    // used to carry a duplicated, dead `one` branch that CLDR `vi` can never
    // select, just to keep the old counter happy.
    //
    // The rule enforced here instead, per locale and per message:
    //   1. Every plural branch key is either an explicit exact-match
    //      (`=0`, `=1`, ...) — a numeral literal, not a linguistic category,
    //      so it's valid in any locale — or a category
    //      `Intl.PluralRules(locale)` actually resolves for that locale.
    //      A `one` branch in a `vi` message is unreachable dead code.
    //   2. If a message is a plural in ANY locale, it must be a plural (a
    //      real `plural` AST node, not a plain string) in ALL locales. The
    //      driving argument's *name* is already checked identical by the
    //      "ICU argument names" test above; this checks it's modeled as the
    //      same construct, so a plural silently downgraded to a plain
    //      string in one locale (which would just print `{count, ...}` raw
    //      to the user) is caught.
    const EXACT_MATCH = /^=\d+$/;

    for (const namespace of NAMESPACES) {
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        const validCategories = new Set<string>(
          new Intl.PluralRules(locale).resolvedOptions().pluralCategories,
        );
        for (const [key, message] of Object.entries(messages)) {
          for (const { branches } of plurals(parse(message))) {
            for (const branch of branches) {
              expect(
                EXACT_MATCH.test(branch) || validCategories.has(branch),
                `${locale}/${namespace}.json → ${key}: plural branch "${branch}" is not a ` +
                  `valid CLDR category for locale "${locale}" (valid: ${[...validCategories].join(", ")}) ` +
                  `and is not an exact match (=N)`,
              ).toBe(true);
            }
          }
        }
      }
    }

    for (const namespace of NAMESPACES) {
      const pluralKeysByLocale = new Map<string, Set<string>>();
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        pluralKeysByLocale.set(
          locale,
          new Set(
            Object.entries(messages)
              .filter(([, message]) => plurals(parse(message)).length > 0)
              .map(([key]) => key),
          ),
        );
      }
      const allPluralKeys = new Set(
        [...pluralKeysByLocale.values()].flatMap((keys) => [...keys]),
      );
      for (const locale of routing.locales) {
        const localeKeys = pluralKeysByLocale.get(locale) ?? new Set<string>();
        for (const key of allPluralKeys) {
          expect(
            localeKeys.has(key),
            `${locale}/${namespace}.json → ${key}: is a plural in another locale but not in "${locale}"`,
          ).toBe(true);
        }
      }
    }
  });
});
