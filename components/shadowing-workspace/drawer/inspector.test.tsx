import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { KanjiData } from "@/lib/dictionary/types";
import type { LexicalLineAnalysisDto } from "@/lib/analysis/types";
import { tokenSpans } from "@/lib/analysis/spans";
import { resetTabWritesForTests } from "../workspace-context";
import { ShadowingWorkspaceShell } from "../workspace-shell";
import { TranscriptPanel } from "../transcript-panel";
import { resetLineAnalysisCacheForTests } from "../use-line-analysis";
import { resetGlossRequestsForTests } from "./word-card";
import { resetKanjiCacheForTests } from "@/components/kanji/kanji-quick-inspect";
import { ThemeProvider } from "@/components/providers/theme-provider";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/vi/shadowing/video-1", useSearchParams: () => new URLSearchParams() }));

const TEXT = "緑の雨です";
const LINES = [
  { id: "line-1", index: 0, startTime: 0, endTime: 2, textJp: TEXT, textTranslation: null, furigana: null },
  { id: "line-2", index: 1, startTime: 2, endTime: 4, textJp: "雨が好き", textTranslation: null, furigana: null },
];
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 4, jlptLevel: "N5" },
  transcript: { id: "transcript-1", lines: LINES },
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
};
const spans = tokenSpans(TEXT, ["緑", "の", "雨", "です"]);
const ANALYSIS: LexicalLineAnalysisDto = {
  lineId: "line-1", snapshotId: "s", mastery: {},
  tokens: [
    { index: 0, surface: "緑", base: "緑", reading: "ミドリ", pos: "名詞", span: spans[0] ?? { start: 0, end: 0 }, entries: [{ entSeq: 10, headword: "緑", reading: "みどり", glossEn: "green", jlpt: null }], vocabId: null },
    { index: 1, surface: "の", base: "の", reading: "ノ", pos: "助詞", span: spans[1] ?? { start: 0, end: 0 }, entries: [], vocabId: null },
    { index: 2, surface: "雨", base: "雨", reading: "アメ", pos: "名詞", span: spans[2] ?? { start: 0, end: 0 }, entries: [{ entSeq: 20, headword: "雨", reading: "あめ", glossEn: "rain", jlpt: 5 }], vocabId: null },
    { index: 3, surface: "です", base: "です", reading: "デス", pos: "助動詞", span: spans[3] ?? { start: 0, end: 0 }, entries: [], vocabId: null },
  ],
};
const KANJI: KanjiData = {
  literal: "緑", onReadings: ["リョク"], kunReadings: ["みどり"], meaningsEn: ["green"], meaningVi: null, mnemonic: null,
  strokeCount: 14, grade: 3, frequency: 1300, jlpt: "N2", strokePaths: ["M1 1L2 2"],
  components: { element: "緑", children: [] } as unknown as KanjiData["components"],
  commonWords: [{ entSeq: 30, headword: "緑色", reading: "みどりいろ", glossEn: "green colour" }],
  curatedKanjiId: null, attribution: [{ source: "kanjivg", version: "main", url: "https://kanjivg.tagaini.net", license: "CC BY-SA 3.0" }],
};

let fetchMock: ReturnType<typeof vi.fn>;
let failKanji = false;
let yt: YouTubeStubHandle;

beforeEach(() => {
  yt = installYouTubeStub();
  failKanji = false;
  resetTabWritesForTests(); resetLineAnalysisCacheForTests(); resetGlossRequestsForTests(); resetKanjiCacheForTests();
  sessionStorage.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/lines/line-1/analysis")) return json({ data: ANALYSIS });
    if (url.startsWith("/api/dictionary/kanji/")) return failKanji ? json({ error: "x" }, 500) : json({ data: KANJI });
    if (url.startsWith("/api/dictionary/gloss?")) return json({ data: { entSeq: 0, status: "missing", glossesVi: [], note: null, source: null } });
    if (url === "/api/dictionary/gloss" && init?.method === "POST") {
      const entryId = (JSON.parse(String(init.body)) as { entryId: number }).entryId;
      return json({ data: { entSeq: entryId, status: "ready", glossesVi: [entryId === 30 ? "màu xanh lá" : "xanh lá"], note: null, source: "ai" } });
    }
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); document.getSelection()?.removeAllRanges(); });

