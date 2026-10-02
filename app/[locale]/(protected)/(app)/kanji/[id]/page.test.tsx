import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import kanjiCopy from "@/messages/en/kanji.json";
import type { KanjiData } from "@/lib/dictionary/types";

const mocks = vi.hoisted(() => ({
  getKanjiData: vi.fn(),
  getKanjiById: vi.fn(),
  redirect: vi.fn((): never => {
    throw new Error("NEXT_REDIRECT");
  }),
  notFound: vi.fn((): never => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/lib/dictionary/kanji-data-service", () => ({ getKanjiData: mocks.getKanjiData }));
vi.mock("@/lib/data/content", () => ({ getKanjiById: mocks.getKanjiById }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, ...props }: React.ComponentProps<"a">) => <a href={href} {...props} />,
  redirect: mocks.redirect,
}));
vi.mock("@/components/motion/stroke-order", () => ({
  StrokeOrder: ({ character, paths }: { character: string; paths?: string[] }) => (
    <div data-testid="stroke-order" data-character={character} data-paths={paths?.length ?? 0} />
  ),
}));
vi.mock("@/lib/i18n/server", () => ({
  getTranslations: vi.fn().mockImplementation(async () => (key: string, values?: Record<string, number | string>) => {
    const value = key
      .split(".")
      .reduce<unknown>((current, part) => (current && typeof current === "object" ? (current as Record<string, unknown>)[part] : undefined), kanjiCopy);
    if (typeof value !== "string") return key;
    if (key === "strokeCount") return `${values?.count} strokes`;
    return values ? Object.entries(values).reduce((copy, [name, v]) => copy.replace(`{${name}}`, String(v)), value) : value;
  }),
  getLocale: vi.fn().mockResolvedValue("en"),
}));

import KanjiDetailPage from "./page";

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
  strokePaths: Array.from({ length: 14 }, (_, i) => `M${i},0L1,1`),
  components: { element: "緑", position: null, children: [] },
  commonWords: [{ entSeq: 1, headword: "緑", reading: "みどり", glossEn: "green; greenery" }],
  curatedKanjiId: null,
  attribution: [
    { source: "jmdict", version: "2026-10-02", url: "http://j.example", license: "CC BY-SA 4.0" },
    { source: "kanjivg", version: "20260714", url: "http://v.example", license: "CC BY-SA 3.0" },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("KanjiDetailPage", () => {
  it("renders a dictionary-only kanji from its literal", async () => {
    mocks.getKanjiData.mockResolvedValue(GREEN);
    render(await KanjiDetailPage({ params: { id: "緑" } }));
    expect(mocks.getKanjiData).toHaveBeenCalledWith("緑", { commonWords: 10 });
    expect(screen.getByRole("heading", { level: 1, name: "緑" })).toBeInTheDocument();
    expect(screen.getByText("green")).toBeInTheDocument();
    expect(screen.getByText("リョク、ロク")).toBeInTheDocument();
    expect(screen.getByTestId("stroke-order")).toHaveAttribute("data-paths", "14");
    expect(screen.getByText("green; greenery")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /JMdict 2026-10-02/ })).toHaveAttribute("href", "http://j.example");
  });

  it("decodes a percent-encoded literal", async () => {
    mocks.getKanjiData.mockResolvedValue(GREEN);
    render(await KanjiDetailPage({ params: { id: "%E7%B7%91" } }));
    expect(mocks.getKanjiData).toHaveBeenCalledWith("緑", { commonWords: 10 });
  });

  it("redirects a legacy curated UUID to the literal URL", async () => {
    mocks.getKanjiById.mockResolvedValue({ id: "a0000000-0000-4000-8000-000000000001", character: "緑" });
    await expect(KanjiDetailPage({ params: { id: "a0000000-0000-4000-8000-000000000001" } })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith({ href: `/kanji/${encodeURIComponent("緑")}`, locale: "en" });
    expect(mocks.getKanjiData).not.toHaveBeenCalled();
  });

  it.each([["an unknown UUID", "a0000000-0000-4000-8000-000000000002"], ["two characters", "緑色"], ["a non-kanji", "a"]])(
    "is not found for %s",
    async (_label, id) => {
      mocks.getKanjiById.mockResolvedValue(null);
      await expect(KanjiDetailPage({ params: { id } })).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.getKanjiData).not.toHaveBeenCalled();
    },
  );

  it("is not found for a kanji the dictionary does not know", async () => {
    mocks.getKanjiData.mockResolvedValue(null);
    await expect(KanjiDetailPage({ params: { id: "緑" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
