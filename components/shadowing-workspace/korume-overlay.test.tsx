import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resetTabWritesForTests, usePositionStore } from "./workspace-context";
import { ShadowingWorkspaceShell } from "./workspace-shell";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
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
    expect(screen.getByRole("button", { name: "Open full chat" })).toBeDisabled();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Message Korume" }));
    expect(korumeCalls()).toEqual([]);
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
