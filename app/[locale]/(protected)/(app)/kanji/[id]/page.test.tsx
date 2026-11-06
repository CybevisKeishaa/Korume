import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import type { KanjiData } from "@/lib/dictionary/types";

const mocks = vi.hoisted(() => ({
  getKanjiInspectPayload: vi.fn(),
  getKanjiById: vi.fn(),
  getKanjiList: vi.fn(),
  listKanjiFavorites: vi.fn(),
  explore: vi.fn(),
  redirect: vi.fn((): never => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/dictionary/kanji-data-service", () => ({ getKanjiInspectPayload: mocks.getKanjiInspectPayload }));
vi.mock("@/lib/data/content", () => ({ getKanjiById: mocks.getKanjiById, getKanjiList: mocks.getKanjiList }));
vi.mock("@/lib/data/kanji-learner", () => ({ listKanjiFavorites: mocks.listKanjiFavorites }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
  redirect: mocks.redirect,
}));
// The content is KanjiInspect's own test; here only what the page hands it.
vi.mock("@/components/kanji/kanji-inspect", () => ({
  KanjiInspect: ({ payload, variant, explore }: { payload: { data: { literal: string } }; variant: string; explore: unknown }) => {
    mocks.explore(explore);
    return <h1 data-variant={variant}>{payload.data.literal}</h1>;
  },
}));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn().mockResolvedValue("en") }));

import KanjiDetailPage from "./page";
const presence = vi.hoisted(() => vi.fn());
vi.mock("@/components/study-time/study-presence", () => ({ StudyPresence: presence }));

const GREEN: KanjiData = {
  literal: "緑",
  onReadings: ["リョク", "ロク"],
  kunReadings: ["みどり"],
  meaningsEn: ["green"],
  meaningVi: null,
  mnemonic: null,
  strokeCount: 14,
  grade: 3,
  frequency: 1082,
  jlpt: null,
  hanViet: [], tcLines: [], oldJlpt: null, componentGlosses: {},
  strokePaths: Array.from({ length: 14 }, (_, i) => `M${i},0L1,1`),
  components: { element: "緑", position: null, children: [] },
  commonWords: [{ entSeq: 1, headword: "緑", reading: "みどり", glossEn: "green; greenery" }],
  curatedKanjiId: null,
  attribution: [
    { source: "jmdict", version: "2026-10-02", url: "http://j.example", license: "CC BY-SA 4.0" },
    { source: "kanjivg", version: "20260714", url: "http://v.example", license: "CC BY-SA 3.0" },
  ],
};

const inspect = (data: KanjiData) => ({ data, learner: { favorite: false, progress: null }, examples: [], lessons: [], neighbors: null });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listKanjiFavorites.mockResolvedValue([{ literal: "日", hanViet: ["Nhật"] }]);
  mocks.getKanjiList.mockResolvedValue([{ character: "一" }, { character: "緑" }]);
});

describe("KanjiDetailPage", () => {
  it("tracks a curated kanji with its row id", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(inspect({ ...GREEN, curatedKanjiId: "a0000000-0000-4000-8000-000000000001" }));
    render(await KanjiDetailPage({ params: { id: "緑" } }));
    expect(presence).toHaveBeenCalledWith(expect.objectContaining({ surface: "kanji", contextId: "a0000000-0000-4000-8000-000000000001", enabled: true }), expect.anything());
  });
  it("renders a dictionary-only kanji from its literal", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(inspect(GREEN));
    render(await KanjiDetailPage({ params: { id: "緑" } }));
    expect(presence).toHaveBeenCalledWith(expect.objectContaining({ surface: "kanji", contextId: null, enabled: false }), expect.anything());
    expect(mocks.getKanjiInspectPayload).toHaveBeenCalledWith("緑");
    expect(screen.getByRole("heading", { level: 1, name: "緑" })).toHaveAttribute("data-variant", "page");
  });

  it("hands the page its ways on (K14): a curated kanji's level list and the saved kanji, plain data", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(inspect({ ...GREEN, jlpt: "N3" }));
    render(await KanjiDetailPage({ params: { id: "緑" } }));
    expect(mocks.getKanjiList).toHaveBeenCalledWith("N3");
    const explore = { level: { level: "N3", literals: ["一", "緑"] }, favorites: [{ literal: "日", hanViet: ["Nhật"] }] };
    expect(mocks.explore).toHaveBeenCalledWith(explore);
    expect(structuredClone(explore)).toEqual(explore);
  });

  it("a failed ways-on fetch drops that row, never the page", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(inspect({ ...GREEN, jlpt: "N3" }));
    mocks.getKanjiList.mockRejectedValue(new Error("db down"));
    mocks.listKanjiFavorites.mockRejectedValue(new Error("db down"));
    render(await KanjiDetailPage({ params: { id: "緑" } }));
    expect(mocks.explore).toHaveBeenCalledWith({ level: null, favorites: [] });
  });

  it("a dictionary-only kanji gets no level list", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(inspect(GREEN));
    render(await KanjiDetailPage({ params: { id: "緑" } }));
    expect(mocks.getKanjiList).not.toHaveBeenCalled();
    expect(mocks.explore).toHaveBeenCalledWith({ level: null, favorites: [{ literal: "日", hanViet: ["Nhật"] }] });
  });

  it("decodes a percent-encoded literal", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(inspect(GREEN));
    render(await KanjiDetailPage({ params: { id: "%E7%B7%91" } }));
    expect(mocks.getKanjiInspectPayload).toHaveBeenCalledWith("緑");
  });

  it("redirects a legacy curated UUID to the literal URL", async () => {
    mocks.getKanjiById.mockResolvedValue({ id: "a0000000-0000-4000-8000-000000000001", character: "緑" });
    await expect(KanjiDetailPage({ params: { id: "a0000000-0000-4000-8000-000000000001" } })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({ href: `/kanji/${encodeURIComponent("緑")}`, locale: "en" });
    expect(mocks.getKanjiInspectPayload).not.toHaveBeenCalled();
  });

  it.each([["an unknown UUID", "a0000000-0000-4000-8000-000000000002"], ["two characters", "緑色"], ["a non-kanji", "a"]])(
    "is not found for %s",
    async (_label, id) => {
      mocks.getKanjiById.mockResolvedValue(null);
      await expect(KanjiDetailPage({ params: { id } })).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.getKanjiInspectPayload).not.toHaveBeenCalled();
    },
  );

  it("is not found for a kanji the dictionary does not know", async () => {
    mocks.getKanjiInspectPayload.mockResolvedValue(null);
    await expect(KanjiDetailPage({ params: { id: "緑" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
