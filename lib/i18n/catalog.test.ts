import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
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

/** Extracts ICU argument names: "Hi {name}, {count, plural, ...}" -> ["name","count"]. */
function icuArgs(value: unknown): string[] {
  if (typeof value !== "string") return [];
  // The regex's single capture group always matches when the overall pattern
  // matches, but under this repo's `noUncheckedIndexedAccess` tsconfig option
  // `m[1]` types as `string | undefined`. Filter rather than assert non-null
  // (repo convention forbids `!`, see CLAUDE.md §6 / eslint no-non-null-assertion).
  return [...value.matchAll(/\{\s*(\w+)/g)]
    .map((m) => m[1])
    .filter((arg): arg is string => arg !== undefined)
    .sort();
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

  it("has identical ICU arguments for every message across all locales", () => {
    const reference = routing.defaultLocale;
    for (const namespace of NAMESPACES) {
      const referenceMessages = flattenMessages(readCatalog(reference, namespace));
      for (const locale of routing.locales) {
        const messages = flattenMessages(readCatalog(locale, namespace));
        for (const [key, message] of Object.entries(referenceMessages)) {
          expect(icuArgs(messages[key]), `${locale}/${namespace}.json → ${key}`).toEqual(
            icuArgs(message),
          );
        }
      }
    }
  });
});
