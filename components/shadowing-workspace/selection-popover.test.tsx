import viShadowing from "@/messages/vi/shadowing.json";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { AnalysisToken, LineAnalysisDto } from "@/lib/analysis/types";
import { tokenSpans } from "@/lib/analysis/spans";
import { resetTabWritesForTests, usePositionStore } from "./workspace-context";
import { ShadowingWorkspaceShell } from "./workspace-shell";
import { TranscriptPanel } from "./transcript-panel";
import { resetLineAnalysisCacheForTests } from "./use-line-analysis";
import { resetGlossRequestsForTests } from "./drawer/word-card";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
  // The header renders the mode bar (Shadowing · Summary) since 2026-10-04; it reads the locale-less path.
  usePathname: () => "/shadowing/video-1",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/vi/shadowing/video-1", useSearchParams: () => new URLSearchParams() }));

const RAIN = "明日は雨です";
const LONG = "あ".repeat(60);
const LINES = [
  { id: "line-1", index: 0, startTime: 0, endTime: 2, textJp: "おはよう", textTranslation: null, furigana: null },
  { id: "line-2", index: 1, startTime: 2, endTime: 4, textJp: RAIN, textTranslation: null, furigana: null },
  { id: "line-3", index: 2, startTime: 4, endTime: 6, textJp: LONG, textTranslation: null, furigana: null },
];
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 6, jlptLevel: "N5" },
  transcript: { id: "transcript-1", lines: LINES },
  masteryMap: {},
  preferences: DEFAULT_PREFERENCES,
  resume: null,
  lessonBookmarked: false,
  marks: [],
  notes: { lessonNote: null, sentenceNotes: [] },
};

function analysis(lineId: string, text: string, tokens: [string, string, Partial<AnalysisToken>?][]): LineAnalysisDto {
  const spans = tokenSpans(text, tokens.map(([surface]) => surface));
  return {
    lineId, snapshotId: "s", grammar: [], mastery: {},
    tokens: tokens.map(([surface, pos, extra], index) => ({
      index, surface, base: surface, reading: null, pos, span: spans[index] ?? { start: 0, end: 0 }, entries: [], vocabId: null, ...extra,
    })),
  };
}
const ANALYSES: Record<string, LineAnalysisDto> = {
  "line-2": analysis("line-2", RAIN, [
    ["明日", "名詞", { entries: [{ entSeq: 1, headword: "明日", reading: "あした", glossEn: "tomorrow", jlpt: 5 }] }],
    ["は", "助詞"],
    ["雨", "名詞", { entries: [{ entSeq: 2, headword: "雨", reading: "あめ", glossEn: "rain", jlpt: 5 }, { entSeq: 3, headword: "雨", reading: "う", glossEn: "rain (literary)", jlpt: null }] }],
    ["です", "助動詞"],
  ]),
  "line-3": analysis("line-3", LONG, [[LONG, "名詞"]]),
};

let fetchMock: ReturnType<typeof vi.fn>;
let yt: YouTubeStubHandle;
let store: ReturnType<typeof usePositionStore> | undefined;
function Probe(): null { store = usePositionStore(); return null; }

beforeEach(() => {
  yt = installYouTubeStub();
  resetTabWritesForTests();
  resetLineAnalysisCacheForTests();
  resetGlossRequestsForTests();
  sessionStorage.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const lineMatch = url.match(/\/api\/lines\/([^/]+)\/analysis/);
    if (lineMatch) return json({ data: ANALYSES[lineMatch[1] ?? ""] });
    if (url.startsWith("/api/dictionary/gloss?")) return json({ data: { entSeq: 2, status: "missing", glossesVi: [], note: null, source: null } });
    if (url === "/api/dictionary/gloss" && init?.method === "POST") return json({ data: { entSeq: 2, status: "ready", glossesVi: ["mưa"], note: null, source: "ai" } });
    if (url === "/api/mining") return json({ data: {} }, 201);
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); document.getSelection()?.removeAllRanges(); });

function renderShell() {
  return render(<ShadowingWorkspaceShell bootstrap={bootstrap}><Probe /><TranscriptPanel /></ShadowingWorkspaceShell>, { locale: "vi" });
}
const rowText = (lineId: string) => {
  const row = screen.getByRole("list", { name: viShadowing.workspace.transcript.label }).querySelector<HTMLElement>(`[data-line-id="${lineId}"]`);
  if (!row) throw new Error(lineId);
  return row;
};
function selectIn(element: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const node = walker.nextNode();
  if (!node) throw new Error("no text");
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}
const posts = (url: string) => fetchMock.mock.calls.filter(([input, init]) => String(input) === url && (init as RequestInit | undefined)?.method === "POST");

