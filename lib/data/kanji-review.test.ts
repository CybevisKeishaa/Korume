import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn() }));

import { getKanjiReviewQueue } from "./kanji-review";

const NOW = new Date("2026-11-06T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const H = 3_600_000;

/** Curated rows in stroke order, as getKanjiList returns them. 𠮟 and 日 are dictionary-only. */
const CURATED = [
  { id: "c1", character: "一", jlpt_level: "N5", stroke_count: 1, meaning_en: "one", meaning_vi: "một" },
  { id: "c2", character: "二", jlpt_level: "N5", stroke_count: 2, meaning_en: "two", meaning_vi: "hai" },
  { id: "c3", character: "山", jlpt_level: "N5", stroke_count: 3, meaning_en: "mountain", meaning_vi: null },
  { id: "c4", character: "会", jlpt_level: "N4", stroke_count: 6, meaning_en: "meet", meaning_vi: "vi-1" },
];
const PROGRESS: { literal: string; next_review_at: string | null }[] = [
  { literal: "𠮟", next_review_at: ago(1 * H) },
  { literal: "二", next_review_at: ago(2 * H) },
  { literal: "会", next_review_at: ago(0.5 * H) },
  { literal: "山", next_review_at: ago(-24 * H) }, // scheduled tomorrow: held back
];
const dict = (literal: string) => ({
  literal, vi_readings: [`HV-${literal}`], meanings_en: [`en-${literal}`, "x"], on_readings: [`on-${literal}`], kun_readings: [`kun-${literal}`],
});
const DICT = ["一", "二", "山", "会", "𠮟", "日"].map(dict);

let dictCalls: QueryCall[][] = [];
function mock({ curated = CURATED, progress = PROGRESS, dictRows = DICT } = {}) {
  dictCalls = [];
  const supabase = createMockSupabase({
    user: { id: "u1" },
    tables: {
      kanji: () => ({ data: curated, error: null }),
      user_kanji_progress: () => ({ data: progress, error: null }),
      dict_kanji: (calls) => {
        dictCalls.push(calls);
        const wanted = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in")?.values ?? [];
        return { data: dictRows.filter((row) => wanted.includes(row.literal)), error: null };
      },
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
}
const literals = async (opts: Parameters<typeof getKanjiReviewQueue>[0] = {}) =>
  (await getKanjiReviewQueue({ now: NOW, ...opts })).map((card) => card.literal);

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-1");
});

describe("getKanjiReviewQueue", () => {
  it("default deck: due rows of any literal (soonest first), then fresh curated in stroke order; future rows held back", async () => {
    mock();
    expect(await literals()).toEqual(["二", "𠮟", "会", "一"]);
    expect(dictCalls[0]).toEqual(expect.arrayContaining([{ op: "eq", column: "snapshot_id", value: "snap-1" }]));
  });

  it("level: only that level's curated kanji, due first then fresh", async () => {
    mock();
    expect(await literals({ level: "N5" })).toEqual(["二", "一"]);
    expect(await literals({ level: "N4" })).toEqual(["会"]);
  });

  it("focus comes first, once, with or without level, curated or not, due or not", async () => {
    mock();
    expect(await literals({ focus: "𠮟" })).toEqual(["𠮟", "二", "会", "一"]);
    expect(await literals({ focus: "𠮟", level: "N5" })).toEqual(["𠮟", "二", "一"]);
    expect(await literals({ focus: "山" })).toEqual(["山", "二", "𠮟", "会", "一"]);
    expect(await literals({ focus: "日", level: "N4" })).toEqual(["日", "会"]);
    expect(await literals({ focus: "日本" })).toEqual(["二", "𠮟", "会", "一"]);
  });

  it("an unscheduled progress row is due first; the limit caps the deck", async () => {
    mock({ progress: [...PROGRESS, { literal: "日", next_review_at: null }] });
    expect(await literals({ limit: 2 })).toEqual(["日", "二"]);
  });

  it("builds the card from the active snapshot's dict_kanji plus curated meaning_vi / jlpt_level; isNew = no progress row", async () => {
    mock();
    const cards = await getKanjiReviewQueue({ now: NOW, focus: "𠮟", level: "N5" });
    expect(cards[0]).toEqual({
      literal: "𠮟", hanViet: ["HV-𠮟"], meaningsEn: ["en-𠮟", "x"], meaningVi: null, on: ["on-𠮟"], kun: ["kun-𠮟"], level: null, isNew: false,
    });
    expect(cards[2]).toEqual({
      literal: "一", hanViet: ["HV-一"], meaningsEn: ["en-一", "x"], meaningVi: "một", on: ["on-一"], kun: ["kun-一"], level: "N5", isNew: true,
    });
  });

  it("a literal the snapshot lacks has no card", async () => {
    mock({ dictRows: DICT.filter((row) => row.literal !== "二") });
    expect(await literals()).toEqual(["𠮟", "会", "一"]);
  });

  it("is [] when nothing is due or fresh, and when no dictionary is active", async () => {
    mock({ curated: [], progress: [] });
    expect(await getKanjiReviewQueue({ now: NOW })).toEqual([]);
    vi.mocked(getActiveSnapshotId).mockResolvedValue(null);
    mock();
    expect(await getKanjiReviewQueue({ now: NOW })).toEqual([]);
  });

  it("looks the dictionary up in chunks, so a long deck never builds one oversized request", async () => {
    const many = Array.from({ length: 250 }, (_, i) => String.fromCodePoint(0x4e00 + i));
    mock({ curated: [], progress: many.map((literal) => ({ literal, next_review_at: null })), dictRows: many.map(dict) });
    expect(await getKanjiReviewQueue({ now: NOW, limit: 2000 })).toHaveLength(250);
    expect(dictCalls.length).toBe(3);
  });
});
