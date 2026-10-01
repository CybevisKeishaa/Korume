import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import type { PlaybackController } from "./use-playback-controller";
import { LiveSentence } from "./live-sentence";
import { usePositionStore, useSession, WorkspaceProviders } from "./workspace-context";

vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const lines: WorkspaceLine[] = [
  {
    id: "a", index: 0, startTime: 0, endTime: 3, textJp: "目標を上回る", textTranslation: "Vượt mục tiêu",
    furigana: [{ text: "目標", reading: "もくひょう" }, { text: "を" }, { text: "上回", reading: "うわまわ" }, { text: "る" }],
  },
  {
    id: "b", index: 1, startTime: 5, endTime: 8, textJp: "日本語", textTranslation: "Câu hai",
    furigana: [{ text: "日本語", reading: "にほんご" }],
  },
];

let store: ReturnType<typeof usePositionStore> | undefined;
let dispatchView: ReturnType<typeof useSession>[1] | undefined;
function Probe(): null {
  store = usePositionStore();
  dispatchView = useSession()[1];
  return null;
}

const controller = { pause: vi.fn() } as unknown as PlaybackController;

function renderLive(preferences: Partial<UserPreferences> = {}, masteryMap: Record<string, number> = {}, at = 1) {
  const bootstrap: WorkspaceBootstrap = {
    userId: "u", video: { id: "v", youtubeVideoId: "yt", title: "T", channelTitle: null, durationSeconds: 20, jlptLevel: null },
    transcript: { id: "t", lines }, masteryMap, preferences: { ...DEFAULT_PREFERENCES, ...preferences },
    resume: null, lessonBookmarked: false, marks: [],
  };
  const view = render(<WorkspaceProviders bootstrap={bootstrap} controller={controller}><LiveSentence /><Probe /></WorkspaceProviders>);
  act(() => store?.set(at));
  return view;
}

const readings = () => Array.from(document.querySelectorAll("rt")).map((rt) => rt.textContent);

describe("LiveSentence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("flows every ruby segment inline inside one paragraph", () => {
    renderLive({ readingFurigana: "always" });
    const paragraph = document.querySelector("p[lang='ja']")!;
    expect(paragraph.textContent).toBe("目標もくひょうを上回うわまわる");
    expect(paragraph.querySelectorAll("ruby")).toHaveLength(2);
    expect(paragraph.querySelectorAll("p, div")).toHaveLength(0);
  });

  it("applies the furigana modes, adaptive hiding only a mastered word", () => {
    const always = renderLive({ readingFurigana: "always" });
    expect(readings()).toEqual(["もくひょう", "うわまわ"]);
    always.unmount();
    const hidden = renderLive({ readingFurigana: "hidden" });
    expect(readings()).toEqual([]);
    hidden.unmount();
    renderLive({ readingFurigana: "adaptive" }, { 目標: 5 });
    expect(readings()).toEqual(["うわまわ"]);
  });

  it("lets the per-line session override beat the persisted mode for that line only", () => {
    renderLive({ readingFurigana: "hidden" });
    act(() => dispatchView?.({ type: "toggle-line-furigana", lineId: "a", shownByMode: false }));
    expect(readings()).toEqual(["もくひょう", "うわまわ"]);
    act(() => store?.set(6));
    // Line b has readings too: it still follows the persisted mode.
    expect(readings()).toEqual([]);
  });

  it("hides every reading under always and reveals mastered readings under adaptive", () => {
    const always = renderLive({ readingFurigana: "always" });
    act(() => dispatchView?.({ type: "toggle-line-furigana", lineId: "a", shownByMode: true }));
    expect(readings()).toEqual([]);
    always.unmount();
    renderLive({ readingFurigana: "adaptive" }, { 目標: 5 });
    act(() => dispatchView?.({ type: "toggle-line-furigana", lineId: "a", shownByMode: false }));
    expect(readings()).toEqual(["もくひょう", "うわまわ"]);
  });

  it("keeps the card shape and shows no line before the first sentence", () => {
    renderLive({ readingTranslation: "reveal" }, {}, -1);
    expect(screen.getByRole("region", { name: "Live sentence" })).toBeInTheDocument();
    expect(document.querySelector("p[lang='ja']")).toBeNull();
    expect(document.querySelector("section p[aria-hidden='true'].invisible")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Show translation" })).toBeNull();
  });

  it("shows, hides or reveals the translation per the persisted mode, reveal remembered per line", () => {
    const always = renderLive({ readingTranslation: "always" });
    expect(screen.getByText("Vượt mục tiêu")).toBeInTheDocument();
    always.unmount();
    const hidden = renderLive({ readingTranslation: "hidden" });
    expect(screen.queryByText("Vượt mục tiêu")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show translation" })).toBeNull();
    hidden.unmount();
    renderLive({ readingTranslation: "reveal" });
    fireEvent.click(screen.getByRole("button", { name: "Show translation" }));
    expect(screen.getByText("Vượt mục tiêu")).toBeInTheDocument();
    act(() => store?.set(6));
    expect(screen.queryByText("Câu hai")).toBeNull();
    expect(screen.getByRole("button", { name: "Show translation" })).toBeInTheDocument();
  });

  it("hides only the Japanese, keeps the translation, never pauses or writes", () => {
    renderLive({ readingTranslation: "always" });
    const toggle = screen.getByRole("button", { name: "Hide Japanese" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    const japanese = document.querySelector("p[lang='ja']");
    expect(japanese).toHaveClass("invisible");
    expect(japanese).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Vượt mục tiêu")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Japanese" })).toHaveAttribute("aria-pressed", "true");
    expect(controller.pause).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("softens the card in the gap after a spoken line", () => {
    renderLive();
    const card = screen.getByRole("region", { name: "Live sentence" });
    expect(card).toHaveAttribute("data-spoken", "true");
    act(() => store?.set(4));
    expect(card).toHaveAttribute("data-spoken", "false");
    expect(card).not.toHaveClass("opacity-70");
    expect(document.querySelector("p[lang='ja']")).toHaveClass("text-muted-foreground");
  });
});
