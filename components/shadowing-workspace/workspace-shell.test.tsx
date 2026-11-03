import { useState } from "react";
import { renderToString } from "react-dom/server";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { render, TestIntlProvider, waitFor } from "@/test/render";
import { installYouTubeStub, YT_PLAYER_STATE, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resetTabWritesForTests, usePlaybackController, usePositionStore, usePreferences, useSession } from "./workspace-context";
import { ShadowingWorkspaceShell, workspaceGridTemplateColumns } from "./workspace-shell";
import { TranscriptPanel } from "./transcript-panel";
import { usePracticeStats } from "./practice/practice-stats-context";
import { usePronunciationAttempts } from "./practice/pronunciation-attempts-context";
import { useListeningReveal } from "./practice/listening-reveal-context";
const presence = vi.hoisted(() => vi.fn());
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: presence }));

const router = { refresh: vi.fn() };
let pathname = "/en/shadowing/video-1";
let searchParams = new URLSearchParams("line=line-1");

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
  // The header renders the mode bar (Shadowing · Summary) since 2026-10-04; it reads the locale-less path.
  usePathname: () => pathname.replace(/^\/en/, ""),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => searchParams,
}));

const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
  transcript: { id: "transcript-1", lines: [] },
  masteryMap: {},
  preferences: DEFAULT_PREFERENCES,
  resume: null,
  lessonBookmarked: false,
  marks: [],
  notes: { lessonNote: null, sentenceNotes: [] },
};

let observedStore: ReturnType<typeof usePositionStore> | undefined;
let observedController: ReturnType<typeof usePlaybackController> | undefined;
let setPreference: ReturnType<typeof usePreferences>["setPreference"] | undefined;

function StoreProbe(): null {
  observedStore = usePositionStore();
  observedController = usePlaybackController();
  return null;
}

function PreferenceProbe(): null {
  setPreference = usePreferences().setPreference;
  return null;
}

