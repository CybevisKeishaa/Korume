import { renderToString } from "react-dom/server";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { render, TestIntlProvider, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resetTabWritesForTests, usePlaybackController, usePositionStore, usePreferences } from "./workspace-context";
import { ShadowingWorkspaceShell, workspaceGridTemplateColumns } from "./workspace-shell";
import { TranscriptPanel } from "./transcript-panel";

const router = { refresh: vi.fn() };
let pathname = "/en/shadowing/video-1";
let searchParams = new URLSearchParams("line=line-1");

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
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
});
