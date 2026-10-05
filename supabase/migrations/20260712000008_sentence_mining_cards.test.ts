import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260712000008_sentence_mining_cards.sql"), "utf8")
  .replace(/--[^\n]*/g, "").replace(/\s+/g, " ").toLowerCase();

describe("sentence_mining_cards provenance (summary spec §6.1)", () => {
  it("declares source_kind with selection as the default and four kinds", () => {
    expect(sql).toContain("source_kind text not null default 'selection' check (source_kind in ('selection', 'vocabulary', 'expression', 'sentence'))");
  });

  it("ties source_ref to the kind: a sentence card has none, every other card has one", () => {
    expect(sql).toContain("source_ref text");
    expect(sql).toContain("check ((source_kind = 'sentence') = (source_ref is null))");
  });

  it("makes Review Tomorrow and Summary saves idempotent, and leaves selection free", () => {
    expect(sql).toContain("create unique index sentence_mining_cards_one_sentence on sentence_mining_cards (user_id, transcript_line_id) where source_kind = 'sentence'");
    expect(sql).toContain("create unique index sentence_mining_cards_one_knowledge on sentence_mining_cards (user_id, transcript_line_id, source_kind, source_ref) where source_kind in ('vocabulary', 'expression')");
    expect(sql).not.toMatch(/unique[^;]*'selection'/);
  });
});