describe("ShadowingWorkspaceShell", () => {
  let yt: YouTubeStubHandle;
  afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    yt = installYouTubeStub();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    sessionStorage.clear();
    resetTabWritesForTests();
    observedStore = undefined;
    observedController = undefined;
    setPreference = undefined;
    pathname = "/en/shadowing/video-1";
    searchParams = new URLSearchParams("line=line-1");
  });

  it("starts at a known requested line, renders the header, and leaves structural slots free of route data", () => {
    const linkedBootstrap = { ...bootstrap, transcript: { id: "transcript-1", lines: [{ id: "line-1", index: 0, startTime: 12, endTime: 15, textJp: "one", textTranslation: null, furigana: null }] } };
    const { getByRole, getByTestId } = render(
      <ShadowingWorkspaceShell bootstrap={linkedBootstrap}><StoreProbe /><section aria-label="Shadowing practice" /></ShadowingWorkspaceShell>,
    );

    expect(getByTestId("shadowing-workspace")).toHaveClass("grid");
    expect(within(getByTestId("workspace-header-slot")).getByRole("heading", { level: 1, name: "Episode 1" })).toBeInTheDocument();
    expect(getByTestId("workspace-player-slot")).not.toHaveAttribute("data-line-id");
    expect(observedStore?.get()).toBe(12);
    expect(getByRole("separator", { name: "Resize workspace panes" })).toHaveAttribute("aria-orientation", "vertical");
  });

  it("swaps the live sentence for practice stats while retaining the player, controller and provider", async () => {
    const view = render(<ShadowingWorkspaceShell bootstrap={bootstrap}><StoreProbe /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const store = observedStore;
    const controller = observedController;
    const player = yt.players[0];
    expect(screen.getByRole("region", { name: "Live sentence" })).toBeInTheDocument();
    for (const mode of ["pronunciation", "listening"]) {
      // Listening has its strip once an exercise is chosen (the picker has none).
      pathname = `/en/shadowing/video-1/${mode}`;
      searchParams = new URLSearchParams("line=line-1&format=dictation");
      view.rerender(<ShadowingWorkspaceShell bootstrap={bootstrap}><StoreProbe /></ShadowingWorkspaceShell>);
      expect(screen.getByTestId("lesson-stat-strip")).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Live sentence" })).not.toBeInTheDocument();
      expect(observedStore).toBe(store);
      expect(observedController).toBe(controller);
      expect(yt.players[0]).toBe(player);
      expect(yt.players).toHaveLength(1);
    }
    pathname = "/en/shadowing/video-1";
    view.rerender(<ShadowingWorkspaceShell bootstrap={bootstrap}><StoreProbe /></ShadowingWorkspaceShell>);
    expect(screen.getByRole("region", { name: "Live sentence" })).toBeInTheDocument();
    expect(observedController).toBe(controller);
  });

  it("shares stats with route children without remounting them or the player across modes", async () => {
    let mounts = 0;
    function StatsProbe() {
      const { stats } = usePracticeStats();
      const [identity] = useState(() => ++mounts);
      return <output data-testid="stats-probe">{identity}:{stats?.mean ?? "none"}</output>;
    }
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("practice-stats")
      ? Response.json({ data: { lineCount: 0, scoredLines: 0, mean: 84, lines: {} } })
      : new Response(null, { status: 200 }))));
    const view = render(<ShadowingWorkspaceShell bootstrap={bootstrap}><StatsProbe /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    expect(screen.getByTestId("stats-probe")).toHaveTextContent("1:none");
    pathname = "/en/shadowing/video-1/pronunciation";
    view.rerender(<ShadowingWorkspaceShell bootstrap={bootstrap}><StatsProbe /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(screen.getByTestId("stats-probe")).toHaveTextContent("1:84"));
    pathname = "/en/shadowing/video-1";
    view.rerender(<ShadowingWorkspaceShell bootstrap={bootstrap}><StatsProbe /></ShadowingWorkspaceShell>);
    expect(screen.getByTestId("stats-probe")).toHaveTextContent("1:none");
    expect(mounts).toBe(1);
    expect(yt.players).toHaveLength(1);
  });
  it("uses a definite divider track and flex factors that cannot leave an empty grid gap", () => {
    const template = workspaceGridTemplateColumns(0.7735);
    const factors = [...template.matchAll(/([\d.]+)fr/g)].map(([, factor]) => Number(factor));

    expect(template).not.toMatch(/\bauto\b/);
    expect(template).toContain("var(--workspace-divider-width)");
    expect(factors).toHaveLength(2);
    expect(factors.every((factor) => factor >= 1)).toBe(true);
  });

  it("applies the end-of-video guard with the last line's end when the lesson has no stored duration (re-review M3)", () => {
    searchParams = new URLSearchParams();
    const lines = [
      { id: "a", index: 0, startTime: 0, endTime: 20, textJp: "一", textTranslation: null, furigana: null },
      { id: "b", index: 1, startTime: 20, endTime: 60, textJp: "二", textTranslation: null, furigana: null },
    ];
    // Saved at the very end (an ENDED write) of a lesson whose duration was never stored.
    const ended = { ...bootstrap, video: { ...bootstrap.video, durationSeconds: null }, transcript: { id: "t", lines }, resume: { position: 59.5, lastWatchedAt: "2026-10-01T00:00:00.000Z" } };
    render(<ShadowingWorkspaceShell bootstrap={ended}><StoreProbe /></ShadowingWorkspaceShell>);
    expect(observedStore?.get()).toBe(0);
  });

  it("ignores an unknown requested line and resumes the matching session record", () => {
    searchParams = new URLSearchParams("line=other-video-line");
    sessionStorage.setItem("shadowing-resume:user-1:video-1", JSON.stringify({ userId: "user-1", videoId: "video-1", position: 12, savedAt: 1, syncedServerAt: null }));
    const resumedBootstrap = { ...bootstrap, transcript: { id: "transcript-1", lines: [{ id: "line-1", index: 0, startTime: 12, endTime: 15, textJp: "one", textTranslation: null, furigana: null }] } };
    render(<ShadowingWorkspaceShell bootstrap={resumedBootstrap}><StoreProbe /></ShadowingWorkspaceShell>);
    expect(observedStore?.get()).toBe(12);
  });

  it("server-renders from server facts only, then settles the session position once after mount", () => {
    searchParams = new URLSearchParams();
    sessionStorage.setItem("shadowing-resume:user-1:video-1", JSON.stringify({ userId: "user-1", videoId: "video-1", position: 17, savedAt: 1, syncedServerAt: null }));
    const lines = [
      { id: "line-1", index: 0, startTime: 12, endTime: 15, textJp: "one", textTranslation: null, furigana: null },
      { id: "line-2", index: 1, startTime: 16, endTime: 19, textJp: "two", textTranslation: null, furigana: null },
    ];
    const resumed = { ...bootstrap, transcript: { id: "transcript-1", lines }, resume: { position: 13, lastWatchedAt: null } };
    function Position(): JSX.Element { return <output>{usePositionStore().get()}</output>; }

    // No effects run in a server render: the markup must come from the server resume (12), never sessionStorage.
    expect(renderToString(<TestIntlProvider><ShadowingWorkspaceShell bootstrap={resumed}><Position /></ShadowingWorkspaceShell></TestIntlProvider>)).toContain("<output>12</output>");

    const view = render(<ShadowingWorkspaceShell bootstrap={resumed}><StoreProbe /></ShadowingWorkspaceShell>);
    expect(observedStore?.get()).toBe(16);
    // A refreshed bootstrap with a newer server resume does not move the already-decided start.
    view.rerender(<ShadowingWorkspaceShell bootstrap={{ ...resumed, resume: { position: 21, lastWatchedAt: "2026-10-01T12:00:00Z" } }}><StoreProbe /></ShadowingWorkspaceShell>);
    expect(observedStore?.get()).toBe(16);
  });

  it("uses this tab's newer resume behavior only after mount", async () => {
    searchParams = new URLSearchParams();
    const stale = {
      ...bootstrap,
      video: { ...bootstrap.video, durationSeconds: 120 },
      transcript: { id: "transcript-1", lines: [{ id: "line-1", index: 0, startTime: 10, endTime: 20, textJp: "one", textTranslation: null, furigana: null }] },
      preferences: { ...DEFAULT_PREFERENCES, resumeBehavior: "resume" as const }, resume: { position: 13, lastWatchedAt: null },
    };
    const first = render(<ShadowingWorkspaceShell bootstrap={stale}><PreferenceProbe /></ShadowingWorkspaceShell>);
    act(() => setPreference?.("resumeBehavior", "restart"));
    await act(async () => { await Promise.resolve(); });
    first.unmount();

    render(<ShadowingWorkspaceShell bootstrap={stale}><StoreProbe /></ShadowingWorkspaceShell>);
    expect(observedStore?.get()).toBe(0);
  });

  it("seeds progress persistence with the newer session server clock", () => {
    searchParams = new URLSearchParams();
    sessionStorage.setItem("shadowing-resume:user-1:video-1", JSON.stringify({ userId: "user-1", videoId: "video-1", position: 2, savedAt: 1, syncedServerAt: "2026-10-01T10:00:00.000Z" }));
    const stale = { ...bootstrap, resume: { position: 1, lastWatchedAt: "2026-10-01T09:00:00.000Z" } };
    render(<ShadowingWorkspaceShell bootstrap={stale}><StoreProbe /></ShadowingWorkspaceShell>);
    act(() => observedStore?.set(3));
    expect(JSON.parse(sessionStorage.getItem("shadowing-resume:user-1:video-1") ?? "{}").syncedServerAt).toBe("2026-10-01T10:00:00.000Z");
  });

  it("does not remount providers when the rendered child changes", () => {
    const first = render(
      <ShadowingWorkspaceShell bootstrap={bootstrap}><StoreProbe /></ShadowingWorkspaceShell>,
    );
    const initialStore = observedStore;

    pathname = "/en/shadowing/video-1/focus";
    // A different child and a fresh bootstrap object (what router.refresh() delivers) must not remount.
    first.rerender(
      <ShadowingWorkspaceShell bootstrap={{ ...bootstrap }}><StoreProbe /><p>focus body</p></ShadowingWorkspaceShell>,
    );

    expect(observedStore).toBe(initialStore);
  });

  it("retains an unsaved WAV through mode changes and Back/Forward-like child replacement with one player", async () => {
    let attempts: ReturnType<typeof usePronunciationAttempts> | undefined;
    function AttemptProbe() { attempts = usePronunciationAttempts(); return <StoreProbe />; }
    const lesson = { ...bootstrap, transcript: { id: "t", lines: [
      { id: "L1", index: 0, startTime: 0, endTime: 3, textJp: "one", textTranslation: null, furigana: null },
      { id: "L2", index: 1, startTime: 3, endTime: 6, textJp: "two", textTranslation: null, furigana: null },
    ] } };
    pathname = "/en/shadowing/video-1/pronunciation";
    const view = render(<ShadowingWorkspaceShell bootstrap={lesson}><AttemptProbe /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0];
    if (!player || !attempts || !observedController) throw new Error("workspace not ready");
    const controller = observedController;
    const dispatchAttempt = attempts.dispatch;
    const original = new Blob(["take"]);
    const wav = new Blob(["wav"], { type: "audio/wav" });
    act(() => dispatchAttempt({ type: "start", lineId: "L1" }));
    const play = vi.spyOn(player, "playVideo");
    act(() => controller.play());
    expect(play).not.toHaveBeenCalled();
    act(() => {
      dispatchAttempt({ type: "recorded", lineId: "L1", original });
      dispatchAttempt({ type: "converted", lineId: "L1", wav, pitch: null });
      dispatchAttempt({ type: "saving", lineId: "L1" });
      dispatchAttempt({ type: "save-failed", lineId: "L1" });
    });
    // Route children really disappear on Back; the lesson shell and store must stay mounted.
    pathname = "/en/shadowing/video-1";
    view.rerender(<ShadowingWorkspaceShell bootstrap={{ ...lesson }}><p>Shadowing route</p></ShadowingWorkspaceShell>);
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(observedStore?.get()).toBe(0);
    pathname = "/en/shadowing/video-1/listening";
    view.rerender(<ShadowingWorkspaceShell bootstrap={lesson}><p>Listening route</p></ShadowingWorkspaceShell>);
    pathname = "/en/shadowing/video-1/pronunciation";
    view.rerender(<ShadowingWorkspaceShell bootstrap={lesson}><AttemptProbe /></ShadowingWorkspaceShell>);
    expect(attempts.dispatch).toBe(dispatchAttempt);
    expect(attempts.attempts.L1?.phase).toBe("save-failed");
    expect(attempts.attempts.L1?.original).toBe(original);
    expect(attempts.attempts.L1?.wav).toBe(wav);
    expect(yt.players).toHaveLength(1);
    expect(yt.players[0]).toBe(player);
    expect(observedController).toBe(controller);
    // Entering Listening, then Pronunciation, each played the current sentence once (spec 2026-10-31 D5).
    expect(play).toHaveBeenCalledTimes(2);
    const seek = vi.spyOn(player, "seekTo");
    act(() => controller.nextSentence());
    expect(seek).not.toHaveBeenCalled();
    act(() => controller.play());
    expect(play).toHaveBeenCalledTimes(3);
    act(() => dispatchAttempt({ type: "saved", lineId: "L1", sessionId: "S1", signedUrl: "u" }));
    act(() => controller.nextSentence());
    expect(seek).toHaveBeenLastCalledWith(3, true);
    act(() => dispatchAttempt({ type: "start", lineId: "L2" }));
    const setLock = vi.spyOn(controller, "setLock");
    view.unmount();
    expect(setLock).toHaveBeenLastCalledWith({ navigation: false, play: false });
  });

  it("tracks shadowing with the video id and the player's playing state", async () => {
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><section /></ShadowingWorkspaceShell>);
    expect(presence).toHaveBeenCalledWith({ surface: "shadowing", contextId: "video-1", mediaPlaying: false });
    await waitFor(() => expect(yt.players).toHaveLength(1));
    act(() => yt.players[0]!.triggerStateChange(YT_PLAYER_STATE.PLAYING));
    expect(presence).toHaveBeenLastCalledWith({ surface: "shadowing", contextId: "video-1", mediaPlaying: true });
  });

  it("turns the header Focus Mode control into a focused player view without remounting the YouTube player", async () => {
    render(
      <ShadowingWorkspaceShell bootstrap={bootstrap}>
        <TranscriptPanel />
      </ShadowingWorkspaceShell>,
    );
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Focus Mode" }));

    expect(screen.getByRole("button", { name: "Focus Mode" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("heading", { name: "Transcript" })).not.toBeInTheDocument();
    expect(yt.players).toHaveLength(1);
  });

  it("keeps global shortcuts active in focus view and reflects L on the shared Sentence pill", async () => {
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><StoreProbe /><TranscriptPanel /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Focus Mode" }));

    const loop = screen.getByRole("button", { name: "Sentence loop" });
    fireEvent.keyDown(document.body, { key: "l" });
    expect(loop).toHaveAttribute("aria-pressed", "true");
    expect(observedController?.loopConfig()).toMatchObject({ enabled: true, count: 0 });
    fireEvent.keyDown(document.body, { key: "l" });
    expect(loop).toHaveAttribute("aria-pressed", "false");
    expect(observedController?.loopConfig()).toMatchObject({ enabled: false, count: 0 });
    fireEvent.keyDown(document.body, { key: "l" });
    fireEvent.keyDown(document.body, { key: " " });
    const player = yt.players[0];
    expect(player).toBeDefined();
    expect(player?.getPlayerState()).toBe(1);
    fireEvent.keyDown(screen.getByTestId("shadowing-workspace"), { key: " " });
    expect(player?.getPlayerState()).toBe(2);
  });

  it.each(["/en/shadowing/video-1/listening", "/en/shadowing/video-1/pronunciation"])("practice has no loop: no Sentence pill, no Loop button, and L does nothing at %s (spec 2026-10-31 D3)", async (path) => {
    pathname = path;
    searchParams = new URLSearchParams("line=line-1&format=dictation");
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><StoreProbe /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    // Positive control: the player bar really rendered its other controls.
    expect(screen.getByRole("button", { name: "Hide subtitles" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sentence loop" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Loop" })).toBeNull();
    const before = observedController?.loopConfig();
    fireEvent.keyDown(document.body, { key: "l" });
    expect(observedController?.loopConfig()).toEqual(before);
    expect(observedController?.loopConfig().enabled).toBe(false);
  });

  it("lets the overflow popover consume Escape in focus view instead of also exiting the view", async () => {
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Focus Mode" }));
    const more = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(more).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Focus Mode" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses one player wrapper as a bottom-right PiP while the full transcript takes the workspace", async () => {
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Full transcript" }));

    expect(screen.queryByRole("heading", { name: "Live sentence" })).not.toBeInTheDocument();
    expect(screen.getByTestId("workspace-player-slot")).toHaveClass("fixed");
    expect(screen.getByTestId("workspace-player-slot")).toHaveClass("w-[min(calc(100%-var(--space-2xl)),var(--workspace-pip-width))]");
    expect(screen.getByTestId("transcript-scroll")).toHaveClass("pb-[--workspace-pip-clearance]");
    expect(screen.getByRole("heading", { name: "Transcript" })).toBeInTheDocument();
    expect(yt.players).toHaveLength(1);
  });

  it("keeps one player through normal, focus, full-transcript, and normal again", async () => {
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const focus = screen.getByRole("button", { name: "Focus Mode" });
    fireEvent.click(focus);
    expect(yt.players).toHaveLength(1);
    fireEvent.click(focus);
    fireEvent.click(screen.getByRole("button", { name: "Full transcript" }));
    expect(yt.players).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Full transcript" }));
    expect(yt.players).toHaveLength(1);
    expect(screen.getByRole("separator", { name: "Resize workspace panes" })).toBeInTheDocument();
  });

  it("keeps the YouTube player mounted through a divider drag and refreshed settings", async () => {
    const view = render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const divider = screen.getByRole("separator", { name: "Resize workspace panes" });
    // jsdom has no layout: a 1000px workspace whose token minimums (the divider's probe nodes) are 300px.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const width = this.style.width.startsWith("var(") ? 300 : 1000;
      return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: width, width, height: 0, toJSON: () => ({}) };
    });
    try {
      Object.assign(divider, { setPointerCapture: vi.fn(), hasPointerCapture: () => true });
      fireEvent(divider, new MouseEvent("pointerdown", { bubbles: true, clientX: 100 }));
      // The drag really dispatched a split (clamped to the 300px left minimum), not a no-op.
      expect(screen.getByRole("separator", { name: "Resize workspace panes" })).toHaveAttribute("aria-valuenow", "30");
      expect(yt.players).toHaveLength(1);
    } finally {
      vi.restoreAllMocks();
    }
    view.rerender(<ShadowingWorkspaceShell bootstrap={{ ...bootstrap, preferences: { ...bootstrap.preferences, playbackDefaultRate: 0.75 } }}><TranscriptPanel /></ShadowingWorkspaceShell>);

    expect(yt.players).toHaveLength(1);
  });

  it("fullscreens the player container, not its Live Sentence sibling", async () => {
    const originalEnabled = Object.getOwnPropertyDescriptor(document, "fullscreenEnabled");
    const originalRequest = HTMLElement.prototype.requestFullscreen;
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    const requestFullscreen = vi.fn(function (this: HTMLElement) { return Promise.resolve(); });
    HTMLElement.prototype.requestFullscreen = requestFullscreen;
    try {
    render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
    await waitFor(() => expect(screen.getByRole("button", { name: "Player fullscreen" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Workspace fullscreen" }));
    fireEvent.click(screen.getByRole("button", { name: "Player fullscreen" }));

    expect(requestFullscreen.mock.instances[0]).toBe(screen.getByTestId("shadowing-workspace"));
    const target = requestFullscreen.mock.instances[1] as unknown as HTMLElement;
    expect(target).toBe(screen.getByRole("region", { name: "Player" }));
    expect(target.contains(screen.getByRole("region", { name: "Live sentence" }))).toBe(false);
    } finally {
      HTMLElement.prototype.requestFullscreen = originalRequest;
      if (originalEnabled) Object.defineProperty(document, "fullscreenEnabled", originalEnabled);
      else delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    }
  });

  it("leaves Escape to the browser while fullscreen, so one press exits fullscreen and not also the view", async () => {
    const originalEnabled = Object.getOwnPropertyDescriptor(document, "fullscreenEnabled");
    const originalElement = Object.getOwnPropertyDescriptor(document, "fullscreenElement");
    const originalRequest = HTMLElement.prototype.requestFullscreen;
    let fullscreenElement: Element | null = null;
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", { configurable: true, get: () => fullscreenElement });
    HTMLElement.prototype.requestFullscreen = vi.fn(function (this: HTMLElement) {
      // eslint-disable-next-line @typescript-eslint/no-this-alias -- the shim records which element went fullscreen
      fullscreenElement = this;
      document.dispatchEvent(new Event("fullscreenchange"));
      return Promise.resolve();
    });
    try {
      render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
      const focus = screen.getByRole("button", { name: "Focus Mode" });
      fireEvent.click(focus);
      const fullscreen = await screen.findByRole("button", { name: "Workspace fullscreen" });
      fireEvent.click(fullscreen);
      expect(fullscreen).toHaveAttribute("aria-pressed", "true");

      // The browser consumes this Escape to leave fullscreen; the shell must not also exit Focus.
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(focus).toHaveAttribute("aria-pressed", "true");
      act(() => {
        fullscreenElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      });
      expect(fullscreen).toHaveAttribute("aria-pressed", "false");
      expect(document.activeElement).toBe(fullscreen);

      // Out of fullscreen, the next Escape exits the view.
      fireEvent.keyDown(document.body, { key: "Escape" });
      expect(focus).toHaveAttribute("aria-pressed", "false");
    } finally {
      HTMLElement.prototype.requestFullscreen = originalRequest;
      if (originalElement) Object.defineProperty(document, "fullscreenElement", originalElement);
      else delete (document as { fullscreenElement?: Element | null }).fullscreenElement;
      if (originalEnabled) Object.defineProperty(document, "fullscreenEnabled", originalEnabled);
      else delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    }
  });

  it("hides both fullscreen controls when the browser does not support fullscreen", async () => {
    const originalEnabled = Object.getOwnPropertyDescriptor(document, "fullscreenEnabled");
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: false });
    try {
      render(<ShadowingWorkspaceShell bootstrap={bootstrap}><TranscriptPanel /></ShadowingWorkspaceShell>);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Workspace fullscreen" })).toBeNull());
      expect(screen.queryByRole("button", { name: "Player fullscreen" })).toBeNull();
    } finally {
      if (originalEnabled) Object.defineProperty(document, "fullscreenEnabled", originalEnabled);
      else delete (document as { fullscreenEnabled?: boolean }).fullscreenEnabled;
    }
  });

  describe("Listening (spec §3.2, §5.8, §5.9)", () => {
    const lesson: WorkspaceBootstrap = { ...bootstrap, transcript: { id: "t", lines: [
      { id: "line-1", index: 0, startTime: 12, endTime: 15, textJp: "一つ目", textTranslation: null, furigana: null },
      { id: "line-2", index: 1, startTime: 15, endTime: 18, textJp: "二つ目", textTranslation: null, furigana: null },
    ] } };
    let reveal: ReturnType<typeof useListeningReveal> | undefined;
    function RevealProbe() { reveal = useListeningReveal(); return <StoreProbe />; }
    const shell = (value = lesson) => <ShadowingWorkspaceShell bootstrap={value}><RevealProbe /></ShadowingWorkspaceShell>;
    /** The server render runs no effect, so it is the first frame exactly as React commits it (B1's first-frame test). */
    function firstFrame(path: string): HTMLElement {
      pathname = path;
      const host = document.createElement("div");
      host.innerHTML = renderToString(<TestIntlProvider>{shell()}</TestIntlProvider>);
      // Positive control: the workspace and its player really rendered, so an absence below means something.
      expect(host.querySelector("[data-testid='workspace-player-surface']")).not.toBeNull();
      return host;
    }
    const hideSubtitles = (host: HTMLElement) => [...host.querySelectorAll("button")].find((button) => button.getAttribute("aria-label") === "Hide subtitles");

    it("renders no subtitle, drawer or Korume in the first render, with CC still on and the video shown (spec §3.2)", () => {
      const host = firstFrame("/en/shadowing/video-1/listening");
      expect(host.querySelector("[data-testid='workspace-subtitle']")).toBeNull();
      expect(host.querySelector("[data-testid='workspace-drawer-slot']")).toBeNull();
      expect(host.querySelector("[data-testid='korume-mascot']")).toBeNull();
      expect(host.querySelector("[data-listen-dock]")).toBeNull();
      expect(hideSubtitles(host)).toHaveAttribute("aria-pressed", "true");
    });

    it.each(["/en/shadowing/video-1", "/en/shadowing/video-1/pronunciation"])("still shows the subtitle, drawer and Korume at %s", (path) => {
      const host = firstFrame(path);
      expect(host.querySelector("[data-testid='workspace-subtitle']")).toHaveTextContent("一つ目");
      expect(host.querySelector("[data-testid='workspace-drawer-slot']")).not.toBeNull();
      expect(host.querySelector("[data-testid='korume-mascot']")).not.toBeNull();
    });

    it("shows the subtitle only for the current line's checked attempt, and drops it on a line change", async () => {
      pathname = "/en/shadowing/video-1/listening";
      render(shell());
      await waitFor(() => expect(yt.players).toHaveLength(1));
      expect(screen.getByRole("button", { name: "Hide subtitles" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
      expect(screen.queryByTestId("korume-mascot")).toBeNull();
      expect(screen.queryByTestId("workspace-drawer-slot")).toBeNull();
      act(() => reveal?.markChecked(reveal.attempt));
      expect(screen.getByTestId("workspace-subtitle")).toHaveTextContent("一つ目");
      act(() => observedStore?.set(16));
      expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    });

    it("conceals the answer again on re-entering Listening on the same line and exercise (R28)", async () => {
      const frames: boolean[] = [];
      /** Records every render, so the first frame of re-entry is checked, not only the settled one. */
      function FrameProbe() {
        reveal = useListeningReveal();
        frames.push(reveal.answerVisible);
        return <StoreProbe />;
      }
      const tree = () => <ShadowingWorkspaceShell bootstrap={lesson}><FrameProbe /></ShadowingWorkspaceShell>;
      pathname = "/en/shadowing/video-1/listening";
      searchParams = new URLSearchParams("line=line-1&format=dictation");
      const view = render(tree());
      await waitFor(() => expect(yt.players).toHaveLength(1));
      const current = required(reveal);
      act(() => current.markChecked(current.attempt));
      // Positive control: the answer really was shown before leaving.
      expect(screen.getByTestId("workspace-subtitle")).toHaveTextContent("一つ目");
      pathname = "/en/shadowing/video-1/pronunciation";
      view.rerender(tree());
      pathname = "/en/shadowing/video-1/listening";
      const from = frames.length;
      view.rerender(tree());
      const reentry = frames.slice(from);
      expect(reentry.length).toBeGreaterThan(0);
      expect(reentry).toEqual(reentry.map(() => false));
      expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    });

    it("docks the player only in Listening: Ẩn video is kept across modes, and other modes keep the split", async () => {
      pathname = "/en/shadowing/video-1/listening";
      searchParams = new URLSearchParams("line=line-1&format=dictation");
      const view = render(shell());
      await waitFor(() => expect(yt.players).toHaveLength(1));
      act(() => required(reveal).setListenOnly(true));
      expect(document.querySelector("[data-listen-dock]")).not.toBeNull();
      expect(screen.queryByRole("separator", { name: "Resize workspace panes" })).toBeNull();
      pathname = "/en/shadowing/video-1";
      view.rerender(shell());
      expect(document.querySelector("[data-listen-dock]")).toBeNull();
      expect(screen.getByRole("separator", { name: "Resize workspace panes" })).toBeInTheDocument();
      pathname = "/en/shadowing/video-1/listening";
      view.rerender(shell());
      expect(document.querySelector("[data-listen-dock]")).not.toBeNull();
      expect(yt.players).toHaveLength(1);
    });

    it("turning Ẩn video off restores the split ratio; the dock is the workspace's last row, in flow", async () => {
      let dispatch: ReturnType<typeof useSession>[1] | undefined;
      function SplitProbe() { [, dispatch] = useSession(); return <RevealProbe />; }
      pathname = "/en/shadowing/video-1/listening";
      searchParams = new URLSearchParams("line=line-1&format=dictation");
      render(<ShadowingWorkspaceShell bootstrap={lesson}><SplitProbe /></ShadowingWorkspaceShell>);
      await waitFor(() => expect(yt.players).toHaveLength(1));
      act(() => required(dispatch)({ type: "set-split", ratio: 0.3 }));
      const workspace = screen.getByTestId("shadowing-workspace");
      expect(workspace.style.gridTemplateColumns).toBe(workspaceGridTemplateColumns(0.3));
      act(() => required(reveal).setListenOnly(true));
      // The practice column takes the full width; the pane is the last grid row, never fixed over the panel.
      expect(workspace.style.gridTemplateColumns).toBe("");
      expect(workspace).toHaveClass("grid-cols-1");
      expect(workspace.style.gridTemplateRows).toBe("auto minmax(0, 1fr) auto");
      const pane = screen.getByTestId("workspace-player-slot");
      expect(pane).toHaveClass("row-start-3");
      expect(pane.className).not.toMatch(/(^|\s)(fixed|absolute|sticky)(\s|$)/);
      expect(screen.queryByTestId("lesson-stat-strip")).toBeNull();
      act(() => required(reveal).setListenOnly(false));
      expect(workspace.style.gridTemplateColumns).toBe(workspaceGridTemplateColumns(0.3));
      expect(screen.getByRole("separator", { name: "Resize workspace panes" })).toHaveAttribute("aria-valuenow", "30");
      expect(screen.getByTestId("lesson-stat-strip")).toBeInTheDocument();
    });

    it("the strip reads the stats of the URL's exercise; the picker has no strip and reads none (T7-a)", async () => {
      const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(url.includes("practice-stats")
        ? Response.json({ data: { lineCount: 2, scoredLines: 1, mean: url.endsWith("dictation") ? 72 : 91, lines: {} } })
        : new Response(null, { status: 200 })));
      vi.stubGlobal("fetch", fetchMock);
      const statsCalls = () => fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("practice-stats"));
      const scored = () => required(screen.getByTestId("lesson-stat-strip").querySelector<HTMLElement>("[data-stat='completed']"));
      const average = () => required(screen.getByTestId("lesson-stat-strip").querySelector<HTMLElement>("[data-stat='accuracy']"));
      pathname = "/en/shadowing/video-1/listening";
      searchParams = new URLSearchParams("line=line-1&format=typing");
      const view = render(shell());
      // A legacy `typing` link reads Chép chính tả's stats.
      expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", "dictation");
      await waitFor(() => expect(within(average()).getByRole("definition")).toHaveTextContent("72%"));
      expect(within(scored()).getByRole("definition")).toHaveTextContent("1/2");
      expect(statsCalls()).toEqual(["/api/shadowing/video-1/practice-stats?mode=dictation"]);
      searchParams = new URLSearchParams("line=line-1&format=cloze");
      view.rerender(shell());
      expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", "cloze");
      await waitFor(() => expect(within(average()).getByRole("definition")).toHaveTextContent("91%"));
      expect(statsCalls()).toEqual(["/api/shadowing/video-1/practice-stats?mode=dictation", "/api/shadowing/video-1/practice-stats?mode=cloze"]);
      for (const query of ["line=line-1", "line=line-1&format=nope"]) {
        searchParams = new URLSearchParams(query);
        view.rerender(shell());
        expect(screen.queryByTestId("lesson-stat-strip")).toBeNull();
        expect(screen.queryByRole("region", { name: "Live sentence" })).not.toBeInTheDocument();
      }
      expect(statsCalls()).toHaveLength(2);
    });
  });
});
