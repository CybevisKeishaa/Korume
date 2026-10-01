import { fireEvent, render, screen } from "@/test/render";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { WorkspaceProviders } from "./workspace-context";
import { ShadowingModeBody } from "./shadowing-mode-body";

const refresh = vi.fn();

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => ({ refresh }),
}));

const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
  transcript: null,
  masteryMap: {},
  preferences: DEFAULT_PREFERENCES,
  resume: null,
  lessonBookmarked: false,
  marks: [],
};

describe("ShadowingModeBody", () => {
  it("offers recovery when the transcript is unavailable", () => {
    render(
      <WorkspaceProviders bootstrap={bootstrap}><ShadowingModeBody /></WorkspaceProviders>,
    );

    expect(screen.getByRole("heading", { name: "This lesson is temporarily missing its transcript." })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Back to Shadowing Hub" })).toHaveAttribute("href", "/shadowing");
  });

  it("renders the replacement region when a transcript is present", () => {
    render(
      <WorkspaceProviders bootstrap={{ ...bootstrap, transcript: { id: "transcript-1", lines: [] } }}>
        <ShadowingModeBody />
      </WorkspaceProviders>,
    );

    expect(screen.getByRole("region", { name: "Shadowing practice" })).toBeEmptyDOMElement();
  });
});
