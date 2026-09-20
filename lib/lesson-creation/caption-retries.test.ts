import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "@/lib/supabase/service";
import { createMockSupabase } from "@/test/supabase-mock";
import { fetchJapaneseCaptions } from "@/lib/youtube/timedtext";
import {
  claimNextLessonCreationJob, finalizeClaimedJob, getRequesterJob,
  recoverExpiredLessonCreationJobs, transitionClaimedJob,
  type ClaimedLessonCreationJob,
} from "./store";
import { runLessonCreationPass } from "./worker";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/japanese", () => ({ toFurigana: vi.fn().mockResolvedValue([]) }));
vi.mock("./store", async (importOriginal) => ({
  ...await importOriginal<typeof import("./store")>(),
  claimNextLessonCreationJob: vi.fn(), finalizeClaimedJob: vi.fn(), getRequesterJob: vi.fn(),
  recoverExpiredLessonCreationJobs: vi.fn(), transitionClaimedJob: vi.fn(),
}));

const NOW = new Date("2026-09-14T03:00:00.000Z");
const VIDEO_ID = "dQw4w9WgXcQ";
const CLAIM: ClaimedLessonCreationJob = {
  job: {
    id: "dc2ceca1-1647-489b-985e-97aa4ac00abc", state: "running", step: "deduplicating",
    attemptCount: 1, lessonId: null, publicErrorCode: null, updatedAt: NOW.toISOString(),
  },
  requesterId: "dce6afaa-43d0-47cc-b983-1e504579f574", origin: "learner", requestedAccess: "PRIVATE",
  youtubeVideoId: VIDEO_ID, leaseToken: "b4a4485c-9539-408b-a9ea-67a89e845234",
  leaseExpiresAt: "2026-09-14T03:02:00.000Z",
};
const TRACKS = '<transcript_list><track lang_code="ja"/></transcript_list>';
const CAPTIONS = '<transcript><text start="0" dur="1">日本語</text></transcript>';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  let durable = CLAIM.job;
  vi.mocked(recoverExpiredLessonCreationJobs).mockResolvedValue(0);
  vi.mocked(claimNextLessonCreationJob).mockResolvedValue(CLAIM);
  vi.mocked(getRequesterJob).mockImplementation(async () => durable);
  vi.mocked(transitionClaimedJob).mockImplementation(async (input) => {
    durable = { ...durable, step: input.step };
  });
  vi.mocked(finalizeClaimedJob).mockResolvedValue({ ...CLAIM.job, state: "succeeded", step: "ready",
    lessonId: "6636547d-b082-4bb1-bc74-852418d4c9f1" });
  const client = createMockSupabase({ tables: { videos: () => ({ data: null, error: null }) } });
  vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

type Failure = 429 | 503 | 404 | "transport" | "body-transport" | "none" | "missing";
function httpFixture(stage: "list" | "body", failure: Failure) {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input);
    urls.push(`${url.hostname}${url.pathname}`);
    if (url.hostname === "www.youtube.com" && url.pathname === "/oembed") {
      return new Response(JSON.stringify({ title: "Lesson", author_name: "Author",
        thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }));
    }
    if (url.hostname !== "video.google.com" || url.pathname !== "/timedtext") throw new Error("Unexpected media request");
    const isList = url.searchParams.get("type") === "list";
    if ((stage === "list") === isList) {
      if (failure === "transport") throw new TypeError("fetch failed");
      if (failure === "body-transport") return { ok: true, text: async () => { throw new TypeError("body connection lost"); } };
      if (typeof failure === "number") return new Response("", { status: failure });
      if (failure === "missing") return new Response(isList ? "<transcript_list/>" : "<transcript/>");
    }
    return new Response(isList ? TRACKS : CAPTIONS);
  }));
  return urls;
}

describe.each(["list", "body"] as const)("production caption retries at the %s request", (stage) => {
  it.each([429, 503, "transport", "body-transport"] as const)("requeues explicit %s failure through real production dependencies", async (failure) => {
    const urls = httpFixture(stage, failure);

    await expect(runLessonCreationPass(NOW)).resolves.toMatchObject({ claimed: 1, requeued: 1, failed: 0 });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: CLAIM.job.id, leaseToken: CLAIM.leaseToken, step: "failed", error: "temporary_failure",
      availableAt: "2026-09-14T03:00:01.000Z",
    });
    expect(finalizeClaimedJob).not.toHaveBeenCalled();
    expect(urls).toEqual(stage === "list"
      ? ["www.youtube.com/oembed", "video.google.com/timedtext"]
      : ["www.youtube.com/oembed", "video.google.com/timedtext", "video.google.com/timedtext"]);
  });

  it.each([404, "missing"] as const)("keeps %s terminal instead of guessing it is transient", async (failure) => {
    httpFixture(stage, failure);
    await expect(runLessonCreationPass(NOW)).resolves.toMatchObject({ requeued: 0, failed: 1 });
    expect(transitionClaimedJob).toHaveBeenLastCalledWith({
      jobId: CLAIM.job.id, leaseToken: CLAIM.leaseToken, step: "failed", error: "transcript_unavailable",
    });
  });

  it.each([429, 503, "transport", "body-transport"] as const)("retains null-on-%s compatibility for existing caption callers", async (failure) => {
    httpFixture(stage, failure);
    await expect(fetchJapaneseCaptions(VIDEO_ID)).resolves.toBeNull();
  });
});

it("persists successful captions fetched through real HTTP adapters", async () => {
  httpFixture("list", "none");
  await expect(runLessonCreationPass(NOW)).resolves.toMatchObject({ succeeded: 1, requeued: 0, failed: 0 });
  expect(finalizeClaimedJob).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({
    source: "youtube_caption", lines: [{ startTime: 0, endTime: 1, textJp: "日本語", textTranslation: null, furiganaJson: [] }],
  }) }));
});
