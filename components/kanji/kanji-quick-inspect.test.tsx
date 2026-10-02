import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KanjiData } from "@/lib/dictionary/types";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { KanjiQuickInspect, resetKanjiCacheForTests } from "./kanji-quick-inspect";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}));

const BASE: KanjiData = {
  literal: "緑", onReadings: ["リョク", "ロク"], kunReadings: ["みどり"], meaningsEn: ["green"], meaningVi: null, mnemonic: null,
  strokeCount: 14, grade: 3, frequency: 1300, jlpt: "N2", strokePaths: ["M10 10L90 90", "M90 10L10 90"],
  components: { element: "緑", children: [] } as unknown as KanjiData["components"],
  commonWords: Array.from({ length: 7 }, (_, i) => ({ entSeq: 100 + i, headword: `緑${i}`, reading: "みどり", glossEn: `green ${i}` })),
  curatedKanjiId: null, attribution: [{ source: "kanjivg", version: "main", url: "https://kanjivg.tagaini.net", license: "CC BY-SA 3.0" }],
};

let fetchMock: ReturnType<typeof vi.fn>;
function serve(kanji: KanjiData) {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/speech/tts") return new Response(new Blob(["x"]), { status: 200 });
    return new Response(JSON.stringify({ data: kanji }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
}
beforeEach(() => {
  resetKanjiCacheForTests();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined }));
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe("KanjiQuickInspect", () => {
  it("shows the glyph's readings, meanings and stats, five common words, the full-page link and the attribution", async () => {
    serve(BASE);
    const onOpenWord = vi.fn();
    render(<ThemeProvider><KanjiQuickInspect literal="緑" onOpenWord={onOpenWord} /></ThemeProvider>);
    const card = await screen.findByRole("article", { name: "Kanji 緑" });
    expect(fetchMock).toHaveBeenCalledWith("/api/dictionary/kanji/%E7%B7%91");
    expect(within(card).getByText("green")).toBeInTheDocument();
    expect(within(card).getByText("リョク")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Listen to みどり" })).toBeInTheDocument();
    expect(within(card).getByText("14 strokes · Frequency #1300 · Grade 3 · JLPT N2")).toBeInTheDocument();
    expect(within(card).queryByText("Mnemonic")).toBeNull();
    const words = within(card).getAllByRole("button", { name: /^緑\d/ });
    expect(words).toHaveLength(5);
    fireEvent.click(words[1] as HTMLElement);
    expect(onOpenWord).toHaveBeenCalledWith(BASE.commonWords[1]);
    expect(within(card).getByRole("link", { name: "View full details" })).toHaveAttribute("href", "/kanji/%E7%B7%91");
    expect(within(card).getByRole("link", { name: "KanjiVG main" })).toHaveAttribute("href", "https://kanjivg.tagaini.net");
  });

  it("adds the curated Vietnamese meaning and mnemonic only when they exist", async () => {
    serve({ ...BASE, meaningVi: "màu xanh lá", mnemonic: "Silk dyed green." });
    render(<ThemeProvider><KanjiQuickInspect literal="緑" onOpenWord={vi.fn()} /></ThemeProvider>);
    expect(await screen.findByText("màu xanh lá")).toBeInTheDocument();
    expect(screen.getByText("Silk dyed green.")).toBeInTheDocument();
  });

  it("draws the stroke geometry and Replay redraws it", async () => {
    serve(BASE);
    const { container } = render(<ThemeProvider><KanjiQuickInspect literal="緑" onOpenWord={vi.fn()} /></ThemeProvider>);
    await screen.findByRole("article");
    const first = container.querySelector("svg path");
    expect(container.querySelectorAll("svg path[d='M10 10L90 90'], svg path[d='M90 10L10 90']").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Replay strokes" }));
    expect(container.querySelector("svg path")).not.toBe(first);
  });

  it("speaks a reading through the TTS API, without the okurigana dot", async () => {
    serve({ ...BASE, kunReadings: ["みど.り"] });
    render(<ThemeProvider><KanjiQuickInspect literal="緑" onOpenWord={vi.fn()} /></ThemeProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Listen to みど.り" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/speech/tts", expect.objectContaining({ method: "POST", body: JSON.stringify({ text: "みどり" }) })));
  });
});
