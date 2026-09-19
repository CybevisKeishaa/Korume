import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { act, fireEvent } from "@testing-library/react";
import { VideoImportForm } from "./video-import-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

function mockFetchOnce(response: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  json?: () => Promise<unknown>;
}): void {
  const headers = new Headers(response.headers ?? {});
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: response.ok,
      status: response.status,
      headers,
      json: response.json ?? (async () => ({})),
    } as Response),
  );
}

const JOB_ID = "33333333-3333-4333-8333-333333333333";
const LESSON_ID = "55555555-5555-4555-8555-555555555555";

function jobProjection(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_ID,
    state: "queued",
    step: "deduplicating",
    attemptCount: 0,
    lessonId: null,
    publicErrorCode: null,
    updatedAt: "2026-09-19T08:00:00.000Z",
    ...overrides,
  };
}

/**
 * Routes the enqueue POST and the status GET separately, because the form now
 * performs two different requests: it queues durable work, then polls it.
 */
function mockJobFlow(status: { job: Record<string, unknown>; events?: unknown[] }) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (typeof url === "string" && url.startsWith("/api/videos/import")) {
      return {
        ok: true,
        status: 202,
        headers: new Headers(),
        json: async () => ({ data: jobProjection() }),
      } as Response;
    }
    if (typeof url === "string" && url.includes("/retry")) {
      return {
        ok: true,
        status: 202,
        headers: new Headers(),
        json: async () => ({ data: jobProjection() }),
      } as Response;
    }
    void init;
    return {
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({ data: { job: status.job, events: status.events ?? [] } }),
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function fillAndSubmit(url: string): Promise<void> {
  await userEvent.type(screen.getByLabelText(/youtube url/i), url);
  await userEvent.click(screen.getByRole("button", { name: /import video/i }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("VideoImportForm", () => {
  it("renders the URL label and import button", () => {
    render(<VideoImportForm />);
    expect(screen.getByLabelText("YouTube URL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import video" })).toBeInTheDocument();
  });

  it("shows the importing state while the request is in flight, then restores it once the job is terminal", async () => {
    let resolveEnqueue!: (value: unknown) => void;
    const pendingEnqueue = new Promise((resolve) => {
      resolveEnqueue = resolve;
    });
    const failed = jobProjection({ state: "failed", step: "failed", publicErrorCode: "temporary_failure" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/videos/import")
          ? pendingEnqueue
          : ({
              ok: true,
              status: 200,
              headers: new Headers(),
              json: async () => ({ data: { job: failed, events: [] } }),
            } as Response),
      ),
    );

    render(<VideoImportForm />);
    await userEvent.type(screen.getByLabelText("YouTube URL"), "https://www.youtube.com/watch?v=abc123");
    await userEvent.click(screen.getByRole("button", { name: "Import video" }));

    const importingButton = await screen.findByRole("button", { name: "Importing…" });
    expect(importingButton).toBeDisabled();

    resolveEnqueue({
      ok: true,
      status: 202,
      headers: new Headers(),
      json: async () => ({ data: jobProjection() }),
    });

    expect(await screen.findByRole("button", { name: "Import video" })).not.toBeDisabled();
  });

  it("stays busy while a queued job is still running", async () => {
    mockJobFlow({ job: jobProjection({ state: "running", step: "fetching_transcript" }) });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("button", { name: "Importing…" })).toBeDisabled();
  });

  function refusePollWith(status: number) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/videos/import")
          ? ({ ok: true, status: 202, headers: new Headers(), json: async () => ({ data: jobProjection() }) } as Response)
          : ({ ok: false, status, headers: new Headers(), json: async () => ({ error: "refused" }) } as Response),
      ),
    );
  }

  it("reports a job it can no longer read instead of polling in silence", async () => {
    refusePollWith(404);

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong importing that video. Please try again.",
    );
  });

  it("lets the learner try again after a refused poll, instead of locking the form", async () => {
    // The enqueue succeeded and the job is running durably in the background,
    // but this page can no longer follow it. Leaving the button disabled and
    // reading "Importing…" strands the learner with no way out but a reload.
    refusePollWith(500);

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Import video" })).not.toBeDisabled();
    expect(screen.getByLabelText("YouTube URL")).not.toBeDisabled();
  });

  it("names an expired session during polling instead of blaming the video", async () => {
    refusePollWith(401);

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired — please sign in again.",
    );
  });

  it("shows the durable progress of the queued job instead of navigating on 202", async () => {
    mockJobFlow({ job: jobProjection({ state: "running", step: "fetching_transcript" }), events: [
      { state: "queued", step: "deduplicating", attemptCount: 0, publicErrorCode: null, createdAt: "2026-09-19T08:00:00.000Z" },
    ] });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("status", { name: "Lesson creation progress" })).toBeInTheDocument();
    expect(screen.getByText("Preparing lesson")).toBeInTheDocument();
    // A 202 is not a lesson: nothing may navigate yet.
    expect(push).not.toHaveBeenCalled();
  });

  it("polls the job it was handed, not the lesson it does not have yet", async () => {
    const fetchMock = mockJobFlow({ job: jobProjection({ state: "running", step: "deduplicating" }) });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    await screen.findByRole("status", { name: "Lesson creation progress" });
    expect(fetchMock.mock.calls.map((call) => call[0])).toContain(`/api/lesson-creation-jobs/${JOB_ID}`);
  });

  it("refreshes and navigates to the lesson only once the job succeeds", async () => {
    mockJobFlow({ job: jobProjection({ state: "succeeded", step: "ready", lessonId: LESSON_ID }) });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith(`/shadowing/${LESSON_ID}`));
    expect(refresh).toHaveBeenCalled();
  });

  it("does not navigate to a succeeded job that carries no lesson id", async () => {
    mockJobFlow({ job: jobProjection({ state: "succeeded", step: "ready", lessonId: null }) });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the input once the work is queued", async () => {
    mockJobFlow({ job: jobProjection({ state: "running", step: "deduplicating" }) });

    render(<VideoImportForm />);
    const input = screen.getByLabelText<HTMLInputElement>(/youtube url/i);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(input).toHaveValue("");
  });

  it("names the disabled-worker refusal rather than showing a generic failure (503)", async () => {
    mockFetchOnce({ ok: false, status: 503 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Lesson creation is paused right now. Please try again later.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("states a job-time failure in the learner's terms, with a retry", async () => {
    mockJobFlow({
      job: jobProjection({ state: "failed", step: "failed", publicErrorCode: "transcript_unavailable" }),
      events: [{ state: "failed", step: "failed", attemptCount: 1, publicErrorCode: "transcript_unavailable", createdAt: "2026-09-19T08:00:00.000Z" }],
    });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This video has no Japanese captions, so there's nothing to shadow yet.",
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("re-queues the same job through the retry endpoint", async () => {
    const fetchMock = mockJobFlow({
      job: jobProjection({ state: "failed", step: "failed", publicErrorCode: "temporary_failure" }),
    });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));

    expect(fetchMock.mock.calls.map((call) => call[0])).toContain(
      `/api/lesson-creation-jobs/${JOB_ID}/retry`,
    );
  });

  it("shows a session-expired message on 401", async () => {
    mockFetchOnce({ ok: false, status: 401 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your session expired — please sign in again.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("explains the monthly lesson quota on 403 instead of treating it as a generic failure", async () => {
    mockFetchOnce({ ok: false, status: 403 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You've reached this month's lesson import limit.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("shows a wait message built from the Retry-After header on 429", async () => {
    mockFetchOnce({ ok: false, status: 429, headers: { "Retry-After": "30" } });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many imports — please wait 30s and try again.",
    );
  });

  it("falls back to a generic wait message on 429 with no Retry-After header", async () => {
    mockFetchOnce({ ok: false, status: 429 });

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many imports — please wait a moment and try again.",
    );
  });

  it("shows an invalid-URL message on 400", async () => {
    mockFetchOnce({ ok: false, status: 400 });

    render(<VideoImportForm />);
    await fillAndSubmit("not a real url");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That doesn't look like a valid YouTube URL.",
    );
  });

  it("does not submit an empty URL", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    render(<VideoImportForm />);
    await userEvent.click(screen.getByRole("button", { name: /import video/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That doesn't look like a valid YouTube URL.",
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows a generic error message when the request throws (network failure)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    render(<VideoImportForm />);
    await fillAndSubmit("https://www.youtube.com/watch?v=abc123");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong importing that video. Please try again.",
    );
  });
});

/**
 * Isolated because fake timers and `userEvent` do not mix: an earlier version
 * of this test called `vi.useFakeTimers()` inside the main block and every
 * other test in the file timed out at 5s — 19 failures from one line. Here the
 * clock is installed and removed per test, and interaction uses `fireEvent`,
 * which does not wait on timers at all.
 */
describe("VideoImportForm — a job that stops moving", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("says the lesson is still being prepared rather than staying 'Importing…' forever", async () => {
    mockJobFlow({ job: jobProjection({ state: "queued", step: "deduplicating" }) });

    render(<VideoImportForm />);
    fireEvent.change(screen.getByLabelText("YouTube URL"), {
      target: { value: "https://www.youtube.com/watch?v=abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import video" }));
    // Let the enqueue settle FIRST: the poll cannot start before the job id
    // exists, and advancing the clock in the same act spends the budget before
    // there is anything to poll.
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Importing…" })).toBeDisabled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60_000 + 4_000);
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Lesson creation is paused right now. Please try again later.",
    );
    expect(screen.getByRole("button", { name: "Import video" })).not.toBeDisabled();
  });
});
