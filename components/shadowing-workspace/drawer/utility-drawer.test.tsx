import { act, fireEvent, screen, within } from "@testing-library/react";
import { render } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { resetTabWritesForTests, usePositionStore, useSession } from "../workspace-context";
import { ShadowingWorkspaceShell } from "../workspace-shell";
import { TranscriptPanel } from "../transcript-panel";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1", useSearchParams: () => new URLSearchParams() }));

const LINES = Array.from({ length: 12 }, (_, i) => ({
  id: `line-${i + 1}`, index: i, startTime: i * 2, endTime: i * 2 + 2, textJp: `文${i + 1}です。`, textTranslation: null, furigana: null,
}));
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
  transcript: { id: "transcript-1", lines: LINES },
  masteryMap: {},
  preferences: DEFAULT_PREFERENCES,
  resume: null,
  lessonBookmarked: false,
  marks: [],
};

let store: ReturnType<typeof usePositionStore> | undefined;
let sessionDispatch: ReturnType<typeof useSession>[1] | undefined;
function Probe(): null {
  store = usePositionStore();
  sessionDispatch = useSession()[1];
  return null;
}

let fetchMock: ReturnType<typeof vi.fn>;
let yt: YouTubeStubHandle;
beforeEach(() => {
  yt = installYouTubeStub();
  fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  sessionStorage.clear();
  resetTabWritesForTests();
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function renderShell() {
  return render(<ShadowingWorkspaceShell bootstrap={bootstrap}><Probe /><TranscriptPanel /></ShadowingWorkspaceShell>);
}
const drawer = () => screen.getByRole("region", { name: "Study tools" });
const tab = (name: string) => within(drawer()).getByRole("tab", { name });
const level = () => drawer().getAttribute("data-drawer-level");
const separator = () => screen.getByRole("separator", { name: "Resize study tools" });
const at = (seconds: number) => act(() => { store?.set(seconds); });

describe("UtilityDrawer in the workspace", () => {
  it("is a bottom row spanning every column, collapsed at first, with five tabs", () => {
    renderShell();
    const slot = screen.getByTestId("workspace-drawer-slot");
    expect(slot).toHaveClass("col-span-3", "row-start-3");
    expect(screen.getByTestId("shadowing-workspace").style.gridTemplateRows).toBe("auto minmax(0, 1fr) var(--drawer-collapsed-height)");
    expect(level()).toBe("collapsed");
    expect(within(drawer()).getAllByRole("tab").map((node) => node.textContent)).toEqual(["Vocabulary", "Grammar", "Mining", "Notes", "AI"]);
    expect(within(drawer()).queryByRole("tabpanel")).toBeNull();
  });

  it("selecting a tab while collapsed opens peek; arrow keys rove the tablist", () => {
    renderShell();
    fireEvent.click(tab("Grammar"));
    expect(level()).toBe("peek");
    expect(tab("Grammar")).toHaveAttribute("aria-selected", "true");
    expect(within(drawer()).getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tab("Grammar").id);
    fireEvent.keyDown(tab("Grammar"), { key: "ArrowRight" });
    expect(tab("Mining")).toHaveAttribute("aria-selected", "true");
    expect(tab("Mining")).toHaveFocus();
    fireEvent.keyDown(tab("Mining"), { key: "End" });
    expect(tab("AI")).toHaveFocus();
    expect(within(drawer()).getAllByRole("tab").filter((node) => node.tabIndex === 0)).toEqual([tab("AI")]);
  });

  it("keeps the player the same DOM node through every level", () => {
    renderShell();
    const player = document.querySelector("[data-workspace-player]");
    expect(player).not.toBeNull();
    for (const key of ["ArrowUp", "ArrowUp", "ArrowUp", "Home", "End", "ArrowDown"]) {
      fireEvent.keyDown(separator(), { key });
      expect(document.querySelector("[data-workspace-player]")).toBe(player);
    }
    expect(level()).toBe("expanded");
    expect(screen.getByTestId("shadowing-workspace").style.gridTemplateRows).toBe("auto minmax(0, 1fr) 70dvh");
    fireEvent.keyDown(separator(), { key: "End" });
    expect(screen.getByTestId("shadowing-workspace").style.gridTemplateRows).toBe("auto 0 minmax(0, 1fr)");
  });

  it("a row action pins that line, and Follow returns to the current sentence", () => {
    renderShell();
    at(3);
    fireEvent.click(within(screen.getAllByRole("listitem")[6] as HTMLElement).getByRole("button", { name: "Grammar" }));
    expect(level()).toBe("peek");
    expect(tab("Grammar")).toHaveAttribute("aria-selected", "true");
    expect(drawer()).toHaveTextContent("Sentence 7 / 12· Pinned");
    // Review Focus 2: playback moves on, the pinned target does not.
    for (let second = 4; second < 24; second += 2) at(second);
    expect(drawer()).toHaveTextContent("Sentence 7 / 12");
    expect(within(drawer()).getByRole("tabpanel")).toHaveTextContent("文7です。");
    fireEvent.click(within(drawer()).getByRole("button", { name: "Follow current sentence" }));
    expect(drawer()).toHaveTextContent("Current sentence · 12 / 12");
  });

  it("Live Sentence ✨ pins the current line and opens AI", () => {
    renderShell();
    at(5);
    fireEvent.click(screen.getByRole("button", { name: "Explain with AI" }));
    expect(tab("AI")).toHaveAttribute("aria-selected", "true");
    expect(drawer()).toHaveTextContent("Sentence 3 / 12· Pinned");
  });

  it("Focus Mode hides the drawer and leaving it restores tab, level and target", () => {
    renderShell();
    at(1);
    fireEvent.click(within(screen.getAllByRole("listitem")[4] as HTMLElement).getByRole("button", { name: "Note" }));
    fireEvent.keyDown(separator(), { key: "ArrowUp" });
    act(() => sessionDispatch?.({ type: "toggle-view", view: "focus" }));
    expect(screen.queryByRole("region", { name: "Study tools" })).toBeNull();
    expect(screen.getByTestId("shadowing-workspace").style.gridTemplateRows).toBe("auto minmax(0, 1fr)");
    act(() => sessionDispatch?.({ type: "toggle-view", view: "focus" }));
    expect(level()).toBe("expanded");
    expect(tab("Notes")).toHaveAttribute("aria-selected", "true");
    expect(drawer()).toHaveTextContent("Sentence 5 / 12· Pinned");
  });

  it("Escape collapses an open drawer before it leaves a view", () => {
    renderShell();
    fireEvent.click(tab("Vocabulary"));
    act(() => sessionDispatch?.({ type: "toggle-view", view: "full-transcript" }));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(level()).toBe("collapsed");
    expect(screen.getByTestId("shadowing-workspace")).toHaveClass("grid-cols-1"); // still Full Transcript
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.getByTestId("shadowing-workspace")).not.toHaveClass("grid-cols-1");
  });

  it("follows ten sentence changes on the AI tab without a single request (R11)", () => {
    renderShell();
    fireEvent.click(tab("AI"));
    fetchMock.mockClear();
    for (let second = 1; second <= 21; second += 2) at(second);
    expect(drawer()).toHaveTextContent("Current sentence · 11 / 12");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("DrawerSeparator", () => {
  it("is a horizontal separator valued by level; keys step and jump", () => {
    renderShell();
    expect(separator()).toHaveAttribute("aria-orientation", "horizontal");
    expect(separator()).toHaveAttribute("aria-valuemin", "0");
    expect(separator()).toHaveAttribute("aria-valuemax", "3");
    expect(separator()).toHaveAttribute("aria-valuenow", "0");
    fireEvent.keyDown(separator(), { key: "ArrowUp" });
    expect(separator()).toHaveAttribute("aria-valuenow", "1");
    expect(separator()).toHaveAttribute("aria-valuetext", "Peek");
    fireEvent.keyDown(separator(), { key: "End" });
    expect(separator()).toHaveAttribute("aria-valuenow", "3");
    fireEvent.keyDown(separator(), { key: "ArrowUp" });
    expect(separator()).toHaveAttribute("aria-valuenow", "3");
    fireEvent.keyDown(separator(), { key: "ArrowDown" });
    expect(separator()).toHaveAttribute("aria-valuenow", "2");
    fireEvent.keyDown(separator(), { key: "Home" });
    expect(separator()).toHaveAttribute("aria-valuenow", "0");
  });

  it("snaps a drag to the nearest level", () => {
    renderShell();
    // A 529 px workspace (the owner's viewport) with a 48 px header; tokens measure 36 and 160.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const rect = (height: number, bottom = height) => ({ x: 0, y: 0, top: bottom - height, left: 0, right: 1280, width: 1280, height, bottom, toJSON: () => ({}) }) as DOMRect;
      if (this.dataset.testid === "shadowing-workspace") return rect(529);
      if (this.dataset.testid === "workspace-header-slot") return rect(48);
      if (this.style.height.includes("--drawer-collapsed-height")) return rect(36);
      if (this.style.height.includes("--drawer-peek-min")) return rect(160);
      return rect(0);
    });
    const handle = separator();
    handle.setPointerCapture = vi.fn();
    handle.hasPointerCapture = () => true;
    handle.releasePointerCapture = vi.fn();
    // jsdom has no PointerEvent; a MouseEvent of the pointer type carries clientY (as the divider test does).
    const dragTo = (clientY: number) => {
      fireEvent(handle, new MouseEvent("pointerdown", { bubbles: true, clientY }));
      fireEvent(handle, new MouseEvent("pointerup", { bubbles: true, clientY }));
    };
    dragTo(529 - 380); // 380 px tall: nearest 70 % (370)
    expect(level()).toBe("expanded");
    dragTo(529 - 200); // nearest 40 % (211.6)
    expect(level()).toBe("peek");
    dragTo(529 - 470); // nearest everything below the header (481)
    expect(level()).toBe("maximized");
    dragTo(520);
    expect(level()).toBe("collapsed");
  });
});