const drawer = () => screen.getByRole("region", { name: "Công cụ học" });
const level = () => drawer().getAttribute("data-drawer-level");
const tabNames = () => within(drawer()).getAllByRole("tab").map((node) => node.textContent);
const heading = () => within(drawer()).queryByRole("heading", { level: 3 })?.textContent ?? null;
const glossPosts = () => fetchMock.mock.calls
  .filter(([input, init]) => String(input) === "/api/dictionary/gloss" && (init as RequestInit | undefined)?.method === "POST")
  .map(([, init]) => (JSON.parse(String((init as RequestInit).body)) as { entryId: number }).entryId);

function renderShell() {
  render(<ThemeProvider><ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell></ThemeProvider>, { locale: "vi" });
}
const rowText = (lineId: string) => {
  const row = document.querySelector<HTMLElement>(`li [data-line-id="${lineId}"]`);
  if (!row) throw new Error(lineId);
  return row;
};
/** Select 緑 in the first transcript row, then press its kanji button in the popover's word card. */
async function openKanjiFromPopover() {
  const row = rowText("line-1");
  const node = document.createTreeWalker(row, NodeFilter.SHOW_TEXT).nextNode();
  if (!node) throw new Error("no text");
  const range = document.createRange();
  range.setStart(node, 0);
  range.setEnd(node, 1);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  fireEvent.mouseUp(row);
  const dialog = await screen.findByRole("dialog");
  const kanji = await within(dialog).findByRole("button", { name: "Kanji 緑" });
  kanji.focus();
  fireEvent.click(kanji);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

describe("Inspector", () => {
  it("a kanji in the popover's word card opens the Inspector over the drawer, which keeps its two tabs", async () => {
    renderShell();
    const player = document.querySelector("[data-workspace-player]");
    await openKanjiFromPopover();
    expect(level()).toBe("peek");
    expect(heading()).toBe("緑");
    expect(within(drawer()).getByRole("button", { name: "Quay lại" })).toBeInTheDocument();
    expect(within(drawer()).getByRole("button", { name: "Đóng" })).toBeInTheDocument();
    expect(await within(drawer()).findByRole("article", { name: "Kanji 緑" })).toBeInTheDocument();
    expect(tabNames()).toEqual(["Thẻ câu", "Ghi chú"]);
    expect(document.querySelector("[data-workspace-player]")).toBe(player);
  });

  it("never changes the drawer's target: Close returns to the pinned sentence on the tab it was on", async () => {
    renderShell();
    fireEvent.click(within(document.querySelector<HTMLElement>('li[data-index="1"]') as HTMLElement).getByRole("button", { name: "Ghi chú" }));
    expect(within(drawer()).getByRole("tabpanel")).toHaveTextContent("雨が好き");
    const header = drawer().textContent ?? "";
    await openKanjiFromPopover();
    expect(heading()).toBe("緑");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Đóng" }));
    expect(heading()).toBeNull();
    expect(screen.getByRole("tab", { name: "Ghi chú" })).toHaveAttribute("aria-selected", "true");
    expect(within(drawer()).getByRole("tabpanel")).toHaveTextContent("雨が好き");
    expect(drawer().textContent).toBe(header);
  });

  it("a common word opens its card in the Inspector (its Vietnamese gloss requested once), a kanji pushes, Back walks back", async () => {
    renderShell();
    await openKanjiFromPopover();
    fireEvent.click(await within(drawer()).findByRole("button", { name: /緑色.*みどりいろ/ }));
    expect(heading()).toBe("緑色");
    expect(await within(drawer()).findByText("màu xanh lá")).toBeInTheDocument();
    await waitFor(() => expect(glossPosts().filter((id) => id === 30)).toHaveLength(1));
    fireEvent.click(within(drawer()).getAllByRole("button", { name: "Kanji 緑" })[0] as HTMLElement);
    expect(heading()).toBe("緑");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Quay lại" }));
    expect(heading()).toBe("緑色");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Quay lại" }));
    expect(heading()).toBe("緑");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Quay lại" }));
    expect(heading()).toBeNull();
    expect(level()).toBe("collapsed");
    expect(glossPosts().filter((id) => id === 30)).toHaveLength(1);
  });

  it("Close from any depth restores the tab and the level it opened over", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("tab", { name: "Ghi chú" }));
    fireEvent.keyDown(screen.getByRole("separator", { name: "Đổi kích thước công cụ học" }), { key: "ArrowUp" });
    expect(level()).toBe("expanded");
    await openKanjiFromPopover();
    fireEvent.click(await within(drawer()).findByRole("button", { name: /緑色.*みどりいろ/ }));
    expect(heading()).toBe("緑色");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Đóng" }));
    expect(heading()).toBeNull();
    expect(level()).toBe("expanded");
    expect(screen.getByRole("tab", { name: "Ghi chú" })).toHaveAttribute("aria-selected", "true");
  });

  it("returns focus to the sentence it was opened from, or to the selected tab once that sentence is gone", async () => {
    renderShell();
    await openKanjiFromPopover();
    fireEvent.click(within(drawer()).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(rowText("line-1")).toHaveFocus());
    await openKanjiFromPopover();
    // Searching filters the transcript: the row the Inspector was opened from leaves the DOM.
    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm trong phụ đề" }), { target: { value: "好き" } });
    expect(document.querySelector('li [data-line-id="line-1"]')).toBeNull();
    fireEvent.click(within(drawer()).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.getByRole("tab", { name: "Thẻ câu" })).toHaveFocus());
  });

  it("returns focus to the Live Sentence text it was opened from", async () => {
    renderShell();
    const live = document.querySelector<HTMLElement>("[data-word-click]");
    if (!live) throw new Error("no live sentence");
    const node = document.createTreeWalker(live, NodeFilter.SHOW_TEXT).nextNode();
    const range = document.createRange();
    range.setStart(node as Node, 0);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.click(live.querySelector("p") ?? live);
    fireEvent.click(await within(await screen.findByRole("dialog")).findByRole("button", { name: "Kanji 緑" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(within(drawer()).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(live).toHaveFocus());
  });

  it("moves focus to the new entry's title on every push and pop, and labels the panel with it", async () => {
    renderShell();
    await openKanjiFromPopover();
    expect(within(drawer()).getByRole("tabpanel")).toHaveAccessibleName("緑");
    fireEvent.click(await within(drawer()).findByRole("button", { name: /緑色.*みどりいろ/ }));
    expect(within(drawer()).getByRole("heading", { level: 3 })).toHaveFocus();
    expect(within(drawer()).getByRole("tabpanel")).toHaveAccessibleName("緑色");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Quay lại" }));
    expect(within(drawer()).getByRole("heading", { level: 3, name: "緑" })).toHaveFocus();
  });

  it("a row action that closes the Inspector leaves focus on that row action", async () => {
    renderShell();
    await openKanjiFromPopover();
    const note = within(document.querySelector<HTMLElement>('li[data-index="1"]') as HTMLElement).getByRole("button", { name: "Ghi chú" });
    note.focus();
    fireEvent.click(note);
    expect(heading()).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(note).toHaveFocus();
  });

  it("shows the error of a kanji that fails to load, and Back and Close still work (Review Focus 3)", async () => {
    failKanji = true;
    renderShell();
    await openKanjiFromPopover();
    expect(await within(drawer()).findByText("Không tải được kanji này.")).toBeInTheDocument();
    fireEvent.click(within(drawer()).getByRole("button", { name: "Quay lại" }));
    expect(heading()).toBeNull();
    await openKanjiFromPopover();
    expect(await within(drawer()).findByText("Không tải được kanji này.")).toBeInTheDocument();
    fireEvent.click(within(drawer()).getByRole("button", { name: "Đóng" }));
    expect(heading()).toBeNull();
    await waitFor(() => expect(rowText("line-1")).toHaveFocus());
  });

  it("Escape closes the Inspector first, then collapses the drawer", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("tab", { name: "Ghi chú" }));
    await openKanjiFromPopover();
    expect(heading()).toBe("緑");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(heading()).toBeNull();
    expect(level()).toBe("peek");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(level()).toBe("collapsed");
  });

  it("a drawer collapsed under the Inspector does not spend an Escape on it, and shows it again when reopened", async () => {
    renderShell();
    await openKanjiFromPopover();
    const separator = screen.getByRole("separator", { name: "Đổi kích thước công cụ học" });
    fireEvent.keyDown(separator, { key: "Home" });
    expect(level()).toBe("collapsed");
    fireEvent.keyDown(document.body, { key: "Escape" });
    act(() => { fireEvent.keyDown(separator, { key: "ArrowUp" }); });
    expect(heading()).toBe("緑");
  });
});