describe("selection popover", () => {
  it("one token → a non-modal word card; the Vietnamese gloss is POSTed once, only because GET said missing", async () => {
    renderShell();
    selectIn(rowText("line-2"), 3, 4);
    fireEvent.mouseUp(rowText("line-2"));
    const dialog = await screen.findByRole("dialog", { name: "Đoạn chọn: 雨" });
    expect(await within(dialog).findByText("rain (literary)")).toBeInTheDocument();
    expect(within(dialog).getByText("あめ")).toBeInTheDocument();
    expect(within(dialog).getByText("名詞")).toBeInTheDocument();
    expect(await within(dialog).findByText("mưa")).toBeInTheDocument();
    expect(within(dialog).getByText("Do AI tạo")).toBeInTheDocument();
    expect(posts("/api/dictionary/gloss")).toHaveLength(1);

    // Open the same word again: no second generation request.
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    selectIn(rowText("line-2"), 3, 4);
    fireEvent.mouseUp(rowText("line-2"));
    expect(await within(await screen.findByRole("dialog")).findByText("mưa")).toBeInTheDocument();
    expect(posts("/api/dictionary/gloss")).toHaveLength(1);
    expect(screen.getByRole("dialog")).not.toHaveAttribute("aria-modal");
  });

  it("each kanji of the headword opens the Inspector without changing the drawer target", async () => {
    renderShell();
    selectIn(rowText("line-2"), 0, 2);
    fireEvent.mouseUp(rowText("line-2"));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("button", { name: "Kanji 日" }));
    const drawer = screen.getByRole("region", { name: "Công cụ học" });
    expect(within(drawer).getByRole("button", { name: "Quay lại" })).toBeInTheDocument();
    expect(within(drawer).getByRole("heading", { name: "日" })).toBeInTheDocument();
    expect(drawer).toHaveTextContent("Câu hiện tại · 1 / 3");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("several tokens show phrase text and actions without Analyze", async () => {
    renderShell();
    selectIn(rowText("line-2"), 1, 4); // 日は雨 → snaps to 明日は雨
    fireEvent.mouseUp(rowText("line-2"));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("明日は雨")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Phát câu" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Đánh dấu câu" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Thêm vào thẻ câu" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Phân tích" })).toBeNull();
    const analysisUrls = fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("/analysis"));
    expect(analysisUrls.length).toBeGreaterThan(0);
    expect(analysisUrls.every((url) => url.endsWith("?scope=lexical"))).toBe(true);
    expect(posts("/api/dictionary/gloss")).toHaveLength(0);
  });

  it("offers Play, Bookmark and Add to Mining; Mining refuses a selection over 50 characters with a visible reason", async () => {
    renderShell();
    selectIn(rowText("line-3"), 0, 60);
    fireEvent.mouseUp(rowText("line-3"));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Phát câu" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Đánh dấu câu" })).toHaveAttribute("aria-pressed", "false");
    const mine = within(dialog).getByRole("button", { name: "Thêm vào thẻ câu" });
    expect(mine).toBeDisabled();
    expect(mine).toHaveAccessibleDescription("Chọn tối đa 50 ký tự để thêm vào thẻ câu.");

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    selectIn(rowText("line-2"), 3, 4);
    fireEvent.mouseUp(rowText("line-2"));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Thêm vào thẻ câu" }));
    await waitFor(() => expect(posts("/api/mining")).toHaveLength(1));
    expect(JSON.parse(String((posts("/api/mining")[0]?.[1] as RequestInit).body))).toEqual({ lineId: "line-2", targetWord: "雨" });
  });

  it("closes on Escape and returns focus to the text, with no focus trap", async () => {
    renderShell();
    selectIn(rowText("line-2"), 3, 4);
    fireEvent.mouseUp(rowText("line-2"));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(false); // opening never steals focus from the text
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(rowText("line-2")).toHaveFocus();
    // The Escape key coming back up, with the selection still there (Chrome keeps it), must not open it again.
    selectIn(rowText("line-2"), 3, 4);
    fireEvent.keyUp(rowText("line-2"), { key: "Escape" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a keyboard selection (Shift held) still opens the popover on key up", async () => {
    renderShell();
    selectIn(rowText("line-2"), 3, 4);
    fireEvent.keyUp(rowText("line-2"), { key: "ArrowRight", shiftKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("a selection across two rows opens nothing", async () => {
    renderShell();
    const range = document.createRange();
    range.setStart(rowText("line-1").querySelector("span")?.firstChild as Node, 1);
    range.setEnd(rowText("line-2").querySelector("span")?.firstChild as Node, 2);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.mouseUp(rowText("line-2"));
    // Long enough for a popover to mount and request its analysis, which is what would happen if it opened.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 50)); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/analysis"))).toHaveLength(0);
  });
});

describe("selectable transcript rows", () => {
  it("a click on the text still seeks; a drag selection does not", () => {
    renderShell();
    act(() => store?.set(0.5));
    selectIn(rowText("line-3"), 0, 5);
    fireEvent.click(rowText("line-3"));
    expect(store?.get()).toBe(0.5);
    document.getSelection()?.removeAllRanges();
    fireEvent.click(rowText("line-3"));
    expect(store?.get()).toBe(4);
  });
});

describe("Live Sentence word click", () => {
  it("a plain click on a word opens its word card", async () => {
    renderShell();
    act(() => store?.set(2.5));
    const live = document.querySelector<HTMLElement>("[data-word-click]");
    if (!live) throw new Error("no live sentence");
    const node = document.createTreeWalker(live, NodeFilter.SHOW_TEXT).nextNode();
    const range = document.createRange();
    range.setStart(node as Node, 3);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.click(live.querySelector("p") ?? live);
    const dialog = await screen.findByRole("dialog", { name: "Đoạn chọn: 雨" });
    expect(await within(dialog).findByText("rain")).toBeInTheDocument();
  });
});

describe("Live Sentence keyboard lookup", () => {
  const liveText = () => screen.getByRole("group", { name: "Tra từ trong câu này" });
  const analysisCalls = () => fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("/analysis"));

  it("the text is a tab stop; Enter lists the line's dictionary words, one opens its card and Back returns to the list", async () => {
    renderShell();
    act(() => store?.set(2.5));
    expect(liveText()).toHaveAttribute("tabindex", "0");
    liveText().focus();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(analysisCalls()).toEqual([]);
    fireEvent.keyDown(liveText(), { key: "Enter" });
    const dialog = await screen.findByRole("dialog");
    const list = await within(dialog).findByRole("list", { name: "Các từ trong câu" });
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([expect.stringContaining("明日"), expect.stringContaining("雨")]);
    expect(analysisCalls()).toEqual(["/api/lines/line-2/analysis?scope=lexical"]);
    expect(within(dialog).queryByRole("button", { name: "Thêm vào thẻ câu" })).toBeNull();
    // Keyboard-reachable: the list takes focus on its first word, a picked word hands it to Back.
    await waitFor(() => expect(within(list).getAllByRole("button")[0]).toHaveFocus());
    fireEvent.click(within(list).getAllByRole("button")[1] as HTMLElement);
    expect(await within(dialog).findByText("rain")).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Quay lại" })).toHaveFocus());
    expect(within(dialog).getByRole("button", { name: "Thêm vào thẻ câu" })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Quay lại" }));
    const back = within(dialog).getByRole("list", { name: "Các từ trong câu" });
    expect(within(back).getAllByRole("button")[1]).toHaveFocus();
  });

  it("Escape closes the list and returns focus to the sentence text", async () => {
    renderShell();
    act(() => store?.set(2.5));
    liveText().focus();
    fireEvent.keyDown(liveText(), { key: "Enter" });
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("list", { name: "Các từ trong câu" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(liveText()).toHaveFocus();
  });

  it("keeps the line it opened on while the sentence advances (Review Focus 4), and a sentence change alone fetches nothing", async () => {
    renderShell();
    act(() => store?.set(0.5));
    liveText().focus();
    act(() => store?.set(2.5));
    act(() => store?.set(4.5));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(analysisCalls()).toEqual([]);
    act(() => store?.set(2.5));
    fireEvent.keyDown(liveText(), { key: "Enter" });
    const list = await within(await screen.findByRole("dialog")).findByRole("list", { name: "Các từ trong câu" });
    act(() => store?.set(4.5));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([expect.stringContaining("明日"), expect.stringContaining("雨")]);
  });

  it("is not a tab stop while the Japanese is hidden", () => {
    renderShell();
    act(() => store?.set(2.5));
    fireEvent.click(screen.getByRole("button", { name: "Ẩn tiếng Nhật" }));
    expect(document.querySelector("[data-word-click]")).toHaveAttribute("tabindex", "-1");
  });
});
