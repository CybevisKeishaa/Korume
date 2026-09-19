import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { act } from "@testing-library/react";
import { useLessonCreationJob } from "./use-lesson-creation-job";
import type { LessonCreationJobProjection } from "@/lib/lesson-creation/types";

const JOB_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_JOB_ID = "44444444-4444-4444-8444-444444444444";
const LESSON_ID = "55555555-5555-4555-8555-555555555555";

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

const EVENT = {
  state: "queued" as const,
  step: "deduplicating" as const,
  attemptCount: 0,
  publicErrorCode: null,
  createdAt: "2026-09-19T08:00:00.000Z",
};

const onSucceeded = vi.fn();

/** Renders the hook's own output so a test can read it without a wrapper library. */
function Harness({ jobId }: { jobId: string | null }) {
  const state = useLessonCreationJob(jobId, { onSucceeded });
  return (
    <div>
      <span data-testid="step">{state.job?.step ?? "none"}</span>
      <span data-testid="state">{state.job?.state ?? "none"}</span>
      <span data-testid="events">{state.events.map((event) => event.step).join(",")}</span>
      <span data-testid="phase">{state.phase}</span>
      <span data-testid="refused">{String(state.refusedStatus)}</span>
      <button type="button" onClick={state.restart}>restart</button>
    </div>
  );
}

function respondWith(...responses: { ok?: boolean; status?: number; job?: LessonCreationJobProjection; events?: unknown[] }[]) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => ({ data: { job: response.job ?? job(), events: response.events ?? [EVENT] } }),
    } as Response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Lets the in-flight request, its JSON parse, and the state update settle. */
