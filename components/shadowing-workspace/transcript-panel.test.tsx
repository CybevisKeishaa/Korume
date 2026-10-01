import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import type { PlaybackController } from "./use-playback-controller";
import { TranscriptPanel } from "./transcript-panel";
import { usePositionStore, useSession, WorkspaceProviders } from "./workspace-context";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}));

const line = (id: string, index: number, textJp: string, textTranslation: string, furigana: WorkspaceLine["furigana"] = null): WorkspaceLine =>
  ({ id, index, startTime: index * 5, endTime: index * 5 + 4, textJp, textTranslation, furigana });

const lines: WorkspaceLine[] = [
  line("a", 0, "本日はお集まりいただき", "Thank you for coming", [{ text: "本日", reading: "ほんじつ" }, { text: "はお集まりいただき" }]),
  line("b", 1, "会議を始めます", "Let us begin", [{ text: "会議", reading: "かいぎ" }, { text: "を始めます" }]),
  line("c", 2, "先月の売上", "Last month's sales"),
  line("d", 3, "目標を上回る", "Above the target"),
];

const seekToSentence = vi.fn();
const controller = { seekToSentence } as unknown as PlaybackController;
let store: ReturnType<typeof usePositionStore> | undefined;
let session: ReturnType<typeof useSession> | undefined;
function Probe(): null {
  store = usePositionStore();
  session = useSession();
  return null;
}

function renderPanel({ preferences = {}, at = 6, marks = [], rows = lines }: {
  preferences?: Partial<UserPreferences>; at?: number; marks?: WorkspaceBootstrap["marks"]; rows?: WorkspaceLine[];
} = {}) {
  const bootstrap: WorkspaceBootstrap = {
    userId: "u", video: { id: "v", youtubeVideoId: "yt", title: "T", channelTitle: null, durationSeconds: 380, jlptLevel: null },
    transcript: { id: "t", lines: rows }, masteryMap: {}, preferences: { ...DEFAULT_PREFERENCES, ...preferences },
    resume: null, lessonBookmarked: false, marks,
  };
  const view = render(<WorkspaceProviders bootstrap={bootstrap} controller={controller}><TranscriptPanel /><Probe /></WorkspaceProviders>);
  act(() => store?.set(at));
  return view;
}

const rowOf = (text: string) => screen.getByText(text).closest("li")!;
const rowAt = (index: number) => document.querySelector<HTMLElement>(`li[data-index="${index}"]`)!;
const bodyOf = (text: string) => within(rowOf(text)).getAllByRole("button")[0]!;
const fetchMock = () => vi.mocked(fetch);
const readingsIn = (element: Element) => Array.from(element.querySelectorAll("rt")).map((rt) => rt.textContent);

