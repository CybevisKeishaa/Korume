import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { LessonCreationProgress } from "./lesson-creation-progress";
import type { LessonCreationJobEvent, LessonCreationJobProjection } from "@/lib/lesson-creation/types";

const JOB_ID = "33333333-3333-4333-8333-333333333333";

function job(overrides: Partial<LessonCreationJobProjection> = {}): LessonCreationJobProjection {
  return {
    id: JOB_ID,
    state: "running",
    step: "fetching_transcript",
    attemptCount: 1,
    lessonId: null,
    publicErrorCode: null,
    updatedAt: "2026-09-19T08:00:00.000Z",
    ...overrides,
  };
}

function event(step: LessonCreationJobEvent["step"], state: LessonCreationJobEvent["state"] = "running"): LessonCreationJobEvent {
  return { state, step, attemptCount: 1, publicErrorCode: null, createdAt: "2026-09-19T08:00:00.000Z" };
}

/** The four learner-facing stages design §9 approves, in order. */
const STAGE_LABELS = ["Preparing lesson", "Finding transcript", "Building lesson", "Ready to study"];

function stageState(label: string): string {
  const item = screen.getByText(label).closest("li");
  if (item === null) throw new Error(`no list item for stage "${label}"`);
  return item.textContent ?? "";
}

describe("LessonCreationProgress", () => {
  it("shows every approved stage label and nothing else", () => {
    render(<LessonCreationProgress job={job()} events={[event("deduplicating")]} onRetry={vi.fn()} />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(STAGE_LABELS.length);
    expect(items.map((item) => item.textContent)).toEqual(
      STAGE_LABELS.map((label) => expect.stringContaining(label)),
    );
  });

  it("marks a stage done only once a later durable event exists", () => {
    // The job's own step says the transcript fetch has begun, but no event for
    // it has been recorded yet, so "Preparing lesson" is NOT yet provably done.
    render(
      <LessonCreationProgress
        job={job({ step: "fetching_transcript" })}
        events={[event("deduplicating")]}
        onRetry={vi.fn()}
      />,
    );

    expect(stageState("Preparing lesson")).toContain("in progress");
    expect(stageState("Preparing lesson")).not.toContain("done");
    expect(stageState("Finding transcript")).toContain("not started");
  });

  it("marks the earlier stage done once the later stage's event is recorded", () => {
    render(
      <LessonCreationProgress
        job={job({ step: "fetching_transcript" })}
        events={[event("deduplicating"), event("fetching_transcript")]}
        onRetry={vi.fn()}
      />,
    );

    expect(stageState("Preparing lesson")).toContain("done");
    expect(stageState("Finding transcript")).toContain("in progress");
    expect(stageState("Building lesson")).toContain("not started");
  });

  it("reports the current attempt only, not stages the failed attempt had reached", () => {
    // A retry re-queues the job. The first attempt's `fetching_transcript`
    // event is still durable and still visible, but the work it describes is
    // being redone — showing "Preparing lesson: done" for an attempt that has
    // only just started would be the exact lie design §9 forbids.
    render(
      <LessonCreationProgress
        job={job({ state: "queued", step: "deduplicating", attemptCount: 0 })}
        events={[
          event("deduplicating"),
          event("fetching_transcript"),
          event("failed", "failed"),
          event("deduplicating", "queued"),
        ]}
        onRetry={vi.fn()}
      />,
    );

    expect(stageState("Preparing lesson")).toContain("in progress");
    expect(stageState("Finding transcript")).toContain("not started");
  });

  it("marks every stage done for a succeeded job", () => {
    render(
      <LessonCreationProgress
        job={job({ state: "succeeded", step: "ready", lessonId: "l1" })}
        events={[event("deduplicating"), event("persisting"), event("ready", "succeeded")]}
        onRetry={vi.fn()}
      />,
    );

    for (const label of STAGE_LABELS) {
      expect(stageState(label)).toContain("done");
    }
  });

  it("announces durable transitions through a live region", () => {
    render(<LessonCreationProgress job={job()} events={[event("deduplicating")]} onRetry={vi.fn()} />);

    const status = screen.getByRole("status");
    expect(status).toHaveAccessibleName("Lesson creation progress");
    expect(status).toContainElement(screen.getByText("Finding transcript"));
  });

  it("promises no percentage, no ETA, and no estimated time", () => {
    const { container } = render(
      <LessonCreationProgress
        job={job({ step: "persisting" })}
        events={[event("deduplicating"), event("fetching_transcript"), event("persisting")]}
        onRetry={vi.fn()}
      />,
    );

    const text = container.textContent ?? "";
    // Guard the guard: an empty render would satisfy every assertion below.
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("Building lesson");
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\bETA\b/i);
    expect(text).not.toMatch(/remaining|estimat|about \d|\d+\s*(sec|min)/i);
    expect(container.querySelector("progress")).toBeNull();
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
  });

  it.each([
    ["metadata_unavailable" as const, "We couldn't read this video's details. Check the link and try again."],
    ["transcript_unavailable" as const, "This video has no Japanese captions, so there's nothing to shadow yet."],
    ["quota_exceeded" as const, "You've reached this month's lesson import limit."],
    ["temporary_failure" as const, "Something went wrong building this lesson. Try again in a moment."],
  ])("states %s in its own words, not the provider's", (publicErrorCode, message) => {
    render(
      <LessonCreationProgress
        job={job({ state: "failed", step: "failed", publicErrorCode })}
        events={[event("deduplicating"), event("failed", "failed")]}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("offers a keyboard-operable retry on failure", async () => {
    const onRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <LessonCreationProgress
        job={job({ state: "failed", step: "failed", publicErrorCode: "temporary_failure" })}
        events={[event("failed", "failed")]}
        onRetry={onRetry}
      />,
    );

    const retry = screen.getByRole("button", { name: "Try again" });
    await userEvent.tab();
    expect(retry).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("offers no retry while the job can still finish on its own", () => {
    render(<LessonCreationProgress job={job()} events={[event("deduplicating")]} onRetry={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("names the pending retry control rather than emptying it", async () => {
    let settle!: () => void;
    const onRetry = vi.fn().mockReturnValue(new Promise<void>((resolve) => { settle = resolve; }));
    render(
      <LessonCreationProgress
        job={job({ state: "failed", step: "failed", publicErrorCode: "temporary_failure" })}
        events={[event("failed", "failed")]}
        onRetry={onRetry}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("button", { name: "Retrying…" })).toBeDisabled();
    settle();
  });
});
