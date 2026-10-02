import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { LexicalLineAnalysisDto } from "@/lib/analysis/types";
import { resetTabWritesForTests, usePositionStore } from "../workspace-context";
import { ShadowingWorkspaceShell } from "../workspace-shell";
import { TranscriptPanel } from "../transcript-panel";
import { resetLineAnalysisCacheForTests } from "../use-line-analysis";
import { resetNoteWritesForTests } from "./notes-context";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1", useSearchParams: () => new URLSearchParams() }));

const LINES = Array.from({ length: 6 }, (_, i) => ({
  id: `line-${i + 1}`, index: i, startTime: i * 2, endTime: i * 2 + 2, textJp: `文${i + 1}`, textTranslation: null, furigana: null,
}));
const note = (lineId: string, body: string) => ({ key: `sentence:${lineId}`, lineId, videoId: "video-1", body, updatedAt: "2026-10-02T00:00:00Z" });
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 12, jlptLevel: "N4" },
  transcript: { id: "transcript-1", lines: LINES },
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [],
  notes: { lessonNote: null, sentenceNotes: [note("line-5", "fifth"), note("line-2", "second")] },
};
const analysis = (lineId: string): LexicalLineAnalysisDto => ({ lineId, snapshotId: "s", tokens: [], mastery: {} });

let fetchMock: ReturnType<typeof vi.fn>;
let failNotes = false;
let yt: YouTubeStubHandle;
let store: ReturnType<typeof usePositionStore> | undefined;
function Probe(): null { store = usePositionStore(); return null; }

beforeEach(() => {
  yt = installYouTubeStub();
  failNotes = false;
  resetTabWritesForTests(); resetLineAnalysisCacheForTests(); resetNoteWritesForTests();
  sessionStorage.clear();
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.includes("/api/lines/")) {
      const lineId = url.split("/")[3] ?? "";
      return json({ data: analysis(lineId) });
    }
    if (url === "/api/sentence-notes" || url.endsWith("/notes")) return failNotes ? json({ error: "x" }, 500) : json({ data: { saved: init?.method === "PUT" } });
    if (url === "/api/videos/video-1/mining-cards") {
      return json({ data: [
        { id: "c1", targetWord: "文", reading: "ぶん", sentenceJp: "文1", lineId: "line-1", startTime: 0 },
        { id: "c3", targetWord: "三", reading: null, sentenceJp: "文3", lineId: "line-3", startTime: 4 },
        { id: "c9", targetWord: "外", reading: null, sentenceJp: "消えた文", lineId: null, startTime: 9 },
      ] });
    }
    return new Response(null, { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

function renderShell() {
  render(<ShadowingWorkspaceShell bootstrap={bootstrap}><Probe /><TranscriptPanel /></ShadowingWorkspaceShell>);
}
const row = (n: number) => document.querySelector<HTMLElement>(`li[data-index="${n - 1}"]`) as HTMLElement;
const openFromRow = (n: number, action: string) => fireEvent.click(within(row(n)).getByRole("button", { name: action }));
const panel = () => screen.getByRole("tabpanel");
const at = (seconds: number) => act(() => { store?.set(seconds); });
const noteWrites = () => fetchMock.mock.calls.filter(([input]) => String(input) === "/api/sentence-notes");

describe("Notes tab", () => {
  it("a note typed for a pinned line saves to that line while playback moves on (Review Focus 2)", async () => {
    renderShell();
    at(1);
    openFromRow(3, "Note");
    for (let second = 3; second < 12; second += 2) at(second);
    const editor = within(panel()).getByLabelText("Note for sentence 3");
    fireEvent.change(editor, { target: { value: "remember this" } });
    expect(within(panel()).getByRole("status")).toHaveTextContent("Saving…");
    await waitFor(() => expect(noteWrites()).toHaveLength(1), { timeout: 2_000 });
    expect(JSON.parse(String((noteWrites()[0]?.[1] as RequestInit).body))).toEqual({ transcriptLineId: "line-3", body: "remember this" });
    await waitFor(() => expect(within(panel()).getByText("Saved")).toBeInTheDocument());
    expect(within(row(3)).getByText("Has a note")).toBeInTheDocument();
  });

  it("typing while following pins the sentence first", async () => {
    renderShell();
    at(3);
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    const editor = within(panel()).getByLabelText("Note for sentence 2");
    fireEvent.focus(editor);
    expect(screen.getByRole("region", { name: "Study tools" })).toHaveTextContent("Sentence 2 / 6· Pinned");
    at(9);
    expect(within(panel()).getByLabelText("Note for sentence 2")).toBeInTheDocument();
  });

  it("saves the lesson note to the lesson, on blur at once", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    const lesson = within(panel()).getByLabelText("Lesson note");
    fireEvent.change(lesson, { target: { value: "lesson memo" } });
    fireEvent.blur(lesson);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/videos/video-1/notes", expect.objectContaining({ method: "PUT", body: JSON.stringify({ body: "lesson memo" }) })));
  });

  it("lists every note in line order, a note seeks, and rows show the note indicator", () => {
    renderShell();
    fireEvent.click(screen.getByRole("tab", { name: "Notes" }));
    const list = within(panel()).getByRole("region", { name: "All notes in this lesson" });
    expect(within(list).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Sentence 2 · 文2second", "Sentence 5 · 文5fifth",
    ]);
    fireEvent.click(within(list).getByRole("button", { name: /fifth/ }));
    expect(store?.get()).toBe(8);
    expect(within(row(2)).getByText("Has a note")).toBeInTheDocument();
    expect(within(row(1)).queryByText("Has a note")).toBeNull();
  });

  it("shows a failed save with Retry, which resends the latest body", async () => {
    failNotes = true;
    renderShell();
    at(1);
    openFromRow(1, "Note");
    const editor = within(panel()).getByLabelText("Note for sentence 1");
    fireEvent.change(editor, { target: { value: "draft" } });
    fireEvent.blur(editor);
    expect(await within(panel()).findByText("Couldn't save.")).toBeInTheDocument();
    failNotes = false;
    fireEvent.click(within(panel()).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(within(panel()).getByText("Saved")).toBeInTheDocument());
    expect(noteWrites()).toHaveLength(2);
  });
});

describe("Mining tab", () => {
  it("lists this lesson's cards by time, highlights the target's, and a card seeks", async () => {
    renderShell();
    openFromRow(3, "Note");
    fireEvent.click(screen.getByRole("tab", { name: "Mining" }));
    const cards = await within(panel()).findAllByRole("button", { name: /文|三|外/ });
    expect(cards).toHaveLength(3);
    expect(cards.filter((card) => card.getAttribute("aria-current") === "true").map((card) => card.textContent)).toEqual(["三文3"]);
    fireEvent.click(cards[0] as HTMLElement);
    expect(store?.get()).toBe(0);
    fireEvent.click(cards[2] as HTMLElement); // its line was deleted: seek by time
    expect(store?.get()).toBe(9);
  });
});
