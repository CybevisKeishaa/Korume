import { act, createEvent, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resetTabWritesForTests, usePositionStore } from "./workspace-context";
import { ShadowingWorkspaceShell } from "./workspace-shell";

// jsdom resolves no CSS variable, so the sheet's token widths come from here (design px at density 1).
vi.mock("./workspace-divider", async (importOriginal) => {
  const px: Record<string, number> = { "--space-md": 16, "--korume-min-w": 340, "--korume-min-h": 380, "--korume-breakpoint": 720, "--korume-small-w": 400, "--korume-small-h": 560, "--korume-large-w": 1040, "--korume-large-h": 680 };
  return { ...(await importOriginal<typeof import("./workspace-divider")>()), tokenPixels: (_root: HTMLElement, token: string) => px[token] ?? 0 };
});

const push = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn(), push }),
  // The header renders the mode bar (Shadowing · Summary) since 2026-10-04; it reads the locale-less path.
  usePathname: () => "/shadowing/video-1",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1", useSearchParams: () => new URLSearchParams("line=line-1") }));

const line = (i: number) => ({ id: `line-${i}`, index: i - 1, startTime: (i - 1) * 10, endTime: i * 10, textJp: `今日は${i}番目の文です`, textTranslation: null, furigana: null });
const bootstrap = (companionEnabled = true): WorkspaceBootstrap => ({
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 40, jlptLevel: "N3" },
  transcript: { id: "transcript-1", lines: [line(1), line(2), line(3)] },
  masteryMap: {},
  preferences: { ...DEFAULT_PREFERENCES, companionEnabled },
  resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
});

let store: ReturnType<typeof usePositionStore> | undefined;
function StoreProbe(): null { store = usePositionStore(); return null; }

let fetchMock: ReturnType<typeof vi.fn>;
const korumeCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/korume"));
const mascot = () => screen.queryByRole("button", { name: "Ask Korume" });
const sheet = () => screen.queryByRole("dialog", { name: "Korume" });
const mount = (enabled = true) => render(<ShadowingWorkspaceShell bootstrap={bootstrap(enabled)}><StoreProbe /><div>transcript</div></ShadowingWorkspaceShell>);

