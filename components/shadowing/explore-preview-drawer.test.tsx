import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ExplorePreviewDrawer } from "./explore-preview-drawer";

const LESSON = {
  id: "a0000000-0000-0000-0000-000000000001",
  youtubeVideoId: "lesson-yt-id",
  title: "A real catalogue lesson",
  durationSeconds: 420,
  thumbnailUrl: null,
  jlptLevelEstimate: "N4",
  transcriptPreview: ["一つ目です。", "二つ目です。", "三つ目です。"],
  lineCount: 20,
  wordCount: 14,
};

afterEach(() => vi.unstubAllGlobals());

describe("ExplorePreviewDrawer", () => {
  it("renders persisted transcript preview and adds the selected lesson through the protected endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { alreadyAdded: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ExplorePreviewDrawer lesson={LESSON} onClose={vi.fn()} labels={{
      close: "Close preview",
      start: "Start lesson",
      add: "Add to My Lessons",
      added: "Added to My Lessons",
      adding: "Adding lesson",
      addFailed: "Could not add lesson",
      transcript: "Transcript preview",
      transcriptUnavailable: "Transcript preview unavailable",
      durationTemplate: "{count} min",
      metadata: { jlpt: "JLPT", duration: "Duration", vocabulary: "Vocabulary", sentences: "Sentences" },
    }} />);

    expect(screen.getByRole("dialog")).toHaveTextContent("一つ目です。");
    expect(screen.getByRole("link", { name: "Start lesson" })).toHaveAttribute("href", "/en/shadowing/a0000000-0000-0000-0000-000000000001");

    await user.click(screen.getByRole("button", { name: "Add to My Lessons" }));

    expect(fetchMock).toHaveBeenCalledWith(`/api/videos/${LESSON.id}/library`, { method: "POST" });
    expect(screen.getByRole("button", { name: "Added to My Lessons" })).toBeDisabled();
  });

  it("does not fabricate transcript lines when the lesson has none", () => {
    render(<ExplorePreviewDrawer lesson={{ ...LESSON, transcriptPreview: [] }} onClose={vi.fn()} labels={{
      close: "Close preview",
      start: "Start lesson",
      add: "Add to My Lessons",
      added: "Added to My Lessons",
      adding: "Adding lesson",
      addFailed: "Could not add lesson",
      transcript: "Transcript preview",
      transcriptUnavailable: "Transcript preview unavailable",
      durationTemplate: "{count} min",
      metadata: { jlpt: "JLPT", duration: "Duration", vocabulary: "Vocabulary", sentences: "Sentences" },
    }} />);

    expect(screen.getByText("Transcript preview unavailable")).toBeInTheDocument();
  });

  it("closes through Escape so the drawer remains keyboard-operable", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExplorePreviewDrawer lesson={LESSON} onClose={onClose} labels={{
      close: "Close preview",
      start: "Start lesson",
      add: "Add to My Lessons",
      added: "Added to My Lessons",
      adding: "Adding lesson",
      addFailed: "Could not add lesson",
      transcript: "Transcript preview",
      transcriptUnavailable: "Transcript preview unavailable",
      durationTemplate: "{count} min",
      metadata: { jlpt: "JLPT", duration: "Duration", vocabulary: "Vocabulary", sentences: "Sentences" },
    }} />);

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows its busy and failure states when adding cannot be completed", async () => {
    const user = userEvent.setup();
    let rejectRequest: (reason?: unknown) => void = () => undefined;
    const pendingRequest = new Promise<Response>((_resolve, reject) => {
      rejectRequest = reject;
    });
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pendingRequest));
    render(<ExplorePreviewDrawer lesson={LESSON} onClose={vi.fn()} labels={{
      close: "Close preview", start: "Start lesson", add: "Add to My Lessons", added: "Added to My Lessons", adding: "Adding lesson", addFailed: "Could not add lesson", transcript: "Transcript preview", transcriptUnavailable: "Transcript preview unavailable", durationTemplate: "{count} min", metadata: { jlpt: "JLPT", duration: "Duration", vocabulary: "Vocabulary", sentences: "Sentences" },
    }} />);

    await user.click(screen.getByRole("button", { name: "Add to My Lessons" }));
    expect(screen.getByRole("button", { name: "Adding lesson" })).toBeDisabled();

    rejectRequest(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not add lesson");
    expect(screen.getByRole("button", { name: "Add to My Lessons" })).toBeEnabled();
  });

  it("exposes a translated close button in addition to Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExplorePreviewDrawer lesson={LESSON} onClose={onClose} labels={{
      close: "Close preview", start: "Start lesson", add: "Add to My Lessons", added: "Added to My Lessons", adding: "Adding lesson", addFailed: "Could not add lesson", transcript: "Transcript preview", transcriptUnavailable: "Transcript preview unavailable", durationTemplate: "{count} min", metadata: { jlpt: "JLPT", duration: "Duration", vocabulary: "Vocabulary", sentences: "Sentences" },
    }} />);

    await user.click(screen.getByRole("button", { name: "Close preview" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
