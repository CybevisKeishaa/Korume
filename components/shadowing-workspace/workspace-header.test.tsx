import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { usePositionStore, useSession, WorkspaceProviders } from "./workspace-context";
import { WorkspaceHeader } from "./workspace-header";

const router = vi.hoisted(() => ({ refresh: () => undefined }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
  usePathname: () => "/shadowing/v",
}));

const lines: WorkspaceLine[] = Array.from({ length: 282 }, (_, index) => ({
  id: `l${index}`, index, startTime: 10 + index * 5, endTime: 10 + index * 5 + 4, textJp: `行${index}`, textTranslation: null, furigana: null,
}));

let store: ReturnType<typeof usePositionStore> | undefined;
let session: ReturnType<typeof useSession> | undefined;
function Probe(): null {
  store = usePositionStore();
  session = useSession();
  return null;
}

function renderHeader(video: Partial<WorkspaceBootstrap["video"]> = {}, { lessonBookmarked = false } = {}) {
  const bootstrap: WorkspaceBootstrap = {
    userId: "u",
    video: { id: "v", youtubeVideoId: "yt", title: "Ep.729 会議の始め方", channelTitle: "Nihongo Pod", durationSeconds: 1380, jlptLevel: "N3", ...video },
    transcript: { id: "t", lines }, masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
  };
  return render(<WorkspaceProviders bootstrap={bootstrap}><WorkspaceHeader /><Probe /></WorkspaceProviders>);
}

describe("WorkspaceHeader", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
  });

  it("shows the title as the page heading, the JLPT badge, and a Back link to the Hub", () => {
    renderHeader();
    expect(screen.getByRole("heading", { level: 1, name: "Ep.729 会議の始め方" })).toBeInTheDocument();
    expect(screen.getByText("JLPT N3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Shadowing Hub" })).toHaveAttribute("href", "/shadowing");
  });

  it("builds the source line from channel, JLPT and minutes", () => {
    renderHeader();
    expect(screen.getByText("Nihongo Pod · N3 · 23 min")).toBeInTheDocument();
  });

  it("falls back to YouTube and drops a missing JLPT or duration, never a placeholder", () => {
    const noChannel = renderHeader({ channelTitle: null });
    expect(screen.getByText("YouTube · N3 · 23 min")).toBeInTheDocument();
    noChannel.unmount();
    const bare = renderHeader({ channelTitle: null, jlptLevel: null, durationSeconds: null });
    expect(screen.getByText("YouTube")).toBeInTheDocument();
    expect(screen.queryByText(/JLPT/)).not.toBeInTheDocument();
    bare.unmount();
    renderHeader({ jlptLevel: null });
    expect(screen.getByText("Nihongo Pod · 23 min")).toBeInTheDocument();
  });

  it("counts sentences: a dash before the first line, then index + 1 up to the last", () => {
    renderHeader();
    act(() => store?.set(0));
    expect(screen.getByText("Sentence — / 282")).toBeInTheDocument();
    act(() => store?.set(10));
    expect(screen.getByText("Sentence 1 / 282")).toBeInTheDocument();
    act(() => store?.set(10 + 281 * 5 + 1));
    expect(screen.getByText("Sentence 282 / 282")).toBeInTheDocument();
  });

  it("toggles Focus Mode as a session view with aria-pressed", () => {
    renderHeader();
    const focus = screen.getByRole("button", { name: "Focus Mode" });
    expect(focus).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(focus);
    expect(session?.[0].view).toBe("focus");
    expect(focus).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(focus);
    expect(session?.[0].view).toBe("normal");
  });

  it("bookmarks the lesson with PUT then DELETE, aria-disabled (still focusable) while pending", async () => {
    let settle: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => { settle = resolve; }));
    renderHeader();
    const bookmark = () => screen.getByRole("button", { name: "Bookmark lesson" });
    expect(bookmark()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bookmark());
    expect(bookmark()).toHaveAttribute("aria-pressed", "true");
    expect(bookmark()).toHaveAttribute("aria-disabled", "true");
    expect(bookmark()).toBeEnabled();
    fireEvent.click(bookmark());
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenLastCalledWith("/api/videos/v/bookmark", expect.objectContaining({ method: "PUT" }));
    await act(async () => { settle?.(new Response(null, { status: 204 })); });
    expect(bookmark()).not.toHaveAttribute("aria-disabled");
    fireEvent.click(bookmark());
    expect(bookmark()).toHaveAttribute("aria-pressed", "false");
    expect(fetch).toHaveBeenLastCalledWith("/api/videos/v/bookmark", expect.objectContaining({ method: "DELETE" }));
    await act(() => Promise.resolve());
  });

  it("renders no mode bar while only Shadowing is complete", () => {
    renderHeader();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
