import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { toPlainText, toSrt } from "@/lib/shadowing-workspace/transcript-export";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { WorkspaceProviders } from "./workspace-context";
import { REVOKE_DELAY_MS, transcriptFilename, WorkspaceOverflowMenu } from "./workspace-overflow-menu";

const router = vi.hoisted(() => ({ refresh: () => undefined }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
}));

const lines: WorkspaceLine[] = [
  { id: "a", index: 0, startTime: 1.5, endTime: 4, textJp: "本日はお集まりいただき", textTranslation: "Thank you for coming", furigana: null },
  { id: "b", index: 1, startTime: 5, endTime: null, textJp: "会議を始めます", textTranslation: null, furigana: null },
];

function renderMenu({ title = "Ep.729: 会議/始め方?", transcript = { id: "t", lines } as WorkspaceBootstrap["transcript"] } = {}) {
  const bootstrap: WorkspaceBootstrap = {
    userId: "u", video: { id: "v", youtubeVideoId: "yt", title, channelTitle: null, durationSeconds: 12, jlptLevel: null },
    transcript, masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
  };
  return render(<WorkspaceProviders bootstrap={bootstrap}><WorkspaceOverflowMenu /></WorkspaceProviders>);
}

// jsdom's Blob has no text(); FileReader reads it.
const blobText = (blob: Blob) => new Promise<string>((resolve) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.readAsText(blob);
});

let blobs: Blob[] = [];
let clicked: { download: string; href: string }[] = [];

describe("WorkspaceOverflowMenu", () => {
  beforeEach(() => {
    blobs = [];
    clicked = [];
    URL.createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return `blob:${blobs.length}`; });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.getAttribute("href") ?? "" });
    });
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [] })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("downloads exactly toSrt's text as <title>.srt and revokes the URL later, not at once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderMenu();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("button", { name: "Subtitles (.srt)" }));
    expect(clicked).toEqual([{ download: "Ep.729 会議始め方.srt", href: "blob:1" }]);
    expect(await blobText(blobs[0]!)).toBe(toSrt(lines, 12));
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REVOKE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:1");
    // The popover closes after a download.
    expect(screen.queryByRole("button", { name: "Subtitles (.srt)" })).not.toBeInTheDocument();
  });

  it("downloads exactly toPlainText's text as <title>.txt", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    await user.click(await screen.findByRole("button", { name: "Plain text (.txt)" }));
    expect(clicked[0]?.download).toBe("Ep.729 会議始め方.txt");
    expect(await blobText(blobs[0]!)).toBe(toPlainText(lines));
  });

  it("offers Save to playlist but no download without a transcript", async () => {
    const user = userEvent.setup();
    renderMenu({ transcript: null });
    await user.click(screen.getByRole("button", { name: "More actions" }));
    expect(await screen.findByRole("button", { name: "Save to playlist" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Subtitles (.srt)" })).not.toBeInTheDocument();
    expect(screen.queryByText("Download transcript")).not.toBeInTheDocument();
  });

  it("closes only Save to playlist's panel on the first Escape, the popover on the second", async () => {
    const user = userEvent.setup();
    renderMenu();
    await user.click(screen.getByRole("button", { name: "More actions" }));
    const save = await screen.findByRole("button", { name: "Save to playlist" });
    await user.click(save);
    expect(save).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(save).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Subtitles (.srt)" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("button", { name: "Subtitles (.srt)" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "More actions" })).toHaveFocus();
  });
});

describe("transcriptFilename", () => {
  it("strips characters a filesystem refuses and never returns an empty name", () => {
    expect(transcriptFilename('a\\b/c:d*e?f"g<h>i|j', "srt")).toBe("abcdefghij.srt");
    expect(transcriptFilename("  Ep. 1  ...  ", "txt")).toBe("Ep. 1.txt");
    expect(transcriptFilename("???", "srt")).toBe("transcript.srt");
  });
});
