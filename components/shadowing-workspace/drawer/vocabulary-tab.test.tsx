import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { KanjiData } from "@/lib/dictionary/types";
import type { LessonVocabularyItem, LineAnalysisDto } from "@/lib/analysis/types";
import { tokenSpans } from "@/lib/analysis/spans";
import { resetTabWritesForTests, usePositionStore } from "../workspace-context";
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
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [],
};
const spans = tokenSpans(TEXT, ["緑", "の", "雨", "です"]);
const ANALYSIS: LineAnalysisDto = {
  lineId: "line-1", snapshotId: "s", grammar: [], mastery: { "v-ame": 4 },
  tokens: [
    { index: 0, surface: "緑", base: "緑", reading: "ミドリ", pos: "名詞", span: spans[0] ?? { start: 0, end: 0 }, entries: [{ entSeq: 10, headword: "緑", reading: "みどり", glossEn: "green", jlpt: null }], vocabId: null },
    { index: 1, surface: "の", base: "の", reading: "ノ", pos: "助詞", span: spans[1] ?? { start: 0, end: 0 }, entries: [], vocabId: null },
    { index: 2, surface: "雨", base: "雨", reading: "アメ", pos: "名詞", span: spans[2] ?? { start: 0, end: 0 }, entries: [{ entSeq: 20, headword: "雨", reading: "あめ", glossEn: "rain", jlpt: 5 }], vocabId: "v-ame" },
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
const item = (entSeq: number, occurrences: number): LessonVocabularyItem => ({
  entSeq, headword: `語${entSeq}`, reading: "ご", glossEn: `word ${entSeq}`, occurrences, jlpt: null, vocabId: null, mastery: null, exampleLineIds: ["line-2"],
});

let fetchMock: ReturnType<typeof vi.fn>;
let yt: YouTubeStubHandle;
let store: ReturnType<typeof usePositionStore> | undefined;
function Probe(): null { store = usePositionStore(); return null; }

beforeEach(() => {
  yt = installYouTubeStub();
  resetTabWritesForTests(); resetLineAnalysisCacheForTests(); resetGlossRequestsForTests(); resetKanjiCacheForTests();
  sessionStorage.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/lines/line-1/analysis")) return json({ data: ANALYSIS });
    if (url.startsWith("/api/dictionary/kanji/")) return json({ data: KANJI });
    if (url.startsWith("/api/dictionary/gloss?")) return json({ data: { entSeq: 0, status: "missing", glossesVi: [], note: null, source: null } });
    if (url === "/api/dictionary/gloss" && init?.method === "POST") return json({ data: { entSeq: 10, status: "ready", glossesVi: ["xanh lá"], note: null, source: "ai" } });
    if (url.startsWith("/api/videos/video-1/vocabulary")) {
      const page2 = url.includes("cursor=50");
      return json({ data: { items: page2 ? [item(3, 1)] : [item(1, 9), item(2, 4)], nextCursor: page2 ? null : "50", total: 3 } });
    }
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

async function openVocabulary() {
  render(<ThemeProvider><ShadowingWorkspaceShell bootstrap={bootstrap}><Probe /><TranscriptPanel /></ShadowingWorkspaceShell></ThemeProvider>, { locale: "vi" });
  act(() => store?.set(0.5));
  fireEvent.click(screen.getByRole("tab", { name: "Từ vựng" }));
  return screen.getByRole("tabpanel");
}
const glossCalls = (method: "GET" | "POST") => fetchMock.mock.calls.filter(([input, init]) =>
  String(input).startsWith("/api/dictionary/gloss") && ((init as RequestInit | undefined)?.method ?? "GET") === method);

describe("VocabularyTab", () => {
  it("lists the target's dictionary words as buttons with reading, gloss and SRS stage — and requests no gloss", async () => {
    const panel = await openVocabulary();
    const rain = await within(panel).findByRole("button", { name: /雨.*あめ.*rain.*SRS 4/ });
    expect(rain).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /緑.*みどり.*green/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /^の/ })).toBeNull();
    expect(glossCalls("GET")).toHaveLength(0);
    expect(glossCalls("POST")).toHaveLength(0);
  });

  it("a word opens its card (which requests its gloss), a kanji opens QuickInspect, and Back walks back", async () => {
    const panel = await openVocabulary();
    fireEvent.click(await within(panel).findByRole("button", { name: /緑.*みどり/ }));
    expect(await within(panel).findByText("xanh lá")).toBeInTheDocument();
    expect(glossCalls("POST")).toHaveLength(1);
    fireEvent.click(within(panel).getByRole("button", { name: "Kanji 緑" }));
    expect(await within(panel).findByRole("article", { name: "Kanji 緑" })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Quay lại" }));
    expect(await within(panel).findByText("xanh lá")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Quay lại" }));
    expect(await within(panel).findByRole("button", { name: /雨.*あめ/ })).toBeInTheDocument();
  });

  it("a common word from QuickInspect opens its card without requesting a generation", async () => {
    const panel = await openVocabulary();
    fireEvent.click(await within(panel).findByRole("button", { name: /緑.*みどり/ }));
    await within(panel).findByText("xanh lá");
    fireEvent.click(within(panel).getByRole("button", { name: "Kanji 緑" }));
    fireEvent.click(await within(panel).findByRole("button", { name: /緑色.*みどりいろ/ }));
    expect(await within(panel).findByText("green colour")).toBeInTheDocument();
    await waitFor(() => expect(glossCalls("GET")).toHaveLength(2));
    expect(glossCalls("POST")).toHaveLength(1); // only the first, explicitly opened word
  });

  it("Whole lesson pages the lesson vocabulary, and a word's sentence seeks", async () => {
    const panel = await openVocabulary();
    fireEvent.click(within(panel).getByRole("button", { name: "Cả bài" }));
    expect(await within(panel).findByText("3 từ trong bài này")).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Xem thêm" }));
    expect(await within(panel).findByRole("button", { name: /語3/ })).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => url.includes("/vocabulary"))).toEqual([
      "/api/videos/video-1/vocabulary?limit=50",
      "/api/videos/video-1/vocabulary?limit=50&cursor=50",
    ]);
    fireEvent.click(within(panel).getByRole("button", { name: /語1/ }));
    fireEvent.click(within(within(panel).getByRole("list", { name: "Các câu có 語1" })).getByRole("button", { name: /雨が好き/ }));
    expect(store?.get()).toBe(2);
  });
});
