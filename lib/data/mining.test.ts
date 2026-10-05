import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createMiningCard, deleteMiningCard, getMiningQueue } from "./mining";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const LINE_ID = "10000000-0000-4000-8000-000000000001";
const CARD_ID = "20000000-0000-4000-8000-000000000001";
const MISSING_ID = "20000000-0000-4000-8000-000000000002";
const CARD = {
  id: CARD_ID, user_id: "user-1", video_id: "30000000-0000-4000-8000-000000000001", transcript_line_id: LINE_ID,
  target_word: "注文", reading: null, sentence_jp: "注文します", sentence_translation: null,
  start_time: 0, end_time: 2, created_at: "2026-10-04T00:00:00.000Z", srs_stage: 0,
  interval_days: 0, ease_factor: 2.5, next_review_at: null, last_reviewed_at: null,
  source_kind: "selection", source_ref: "注文",
};

let cardQueries: QueryCall[][];
let cardResponses: { data: unknown; error: { code?: string; message: string } | null }[];

function installSupabase(userId: string): void {
  cardQueries = [];
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user: { id: userId },
    tables: {
      transcript_lines: () => ({ data: { id: LINE_ID, transcript_id: "transcript-1", start_time: 0, end_time: 2, text_jp: "注文します", text_translation: null }, error: null }),
      transcripts: () => ({ data: { video_id: CARD.video_id }, error: null }),
      sentence_mining_cards: (calls) => {
        cardQueries.push(calls);
        return cardResponses.shift() ?? { data: null, error: null };
      },
    },
  }) as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  cardResponses = [];
});

describe("createMiningCard provenance", () => {
  it("writes selection with a server-derived ref when the client names no kind (legacy behaviour, 201 every time)", async () => {
    installSupabase("selection-user");
    cardResponses.push({ data: { ...CARD, source_kind: "selection", source_ref: "コーヒー" }, error: null });

    const result = await createMiningCard({ lineId: LINE_ID, targetWord: " ｺｰﾋｰ " });

    expect(result).toMatchObject({ ok: true, created: true });
    expect(cardQueries).toHaveLength(1);
    expect(cardQueries[0]).toContainEqual({ op: "insert", values: expect.objectContaining({ source_kind: "selection", source_ref: "コーヒー" }) });
    expect(cardQueries[0]?.filter((call) => call.op === "upsert")).toHaveLength(0);
  });

  it("re-reads a vocabulary card after the partial knowledge index rejects a duplicate", async () => {
    installSupabase("vocabulary-user");
    cardResponses.push(
      { data: { ...CARD, source_kind: "vocabulary", source_ref: "注文" }, error: null },
      { data: null, error: { code: "23505", message: "duplicate" } },
      { data: { ...CARD, source_kind: "vocabulary", source_ref: "注文" }, error: null },
    );

    const first = await createMiningCard({ lineId: LINE_ID, targetWord: "注文", sourceKind: "vocabulary" });
    const second = await createMiningCard({ lineId: LINE_ID, targetWord: "注文", sourceKind: "vocabulary" });

    expect(first).toMatchObject({ ok: true, created: true });
    expect(second).toMatchObject({ ok: true, created: false });
    expect(cardQueries).toHaveLength(3);
    expect(cardQueries[0]).toContainEqual({ op: "insert", values: expect.objectContaining({ source_kind: "vocabulary", source_ref: "注文" }) });
    expect(cardQueries[1]).toContainEqual({ op: "insert", values: expect.objectContaining({ source_kind: "vocabulary", source_ref: "注文" }) });
    expect(cardQueries[2]).toEqual(expect.arrayContaining([
      { op: "eq", column: "user_id", value: "vocabulary-user" },
      { op: "eq", column: "transcript_line_id", value: LINE_ID },
      { op: "eq", column: "source_kind", value: "vocabulary" },
      { op: "eq", column: "source_ref", value: "注文" },
      { op: "maybeSingle" },
    ]));
  });

  it("does not re-read a selection insert that fails, even when the database reports a duplicate", async () => {
    installSupabase("selection-conflict-user");
    cardResponses.push({ data: null, error: { code: "23505", message: "duplicate" } });

    await expect(createMiningCard({ lineId: LINE_ID, targetWord: "注文" })).resolves.toEqual({ ok: false, status: 400 });
    expect(cardQueries).toHaveLength(1);
  });
});

describe("deleteMiningCard", () => {
  it("deletes only by id under RLS and maps a missing row to 404", async () => {
    installSupabase("delete-user");
    cardResponses.push({ data: [{ id: CARD_ID }], error: null }, { data: [], error: null });

    await expect(deleteMiningCard(CARD_ID)).resolves.toEqual({ ok: true });
    expect(cardQueries[0]).toEqual(expect.arrayContaining([{ op: "delete" }, { op: "eq", column: "id", value: CARD_ID }]));
    await expect(deleteMiningCard(MISSING_ID)).resolves.toEqual({ ok: false, status: 404 });
  });

  it("rate-limits deletes like creates (60/min per learner) and refuses before touching the table", async () => {
    installSupabase("delete-limit-user");
    const now = new Date("2026-10-05T09:00:00Z");
    for (let i = 0; i < 60; i += 1) {
      cardResponses.push({ data: [{ id: CARD_ID }], error: null });
      await expect(deleteMiningCard(CARD_ID, now)).resolves.toEqual({ ok: true });
    }
    await expect(deleteMiningCard(CARD_ID, now)).resolves.toMatchObject({ ok: false, status: 429 });
    expect(cardQueries).toHaveLength(60);
  });
});

describe("getMiningQueue", () => {
  const NOW = new Date("2026-10-05T10:00:00.000Z");
  const card = (id: string, nextReviewAt: string | null, lastReviewedAt: string | null) =>
    ({ ...CARD, id, next_review_at: nextReviewAt, last_reviewed_at: lastReviewedAt });

  it("holds back a never-reviewed card scheduled for later (Review Tomorrow), serves fresh and due cards", async () => {
    installSupabase("queue-user");
    cardResponses.push({
      data: [
        card("tomorrow", "2026-10-05T17:00:00.000Z", null), // Review Tomorrow: due next local midnight
        card("fresh", null, null),
        card("due", "2026-10-05T09:00:00.000Z", "2026-10-01T00:00:00.000Z"),
        card("later", "2026-10-06T00:00:00.000Z", "2026-10-01T00:00:00.000Z"),
        card("tomorrow-now-due", "2026-10-05T10:00:00.000Z", null),
      ],
      error: null,
    });
    const result = await getMiningQueue(NOW);
    expect(result.ok && result.data.map((item) => item.id)).toEqual(["due", "fresh", "tomorrow-now-due"]);
  });
});