describe("Ask Korume in the Shadowing workspace (spec §6.2)", () => {
  let yt: YouTubeStubHandle;
  beforeEach(() => {
    yt = installYouTubeStub();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    sessionStorage.clear();
    resetTabWritesForTests();
  });
  afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

  it("shows nothing, binds no k and sends nothing when Korume is off", () => {
    mount(false);
    expect(mascot()).toBeNull();
    fireEvent.keyDown(document.body, { key: "k" });
    expect(sheet()).toBeNull();
    expect(korumeCalls()).toEqual([]);
  });

  it("opens on the mascot anchored to the active line, without any request until a send", async () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    const dialog = sheet() as HTMLElement;
    expect(dialog).toHaveAttribute("aria-modal", "false");
    expect(dialog).toHaveTextContent("「今日は1番目の文です」 · 00:00");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message Korume" }));
    expect(korumeCalls()).toEqual([]);
  });

  it("opens on the first line during an intro, before any line has started", () => {
    const intro = { ...bootstrap(), transcript: { id: "transcript-1", lines: [{ ...line(1), startTime: 5 }, line(2)] } };
    render(<ShadowingWorkspaceShell bootstrap={intro}><StoreProbe /><div>transcript</div></ShadowingWorkspaceShell>);
    act(() => { store?.set(0); });
    fireEvent.click(mascot() as HTMLElement);
    expect(sheet()).toHaveTextContent("「今日は1番目の文です」 · 00:05");
  });

  it("Open full chat before any send creates the anchored thread, then goes to it", async () => {
    push.mockClear();
    mount();
    fireEvent.click(mascot() as HTMLElement);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Open full chat" })); });
    const [url, init] = korumeCalls()[0] as [string, RequestInit];
    expect(url).toBe("/api/korume/threads");
    const body = JSON.parse(String(init.body)) as { threadId: string; videoId: string; lineId: string };
    expect(body).toMatchObject({ videoId: "video-1", lineId: "line-1" });
    expect(push).toHaveBeenCalledWith(`/korume/chat?thread=${body.threadId}`);
  });

  it("toggles to large and Escape returns to small before closing", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    expect(sheet()).toHaveAttribute("data-layout", "small");
    expect(screen.queryByRole("complementary", { name: "Learning context" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Enlarge Korume" }));
    expect(sheet()).toHaveAttribute("data-layout", "large");
    const context = screen.getByRole("complementary", { name: "Learning context" });
    expect(context).toHaveTextContent("今日は1番目の文です");
    expect(context).toHaveTextContent("Episode 1");
    expect(sheet()).toHaveTextContent("A quiet place to understand Japanese");
    expect(screen.queryByTestId("korume-backdrop")).toBeNull();
    fireEvent.keyDown(sheet() as HTMLElement, { key: "Escape" });
    expect(sheet()).toHaveAttribute("data-layout", "small");
    expect(sheet()).toHaveTextContent("Japanese Knowledge");
    fireEvent.keyDown(sheet() as HTMLElement, { key: "Escape" });
    expect(sheet()).toBeNull();
  });

  it("a double-click on the header toggles, a double-click on a header button does not", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    fireEvent.doubleClick(screen.getByRole("heading", { name: "Korume" }));
    expect(sheet()).toHaveAttribute("data-layout", "large");
    fireEvent.doubleClick(screen.getByRole("button", { name: "All conversations" }));
    expect(sheet()).toHaveAttribute("data-layout", "large");
    fireEvent.doubleClick(screen.getByRole("heading", { name: "Korume" }));
    expect(sheet()).toHaveAttribute("data-layout", "small");
  });

  it("closing the sheet mid-drag restores text selection", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    const bar = (sheet() as HTMLElement).querySelector("[data-korume-drag]") as HTMLElement;
    // jsdom has no PointerEvent, so the fields the sheet reads are set on a plain event.
    const down = createEvent.pointerDown(bar);
    Object.defineProperties(down, { button: { value: 0 }, pointerId: { value: 1 }, clientX: { value: 10 }, clientY: { value: 10 } });
    fireEvent(bar, down);
    expect(document.body.style.userSelect).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Close Korume" }));
    expect(document.body.style.userSelect).toBe("");
  });

  it("keeps the thread when the layout toggles", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    const box = screen.getByRole("textbox", { name: "Message Korume" });
    fireEvent.change(box, { target: { value: "draft text" } });
    fireEvent.click(screen.getByRole("button", { name: "Enlarge Korume" }));
    expect(screen.getByRole("textbox", { name: "Message Korume" })).toBe(box);
    expect(box).toHaveValue("draft text");
  });

  it("opens with k outside editable fields, and k typed in the composer is just a k", () => {
    mount();
    fireEvent.keyDown(document.body, { key: "k" });
    const box = screen.getByRole("textbox", { name: "Message Korume" });
    fireEvent.keyDown(box, { key: "k" });
    expect(sheet()).toBeInTheDocument();
  });

  it("keeps the captured line when playback moves on and offers a new draft for the current line", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    act(() => { store?.set(21); });
    expect(sheet()).toHaveTextContent("「今日は1番目の文です」");
    fireEvent.click(screen.getByRole("button", { name: "Ask about the current line" }));
    expect(sheet()).toHaveTextContent("「今日は3番目の文です」");
    expect(screen.queryByRole("button", { name: "Ask about the current line" })).toBeNull();
  });

  it("closes on Escape, returns focus to the mascot, and reopens to the same draft", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    act(() => { store?.set(21); });
    fireEvent.keyDown(sheet() as HTMLElement, { key: "Escape" });
    expect(sheet()).toBeNull();
    expect(document.activeElement).toBe(mascot());
    fireEvent.click(mascot() as HTMLElement);
    expect(sheet()).toHaveTextContent("「今日は1番目の文です」");
  });

  it("closes from an Escape pressed outside the sheet, before anything else in the workspace", () => {
    mount();
    fireEvent.click(mascot() as HTMLElement);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(sheet()).toBeNull();
  });

  it("is hidden in Focus view, where k does nothing, not even later", () => {
    mount();
    fireEvent.keyDown(document.body, { key: "f" });
    expect(mascot()).toBeNull();
    fireEvent.keyDown(document.body, { key: "k" });
    fireEvent.keyDown(document.body, { key: "f" });
    expect(mascot()).toBeInTheDocument();
    expect(sheet()).toBeNull();
  });
});
