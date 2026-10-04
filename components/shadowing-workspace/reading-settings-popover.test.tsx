import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { usePlayerWiring } from "./playback-root";
import { resetTabWritesForTests } from "./workspace-context";
import { ShadowingWorkspaceShell } from "./workspace-shell";

const router = vi.hoisted(() => ({ refresh: () => undefined }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
  // The header renders the mode bar (Shadowing · Summary) since 2026-10-04; it reads the locale-less path.
  usePathname: () => "/shadowing/video-1",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1", useSearchParams: () => new URLSearchParams() }));

let wiring: ReturnType<typeof usePlayerWiring> | undefined;
function WiringProbe(): null {
  wiring = usePlayerWiring();
  return null;
}

function renderShell(preferences: Partial<UserPreferences> = {}) {
  const bootstrap: WorkspaceBootstrap = {
    userId: "user-1",
    video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
    transcript: { id: "transcript-1", lines: [{ id: "line-1", index: 0, startTime: 1, endTime: 4, textJp: "一つ目", textTranslation: "first", furigana: null }] },
    masteryMap: {}, preferences: { ...DEFAULT_PREFERENCES, ...preferences }, resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
  };
  return render(<ShadowingWorkspaceShell bootstrap={bootstrap}><WiringProbe /></ShadowingWorkspaceShell>);
}

const patches = (fetchMock: ReturnType<typeof vi.fn>) =>
  fetchMock.mock.calls.filter(([url, init]) => url === "/api/user/preferences" && init?.method === "PATCH").map(([, init]) => JSON.parse(String(init.body)));

describe("Reading Settings and Study Environment (spec §6)", () => {
  let yt: YouTubeStubHandle;
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    yt = installYouTubeStub();
    sessionStorage.clear();
    resetTabWritesForTests();
    wiring = undefined;
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    yt.restore();
    vi.unstubAllGlobals();
  });

  it("puts every reading setting and the atmosphere on the workspace root", () => {
    renderShell({ readingColorPreset: "sepia", readingTextSize: "xl", readingLineHeight: "airy", readingWidth: "wide", readingEmphasis: "strong", readingJpFont: "mincho", studyAtmosphere: "rainy_day" });
    const root = screen.getByTestId("shadowing-workspace");
    expect(root).toHaveAttribute("data-reading-preset", "sepia");
    expect(root).toHaveAttribute("data-reading-size", "xl");
    expect(root).toHaveAttribute("data-reading-line-height", "airy");
    expect(root).toHaveAttribute("data-reading-width", "wide");
    expect(root).toHaveAttribute("data-reading-emphasis", "strong");
    expect(root).toHaveAttribute("data-reading-font", "mincho");
    expect(root).toHaveAttribute("data-atmosphere", "rainy_day");
  });

  it("writes one setting with its exact key and value, and the root follows at once", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
    const panel = await screen.findByRole("dialog", { name: "Reading settings" });
    fireEvent.click(within(within(panel).getByRole("radiogroup", { name: "Font size" })).getByRole("radio", { name: "L" }));
    expect(screen.getByTestId("shadowing-workspace")).toHaveAttribute("data-reading-size", "l");
    await waitFor(() => expect(patches(fetchMock)).toEqual([{ readingTextSize: "l" }]));

    fireEvent.click(within(panel).getByRole("switch", { name: "Pause after each sentence" }));
    await waitFor(() => expect(patches(fetchMock)).toEqual([{ readingTextSize: "l" }, { playbackAutoPause: true }]));
  });

  it("applies a new default speed, loop count and Auto Pause to the running session", async () => {
    const user = userEvent.setup();
    renderShell();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    expect(wiring?.rate).toBe(1);
    await user.click(screen.getByRole("button", { name: "Reading settings" }));
    await user.click(screen.getByRole("combobox", { name: "Default speed" }));
    await user.click(await screen.findByRole("option", { name: "0.75×" }));
    await waitFor(() => expect(wiring?.rate).toBe(0.75));
    expect(yt.players[0]?.getPlaybackRate()).toBe(0.75);

    const panel = screen.getByRole("dialog", { name: "Reading settings" });
    fireEvent.click(within(within(panel).getByRole("radiogroup", { name: "Plays per sentence" })).getByRole("radio", { name: "3×" }));
    fireEvent.click(within(panel).getByRole("switch", { name: "Pause after each sentence" }));
    expect(wiring?.loop).toEqual({ enabled: true, count: 3, autoPause: true });
    await waitFor(() => expect(patches(fetchMock)).toEqual([{ playbackDefaultRate: 0.75 }, { playbackLoopCount: 3 }, { playbackAutoPause: true }]));
  });

  it("chooses a Study Environment and persists it as study_atmosphere", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Study Environment" }));
    const panel = await screen.findByRole("dialog", { name: "Study Environment" });
    expect(within(panel).getAllByRole("radio")).toHaveLength(7);
    fireEvent.click(within(panel).getByRole("radio", { name: "Rainy Day" }));
    expect(screen.getByTestId("shadowing-workspace")).toHaveAttribute("data-atmosphere", "rainy_day");
    expect(screen.getByTestId("atmosphere-layer")).toHaveAttribute("aria-hidden", "true");
    expect(document.querySelectorAll(".atmosphere-particles > span")).toHaveLength(12);
    await waitFor(() => expect(patches(fetchMock)).toEqual([{ studyAtmosphere: "rainy_day" }]));
  });

  it("renders no particles at all under Reduce Motion, while the glow stays", () => {
    renderShell({ studyAtmosphere: "rainy_day", reduceMotion: true });
    expect(screen.getByTestId("atmosphere-layer")).toBeInTheDocument();
    expect(document.querySelector(".atmosphere-particles")).toBeNull();
  });

  it("opens the shortcut hints on load only when the preference asks, without taking focus", async () => {
    const hidden = renderShell();
    expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull();
    hidden.unmount();

    renderShell({ showShortcutHints: true });
    const sheet = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    expect(sheet).toHaveTextContent("Space");
    expect(sheet.contains(document.activeElement)).toBe(false);
    act(() => { fireEvent.keyDown(document.body, { key: "Escape" }); });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).toBeNull());
    // Closing hands focus to nobody: on the ⌨ trigger, the next Space would reopen the sheet, not play (review I-1).
    expect(document.activeElement).not.toBe(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(document.activeElement).toBe(document.body);
  });

  it("keeps the learner's session choices when a playback-default write fails and rolls back", async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 500 }));
    renderShell();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Reading settings" }));
    const panel = await screen.findByRole("dialog", { name: "Reading settings" });
    fireEvent.click(within(within(panel).getByRole("radiogroup", { name: "Plays per sentence" })).getByRole("radio", { name: "3×" }));
    expect(wiring?.loop.count).toBe(3);
    // The learner then turns the Sentence loop off for this session while the write is still failing.
    act(() => wiring?.toggleLoop());
    await waitFor(() => expect(within(within(panel).getByRole("radiogroup", { name: "Plays per sentence" })).getByRole("radio", { name: "1×" })).toHaveAttribute("aria-checked", "true"));
    // The preference rolled back to 1×; the session keeps the learner's own last choice (off at 3×).
    expect(wiring?.loop).toEqual({ enabled: false, count: 3, autoPause: false });
  });
});
