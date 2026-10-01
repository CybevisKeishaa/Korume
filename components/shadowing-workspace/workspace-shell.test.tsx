import { render } from "@/test/render";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    observedStore = undefined;
    pathname = "/en/shadowing/video-1";
    searchParams = new URLSearchParams("line=line-1");
  });

  it("renders structural slots and keeps the requested line available to the player slot", () => {
    const { getByTestId } = render(
      <ShadowingWorkspaceShell bootstrap={bootstrap}><section aria-label="Shadowing practice" /></ShadowingWorkspaceShell>,
    );

    expect(getByTestId("shadowing-workspace")).toHaveClass("grid");
    expect(getByTestId("workspace-header-slot")).toBeEmptyDOMElement();
    expect(getByTestId("workspace-player-slot")).toHaveAttribute("data-line-id", "line-1");
    expect(getByTestId("workspace-divider-slot")).toBeEmptyDOMElement();
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
