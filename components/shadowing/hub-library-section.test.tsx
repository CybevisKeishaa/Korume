import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { HubLibrarySection } from "./hub-library-section";

const lesson = { id: "failed", youtubeVideoId: "yt-failed", title: "Missing captions", durationSeconds: null, thumbnailUrl: null, jlptLevelEstimate: null };
const refresh = vi.fn();
const labels = { title: "My lessons", readyAction: "Open", unavailable: "Transcript unavailable", retry: "Try again", retryPending: "Retrying captions\u2026", retryFailed: "Couldn't retry captions. Try again.", retrySessionExpired: "Your session expired — please sign in again.", noThumbnail: "No thumbnail", emptyTitle: "Your lesson library is ready", emptyBody: "Import a lesson to begin building your library.", emptyAction: "Import a lesson" };

vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const JOB_ID = "33333333-3333-4333-8333-333333333333";

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

/** The 202 the enqueue now answers with: a job to poll, not a finished lesson. */
function enqueued(): Response {
  return {
    ok: true,
    status: 202,
    headers: new Headers(),
    json: async () => ({ data: jobProjection() }),
  } as Response;
}

function mockJobFlow(job: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.startsWith("/api/videos/import")
        ? enqueued()
        : ({
            ok: true,
            status: 200,
            headers: new Headers(),
            json: async () => ({ data: { job: jobProjection(job), events: [] } }),
          } as Response),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe("HubLibrarySection", () => {
  it("keeps My Lessons visible with the real import action when the library is empty", () => {
    render(<HubLibrarySection items={[]} labels={labels} />);

    expect(screen.getByRole("region", { name: "My lessons" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Your lesson library is ready" })).toBeInTheDocument();
    expect(screen.getByText("Import a lesson to begin building your library.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Import a lesson" })).toHaveAttribute("href", "#hub-import");
  });

  it("allows Explore to route its empty-library action to the Hub import section", () => {
    render(<HubLibrarySection items={[]} labels={labels} emptyActionHref="/shadowing#hub-import" />);

    expect(screen.getByRole("link", { name: "Import a lesson" })).toHaveAttribute("href", "/shadowing#hub-import");
  });

  it("links a ready lesson to its shadowing workspace", () => {
    render(
      <HubLibrarySection
        items={[{ lesson, state: "ready" }]}
        labels={labels}
      />,
    );

    expect(screen.getByRole("link", { name: "Open: Missing captions" })).toHaveAttribute("href", "/en/shadowing/failed");
  });

  it("shows an unavailable lesson honestly without job percentage or ETA", () => {
    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    expect(screen.getByText("Transcript unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText(/%|ETA|estimated/i)).not.toBeInTheDocument();
  });

  it("queues the retry and shows its durable progress instead of claiming the lesson is back", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url.startsWith("/api/videos/import")
          ? pending
          : Promise.resolve({
              ok: true,
              status: 200,
              headers: new Headers(),
              json: async () => ({ data: { job: jobProjection({ state: "running" }), events: [] } }),
            } as Response),
      ),
    );

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(screen.getByRole("button", { name: "Retrying captions\u2026" })).toBeDisabled();
    expect(screen.queryByText(/%|ETA|estimated/i)).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/videos/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: "https://www.youtube.com/watch?v=yt-failed" }),
    });

    resolveFetch(enqueued());
    // The queue accepted the work; the lesson is not studyable yet, so the Hub
    // must not refresh as though it were.
    expect(await screen.findByRole("status", { name: "Lesson creation progress" })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes the authoritative Hub state only once the job succeeds", async () => {
    mockJobFlow({ state: "succeeded", step: "ready", lessonId: "l1" });

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  });

  it("states a job-time failure in the learner's terms, inside the card", async () => {
    mockJobFlow({ state: "failed", step: "failed", publicErrorCode: "transcript_unavailable" });

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This video has no Japanese captions, so there's nothing to shadow yet.",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("frees every card's retry when the poll is refused, instead of disabling them all silently", async () => {
    // `tracked !== null` disables every unavailable card's button. If a refused
    // poll left that in place with no message, the whole section would go inert.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/videos/import")
          ? enqueued()
          : ({ ok: false, status: 500, headers: new Headers(), json: async () => ({ error: "boom" }) } as Response),
      ),
    );

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't retry captions. Try again.");
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeDisabled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says the session expired when a 401 refuses the poll, rather than blaming the captions", async () => {
    // The hook carries `refusedStatus` so a consumer can be specific. Telling a
    // signed-out learner to "try again" sends them round the same 401 forever.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.startsWith("/api/videos/import")
          ? enqueued()
          : ({ ok: false, status: 401, headers: new Headers(), json: async () => ({ error: "no" }) } as Response),
      ),
    );

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your session expired — please sign in again.");
  });

  it("resumes polling when the retry returns the same job id, instead of staying stuck", async () => {
    // `enqueue_lesson_creation_job` is idempotent while a job is active
    // (migration 32, partial unique index), so a retry gets the SAME id back.
    // Freeing only the button while `tracked` keeps that id means the hook's
    // `[jobId, attempt]` deps never change, its effect never re-runs, and the
    // learner can press Try again forever with no poll and no way out.
    let statusRefused = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/videos/import")) return enqueued();
        if (statusRefused) {
          statusRefused = false;
          return { ok: false, status: 500, headers: new Headers(), json: async () => ({ error: "boom" }) } as Response;
        }
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ data: { job: jobProjection({ state: "running" }), events: [] } }),
        } as Response;
      }),
    );

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't retry captions. Try again.");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("status", { name: "Lesson creation progress" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("announces a refused enqueue and leaves the lesson available for another attempt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response));

    render(<HubLibrarySection items={[{ lesson, state: "unavailable" }]} labels={labels} />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't retry captions. Try again.");
    expect(screen.getByRole("button", { name: "Try again" })).not.toBeDisabled();
  });
});
