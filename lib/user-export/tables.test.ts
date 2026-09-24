import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HISTORY_SOURCES, PRIMARY_KEY_COLUMNS } from "@/lib/data/user-export";
import { USER_EXPORT_EXCLUSIONS, USER_EXPORT_TABLES } from "./tables";

/**
 * The export is a GDPR obligation, and account deletion relies on the `users`
 * cascade — so nothing in the schema carries a list of the tables a reader
 * owns. This file derives that list from the migrations instead, and fails
 * when a new table appears that is neither exported nor excluded with a
 * reason.
 *
 * Measured 2026-09-23: **27** tables declare a column referencing `users`, and
 * **3** more hang off an exported one. Those numbers are asserted, not just
 * described: a scan that silently collected nothing would otherwise satisfy
 * every "is it listed" check below while proving nothing (`L-004`).
 */
const MIGRATIONS = path.join(process.cwd(), "supabase/migrations");

function tableBodies(): Map<string, string> {
  const bodies = new Map<string, string>();
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql"))) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8").replace(/--[^\n]*/g, "");
    const pattern = /create table (?:if not exists )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/gi;
    for (const match of sql.matchAll(pattern)) bodies.set(match[1] as string, match[2] as string);
  }
  return bodies;
}

function declaredPrimaryKeyColumns(body: string): readonly string[] | undefined {
  const tableKey = body.match(/\bprimary\s+key\s*\(([^)]+)\)/i);
  if (tableKey) return tableKey[1]?.split(",").map((column) => column.trim());

  const inlineKey = body.match(/^\s*(\w+)\s+[^,\n]*?\bprimary\s+key\b/im);
  return inlineKey?.[1] ? [inlineKey[1]] : undefined;
}

const BODIES = tableBodies();

/** Tables with a column that references `users` directly. */
function directlyOwned(): Set<string> {
  const owned = new Set<string>();
  for (const [table, body] of BODIES) {
    if (/references\s+(?:public\.|auth\.)?users\s*\(/i.test(body)) owned.add(table);
  }
  return owned;
}

/**
 * Tables one hop from a directly-owned table that is NOT excluded.
 *
 * Deliberately computed from the DIRECT set minus the exclusions, never from
 * `USER_EXPORT_TABLES`: a collection driven by the list it guards shrinks
 * along with it, and could not detect a table being dropped (`L-006`).
 */
function ownedViaParent(direct: Set<string>): Map<string, string> {
  const parents = new Set([...direct].filter((t) => !(t in USER_EXPORT_EXCLUSIONS)));
  const children = new Map<string, string>();
  for (const [table, body] of BODIES) {
    if (direct.has(table)) continue;
    const pattern = /(\w+)[^,]*?references\s+(?:public\.)?(\w+)\s*\(/gi;
    for (const match of body.matchAll(pattern)) {
      if (parents.has(match[2] as string)) children.set(table, match[2] as string);
    }
  }
  return children;
}

describe("USER_EXPORT_TABLES covers everything a reader owns", () => {
  const direct = directlyOwned();
  const viaParent = ownedViaParent(direct);
  const collected = new Set([...direct, ...viaParent.keys()]);
  const listed = new Set(USER_EXPORT_TABLES.map((entry) => entry.table));

  it("reaches the whole schema, not an empty or truncated slice", () => {
    expect(BODIES.size).toBeGreaterThan(40);
    expect(direct.size).toBe(27);
    expect(viaParent.size).toBe(3);
    // A positive control: a table everyone can read must NOT be collected, or
    // the regex is matching something other than ownership.
    expect(collected.has("kanji")).toBe(false);
    expect(collected.has("users")).toBe(true);
  });

  it("accounts for every collected table, as an export or as a reasoned exclusion", () => {
    const unaccounted = [...collected].filter(
      (table) => !listed.has(table) && !(table in USER_EXPORT_EXCLUSIONS),
    );
    expect(unaccounted).toEqual([]);
  });

  it("lists nothing the schema does not have", () => {
    expect([...listed].filter((table) => !collected.has(table))).toEqual([]);
    expect(Object.keys(USER_EXPORT_EXCLUSIONS).filter((t) => !collected.has(t))).toEqual([]);
  });

  it("gives every exclusion a reason and never both exports and excludes a table", () => {
    for (const [table, reason] of Object.entries(USER_EXPORT_EXCLUSIONS)) {
      expect(reason.length, `${table} needs a reason`).toBeGreaterThan(20);
      expect(listed.has(table), `${table} is both exported and excluded`).toBe(false);
    }
  });

  it("scopes every entry exactly one way", () => {
    for (const entry of USER_EXPORT_TABLES) {
      const ways = [entry.userColumn, entry.via].filter(Boolean).length;
      expect(ways, `${entry.table} must have exactly one of userColumn / via`).toBe(1);
      if (entry.via) {
        expect(listed.has(entry.via.parent), `${entry.table}'s parent must be exported too`).toBe(true);
      }
    }
  });

  it("exports the preferences this branch added", () => {
    expect(listed.has("user_preferences")).toBe(true);
  });
});

describe("export pagination uses the primary-key order declared by the schema", () => {
  it("covers each exported table with its declared primary-key columns in order", () => {
    const tables = new Set([...USER_EXPORT_TABLES, ...HISTORY_SOURCES].map((entry) => entry.table));
    const declaredKeys = new Map(
      [...tables].flatMap((table) => {
        const columns = declaredPrimaryKeyColumns(BODIES.get(table) ?? "");
        return columns ? [[table, columns] as const] : [];
      }),
    );

    expect(tables.size).toBe(29);
    expect(declaredKeys.size).toBe(29);
    for (const table of tables) {
      expect(Object.hasOwn(PRIMARY_KEY_COLUMNS, table), `${table} needs a paging key`).toBe(true);
      expect(PRIMARY_KEY_COLUMNS[table], `${table}'s paging key must match the schema`).toEqual(
        declaredKeys.get(table),
      );
    }
  });
});
