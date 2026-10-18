import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import type { SessionListItem } from "@/lib/data/shadowing";
import { PronunciationDetails, progressLine } from "./pronunciation-details";

const item = (id: string, pronunciationScore: number | null, rhythmScore: number | null): SessionListItem => ({
  id, createdAt: "2026-10-18T00:00:00Z", signedUrl: null, pronunciationScore, rhythmScore, pitchScore: null,
  assessment: null, state: pronunciationScore === null ? "unscored" : "scored", format: "wav",
});
describe("PronunciationDetails", () => {
  it("compares the latest two scored takes only", () => {
    expect(progressLine([item("a", 90, 80)])).toBeNull();
    expect(progressLine([item("a", 90, 80), item("b", null, null), item("c", 84, 72)])).toEqual({ metric: "rhythm", from: 72, to: 80 });
    expect(progressLine([item("a", 90, null), item("b", 84, 72)])).toEqual({ metric: "pronunciation", from: 84, to: 90 });
  });
  it("hides details initially and exposes only recorded measurements", async () => {
    render(<PronunciationDetails assessment={{ v: 1, accuracy: 91, completeness: null, recognizedText: "日本語", words: null }} rhythmScore={80} pitch={null}
      items={[item("a", 90, 80), item("b", 84, 72)]} onScore={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument();
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Accuracy")).toBeVisible();
    expect(screen.queryByText("Completeness")).not.toBeInTheDocument();
    expect(screen.getByText("What the scorer heard")).toBeVisible();
    expect(screen.getByText("Rhythm 72 → 80")).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
  it("offers retry for unscored history and explains disabled legacy recordings", async () => {
    const onScore = vi.fn();
    render(<PronunciationDetails assessment={null} rhythmScore={null} pitch={null}
      items={[item("new", null, null), { ...item("old", null, null), state: "legacy", format: "webm" }]} onScore={onScore} />);
    await userEvent.click(screen.getByRole("button", { name: "Details" }));
    const retry = screen.getAllByRole("button", { name: "Score again" });
    expect(retry).toHaveLength(2);
    expect(retry[1]).toBeDisabled();
    expect(screen.getByText("Older recording format, cannot be rescored")).toBeVisible();
    const retryable = retry[0]; if (!retryable) throw new Error("Missing retry button");
    await userEvent.click(retryable);
    expect(onScore).toHaveBeenCalledWith("new");
    expect(screen.getByText("No detail recorded for this attempt")).toBeVisible();
    expect(screen.queryByText(/Pronunciation \d+ →/)).not.toBeInTheDocument();
  });
});