describe("TranscriptPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    HTMLElement.prototype.scrollTo = vi.fn() as unknown as HTMLElement["scrollTo"];
  });

  it("shows the count and length, numbers rows from 01, and marks the current one", () => {
    renderPanel({ at: 6 });
    expect(screen.getByText("4 sentences · 6 min")).toBeInTheDocument();
    expect(within(rowOf("本日はお集まりいただき")).getByText("01")).toBeInTheDocument();
    expect(bodyOf("会議を始めます")).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByRole("button", { current: true })).toHaveLength(1);
    expect(rowOf("本日はお集まりいただき")).toHaveAttribute("data-state", "past");
    expect(rowOf("先月の売上")).toHaveAttribute("data-state", "future");
  });

  it("softens the current row in the gap after it ends", () => {
    renderPanel({ at: 4.5 });
    expect(rowOf("本日はお集まりいただき")).toHaveAttribute("data-spoken", "false");
  });

  it("pads numbers to three digits past 99 lines", () => {
    const many = Array.from({ length: 100 }, (_, i) => line(`l${i}`, i, `行${i}`, `line ${i}`));
    renderPanel({ rows: many, at: 0 });
    expect(within(rowOf("行0")).getByText("001")).toBeInTheDocument();
    expect(within(rowOf("行99")).getByText("100")).toBeInTheDocument();
  });

  it("replays from the row body and from the Replay action", () => {
    renderPanel();
    fireEvent.click(bodyOf("先月の売上"));
    expect(seekToSentence).toHaveBeenLastCalledWith(2, { play: true });
    fireEvent.click(within(rowOf("目標を上回る")).getByRole("button", { name: "Replay" }));
    expect(seekToSentence).toHaveBeenLastCalledWith(3, { play: true });
  });

  it("toggles a mark with aria-pressed, PUT then DELETE, disabled while pending", async () => {
    let settle: ((response: Response) => void) | undefined;
    fetchMock().mockImplementationOnce(() => new Promise<Response>((resolve) => { settle = resolve; }));
    renderPanel();
    const bookmark = () => within(rowOf("先月の売上")).getByRole("button", { name: "Bookmark" });
    fireEvent.click(bookmark());
    expect(bookmark()).toHaveAttribute("aria-pressed", "true");
    expect(bookmark()).toBeDisabled();
    expect(within(rowOf("先月の売上")).getByText("Bookmarked")).toBeInTheDocument();
    expect(fetchMock()).toHaveBeenLastCalledWith("/api/sentence-marks", expect.objectContaining({ method: "PUT", body: JSON.stringify({ transcriptLineId: "c", kind: "bookmark" }) }));
    await act(async () => { settle?.(new Response(null, { status: 204 })); });
    expect(bookmark()).toBeEnabled();
    fireEvent.click(bookmark());
    expect(bookmark()).toHaveAttribute("aria-pressed", "false");
    expect(fetchMock()).toHaveBeenLastCalledWith("/api/sentence-marks", expect.objectContaining({ method: "DELETE" }));
    await act(() => Promise.resolve());
  });

  it("shows bootstrap marks as named indicators", () => {
    renderPanel({ marks: [{ lineId: "d", kind: "difficult" }] });
    expect(within(rowOf("目標を上回る")).getByText("Marked difficult")).toBeInTheDocument();
    expect(within(rowOf("目標を上回る")).getByRole("button", { name: "Difficult" })).toHaveAttribute("aria-pressed", "true");
  });

  it("filters by search, keeps original numbers, and Enter seeks the first match", () => {
    renderPanel();
    const search = screen.getByRole("searchbox", { name: "Search transcript" });
    fireEvent.change(search, { target: { value: "target" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(within(rowOf("目標を上回る")).getByText("04")).toBeInTheDocument();
    expect(screen.getByText("1 matching sentence")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Enter" });
    expect(seekToSentence).toHaveBeenCalledWith(3);
  });

  it("says so when nothing matches instead of rendering an empty list", () => {
    renderPanel();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    expect(screen.getByText("No sentences match")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(seekToSentence).not.toHaveBeenCalled();
  });

  it("cycles the 👁 session override without writing a preference", () => {
    renderPanel({ preferences: { readingTranslation: "always" } });
    const eye = screen.getByRole("button", { name: "Translations" });
    expect(eye).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Let us begin")).toBeInTheDocument();
    fireEvent.click(eye);
    expect(eye).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByText("Let us begin")).not.toBeInTheDocument();
    fireEvent.click(eye);
    fireEvent.click(eye);
    expect(fetchMock().mock.calls.some(([url]) => String(url).includes("/api/user/preferences"))).toBe(false);
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  it("covers translations under reveal mode and reveals one line on request", () => {
    renderPanel({ preferences: { readingTranslation: "reveal" } });
    expect(screen.queryByText("Let us begin")).not.toBeInTheDocument();
    fireEvent.click(within(rowOf("会議を始めます")).getByRole("button", { name: "Show translation" }));
    expect(screen.getByText("Let us begin")).toBeInTheDocument();
    expect(screen.queryByText("Thank you for coming")).not.toBeInTheDocument();
  });

  it("reveals readings on one line only, and a second press puts it back", () => {
    renderPanel();
    const toggle = () => within(rowAt(1)).getByRole("button", { name: "Readings for this line" });
    expect(readingsIn(document.body)).toEqual([]);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
    expect(readingsIn(rowAt(1))).toEqual(["かいぎ"]);
    expect(readingsIn(document.body)).toEqual(["かいぎ"]);
    fireEvent.click(toggle());
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
    expect(readingsIn(document.body)).toEqual([]);
    // A line without readings offers no dead control.
    expect(within(rowOf("先月の売上")).queryByRole("button", { name: "Readings for this line" })).not.toBeInTheDocument();
  });

  it("renders readings per the persisted mode in Full Transcript and toggles the view from ⤢", () => {
    renderPanel({ preferences: { readingFurigana: "always" } });
    const expand = screen.getByRole("button", { name: "Full transcript" });
    fireEvent.click(expand);
    expect(session?.[0].view).toBe("full-transcript");
    expect(expand).toHaveAttribute("aria-pressed", "true");
    expect(readingsIn(document.body)).toEqual(["ほんじつ", "かいぎ"]);
    // Under "always" the per-line action hides.
    fireEvent.click(within(rowAt(1)).getByRole("button", { name: "Readings for this line" }));
    expect(readingsIn(document.body)).toEqual(["ほんじつ"]);
  });

  it("offers Back to current after a learner scroll and follows again on click", () => {
    renderPanel();
    fireEvent.wheel(screen.getByTestId("transcript-scroll"));
    fireEvent.click(screen.getByRole("button", { name: "Back to current" }));
    expect(screen.queryByRole("button", { name: "Back to current" })).not.toBeInTheDocument();
  });
});
