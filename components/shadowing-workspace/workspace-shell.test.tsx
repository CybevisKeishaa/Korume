import { renderToString } from "react-dom/server";
import { render, TestIntlProvider } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { usePositionStore } from "./workspace-context";
import { ShadowingWorkspaceShell } from "./workspace-shell";

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
};

let observedStore: ReturnType<typeof usePositionStore> | undefined;

function StoreProbe(): null {
  observedStore = usePositionStore();
  return null;
}

describe("ShadowingWorkspaceShell", () => {
  let yt: YouTubeStubHandle;
  afterEach(() => yt.restore());
  beforeEach(() => {
    yt = installYouTubeStub();
    sessionStorage.clear();
    observedStore = undefined;
    pathname = "/en/shadowing/video-1";
    searchParams = new URLSearchParams("line=line-1");
  });

  it("starts at a known requested line and leaves structural slots free of route data", () => {
    const linkedBootstrap = { ...bootstrap, transcript: { id: "transcript-1", lines: [{ id: "line-1", index: 0, startTime: 12, endTime: 15, textJp: "one", textTranslation: null, furigana: null }] } };
    const { getByTestId } = render(
      <ShadowingWorkspaceShell bootstrap={linkedBootstrap}><StoreProbe /><section aria-label="Shadowing practice" /></ShadowingWorkspaceShell>,
    );

    expect(getByTestId("shadowing-workspace")).toHaveClass("grid");
    expect(getByTestId("workspace-header-slot")).toBeEmptyDOMElement();
    expect(getByTestId("workspace-player-slot")).not.toHaveAttribute("data-line-id");
    expect(observedStore?.get()).toBe(12);
    expect(getByTestId("workspace-divider-slot")).toBeEmptyDOMElement();
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
});