async function settle(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** One poll interval plus the microtasks its response resolution needs. */
async function advanceOnePoll(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2_000);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  onSucceeded.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useLessonCreationJob", () => {
  it("reads the job immediately when given one, without waiting for an interval", async () => {
    const fetchMock = respondWith({});

    render(<Harness jobId={JOB_ID} />);
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`/api/lesson-creation-jobs/${JOB_ID}`);
    expect(screen.getByTestId("step")).toHaveTextContent("fetching_transcript");
    expect(screen.getByTestId("events")).toHaveTextContent("deduplicating");
  });

  it("never polls at all without a job id", async () => {
    const fetchMock = respondWith({});

    render(<Harness jobId={null} />);
    await advanceOnePoll();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps polling while the job is still active", async () => {
    const fetchMock = respondWith({}, {}, {});

    render(<Harness jobId={JOB_ID} />);
    await settle();
    await advanceOnePoll();
    await advanceOnePoll();

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("stops polling once the job succeeds, and reports it exactly once", async () => {
    const succeeded = job({ state: "succeeded", step: "ready", lessonId: LESSON_ID });
    const fetchMock = respondWith({ job: succeeded });

    render(<Harness jobId={JOB_ID} />);
    await settle();
    await advanceOnePoll();
    await advanceOnePoll();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onSucceeded).toHaveBeenCalledTimes(1);
    expect(onSucceeded).toHaveBeenCalledWith(succeeded);
  });

  it("stops polling once the job fails, and does not report success", async () => {
    const fetchMock = respondWith({
      job: job({ state: "failed", step: "failed", publicErrorCode: "transcript_unavailable" }),
    });

    render(<Harness jobId={JOB_ID} />);
    await settle();
    await advanceOnePoll();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onSucceeded).not.toHaveBeenCalled();
    expect(screen.getByTestId("state")).toHaveTextContent("failed");
  });

  it("stops polling after unmount", async () => {
    const fetchMock = respondWith({}, {});

    const { unmount } = render(<Harness jobId={JOB_ID} />);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();
    await advanceOnePoll();
    await advanceOnePoll();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("starts over for a replaced job id and does not keep the previous job's state", async () => {
    const fetchMock = respondWith(
      { job: job({ step: "fetching_metadata" }) },
      { job: job({ id: OTHER_JOB_ID, step: "persisting" }), events: [] },
    );

    const { rerender } = render(<Harness jobId={JOB_ID} />);
    await settle();
    expect(screen.getByTestId("step")).toHaveTextContent("fetching_metadata");

    rerender(<Harness jobId={OTHER_JOB_ID} />);
    await settle();

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/lesson-creation-jobs/${OTHER_JOB_ID}`);
    expect(screen.getByTestId("step")).toHaveTextContent("persisting");
    expect(screen.getByTestId("events")).toBeEmptyDOMElement();
  });

  it("stops and reports the job unreadable when the request is refused", async () => {
    const fetchMock = respondWith({ ok: false, status: 404 });

    render(<Harness jobId={JOB_ID} />);
    await settle();
    await advanceOnePoll();

    expect(screen.getByTestId("phase")).toHaveTextContent("refused");
    expect(screen.getByTestId("refused")).toHaveTextContent("404");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("polls the same job again after a restart, and drops the terminal state it stopped on", async () => {
    // A retry re-queues the SAME job id, so the id alone cannot restart the
    // loop — the consumer says when a new attempt exists.
    const fetchMock = respondWith(
      { job: job({ state: "failed", step: "failed", publicErrorCode: "temporary_failure" }) },
      { job: job({ state: "queued", step: "deduplicating", attemptCount: 0 }) },
    );

    render(<Harness jobId={JOB_ID} />);
    await settle();
    expect(screen.getByTestId("state")).toHaveTextContent("failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      screen.getByRole("button", { name: "restart" }).click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("state")).toHaveTextContent("queued");
  });

  it("ignores a response with no job in it rather than rendering a broken one", async () => {
    // A truncated or unexpected body must not reach a consumer that will call
    // `events.map` on it.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { unexpected: true } }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness jobId={JOB_ID} />);
    await settle();

    expect(screen.getByTestId("step")).toHaveTextContent("none");
    expect(screen.getByTestId("events")).toBeEmptyDOMElement();
    expect(screen.getByTestId("phase")).toHaveTextContent("polling");
  });

  it("treats a job with no event history as having none, not as broken", async () => {
    respondWith({ job: job(), events: undefined });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { job: job() } }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness jobId={JOB_ID} />);
    await settle();

    expect(screen.getByTestId("step")).toHaveTextContent("fetching_transcript");
    expect(screen.getByTestId("events")).toBeEmptyDOMElement();
  });

  it("reports the status that refused the read, so a consumer can be specific about 401", async () => {
    respondWith({ ok: false, status: 401 });

    render(<Harness jobId={JOB_ID} />);
    await settle();

    expect(screen.getByTestId("phase")).toHaveTextContent("refused");
    expect(screen.getByTestId("refused")).toHaveTextContent("401");
  });

  it("reaches a terminal phase so a consumer can tell polling is over", async () => {
    respondWith({ job: job({ state: "succeeded", step: "ready", lessonId: LESSON_ID }) });

    render(<Harness jobId={JOB_ID} />);
    await settle();

    expect(screen.getByTestId("phase")).toHaveTextContent("terminal");
  });

  it("gives up on a job that never leaves the queue, rather than polling for as long as the tab is open", async () => {
    // Design §7: a queued job the worker will never run must not be presented
    // as indefinitely pending. The worker may also simply be off.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { job: job({ state: "queued", step: "deduplicating" }), events: [] } }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness jobId={JOB_ID} />);
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 4_000);
    });

    expect(screen.getByTestId("phase")).toHaveTextContent("stalled");
    const callsAtGiveUp = fetchMock.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(fetchMock.mock.calls.length).toBe(callsAtGiveUp);
  });

  it("does not give up on a job that is still making durable progress", async () => {
    let step = 0;
    const steps = ["deduplicating", "fetching_metadata", "fetching_transcript", "enriching_furigana"] as const;
    const fetchMock = vi.fn().mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        data: { job: job({ state: "running", step: steps[Math.min(step++, steps.length - 1)] }), events: [] },
      }),
    } as Response));
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness jobId={JOB_ID} />);
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4 * 60_000);
    });

    expect(screen.getByTestId("phase")).toHaveTextContent("polling");
  });

  it("keeps polling through a transient network failure", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { job: job(), events: [EVENT] } }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness jobId={JOB_ID} />);
    await settle();
    expect(screen.getByTestId("step")).toHaveTextContent("none");

    await advanceOnePoll();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("step")).toHaveTextContent("fetching_transcript");
    expect(screen.getByTestId("phase")).toHaveTextContent("polling");
  });
});
