import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type MockResult, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import {
  claimNextLessonCreationJob, enqueueLessonCreation, finalizeClaimedJob,
  getRequesterJob, recoverExpiredLessonCreationJobs, retryRequesterJob, transitionClaimedJob,
} from "./store";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
const jobId = "dc2ceca1-1647-489b-985e-97aa4ac00abc";
const requesterId = "dce6afaa-43d0-47cc-b983-1e504579f574";
const foreignId = "cc9e31e1-4ed6-49f9-b32b-96168ae4678e";
const lessonId = "6636547d-b082-4bb1-bc74-852418d4c9f1";
const leaseToken = "b4a4485c-9539-408b-a9ea-67a89e845234";
const now = "2026-09-13T08:00:00.000Z";
const row = {
  id: jobId, requester_user_id: requesterId, origin: "learner", requested_library_access: "PRIVATE",
  youtube_video_id: "abcdefghijk", state: "queued", step: "deduplicating", attempt_count: 0,
  available_at: now, lease_expires_at: null, lease_token: null, lesson_id: null,
  public_error_code: null, created_at: now, updated_at: now, completed_at: null,
};
const projection = {
  id: jobId, state: "queued", step: "deduplicating", attemptCount: 0,
  lessonId: null, publicErrorCode: null, updatedAt: now,
};
const enqueueInput = { requesterId, origin: "learner" as const, requestedAccess: "PRIVATE" as const, youtubeVideoId: "abcdefghijk" };
const enqueueArgs = { p_requester: requesterId, p_origin: "learner", p_access: "PRIVATE", p_youtube_video_id: "abcdefghijk" };
const transitionInput = { jobId, leaseToken, step: "fetching_transcript" as const };
const transitionArgs = { p_job_id: jobId, p_expected_state: "running", p_step: "fetching_transcript", p_available_at: null, p_error: null, p_lease_token: leaseToken, p_lease_seconds: 120 };
const finalizeInput = { jobId, requesterId, leaseToken, lessonId };
const finalizeArgs = { p_job_id: jobId, p_requester: requesterId, p_lease_token: leaseToken, p_lesson_id: lessonId, p_content: null };

function rpcFixture(name: string, data: unknown, error: MockResult["error"] = null) {
  const client = createMockSupabase({ tables: {}, rpcs: { [name]: () => ({ data, error }) } });
  vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
  return client;
}
function expectRpc(client: ReturnType<typeof createMockSupabase>, name: string, args: Record<string, unknown>) {
  expect(client.rpcCalls).toEqual([{ name, args }]);
  expect(createServiceClient).toHaveBeenCalledTimes(1);
}

beforeEach(() => vi.clearAllMocks());

describe("lesson creation store", () => {
  it.each(["queued", "running"])("maps new or active %s enqueue into only public fields", async (state) => {
    const client = rpcFixture("enqueue_lesson_creation_job", { ...row, state });
    expect(await enqueueLessonCreation(enqueueInput)).toEqual({ ...projection, state });
    expectRpc(client, "enqueue_lesson_creation_job", enqueueArgs);
  });

  it("creates a fresh service client for each operation", async () => {
    const first = rpcFixture("enqueue_lesson_creation_job", row);
    const second = createMockSupabase({ tables: {}, rpcs: { enqueue_lesson_creation_job: () => ({ data: { ...row, id: lessonId }, error: null }) } });
    vi.mocked(createServiceClient).mockReturnValueOnce(first as unknown as ReturnType<typeof createServiceClient>)
      .mockReturnValueOnce(second as unknown as ReturnType<typeof createServiceClient>);
    expect((await enqueueLessonCreation(enqueueInput)).id).toBe(jobId);
    expect((await enqueueLessonCreation(enqueueInput)).id).toBe(lessonId);
    expect(createServiceClient).toHaveBeenCalledTimes(2);
    expect(first.rpcCalls).toEqual([{ name: "enqueue_lesson_creation_job", args: enqueueArgs }]);
    expect(second.rpcCalls).toEqual(first.rpcCalls);
  });

  it.each([requesterId, foreignId, lessonId])("scopes requester lookup by id and requester (%s)", async (caller) => {
    let query: QueryCall[] = [];
    const client = createMockSupabase({ tables: { lesson_creation_jobs: (calls) => {
      query = calls;
      const matches = eqValue(calls, "id") === jobId &&
        (eqValue(calls, "requester_user_id") === undefined || eqValue(calls, "requester_user_id") === requesterId);
      return { data: matches ? row : null, error: null };
    } } });
    vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
    expect(await getRequesterJob(jobId, caller)).toEqual(caller === requesterId ? projection : null);
    expect(query).toEqual([
      { op: "select", columns: "id,state,step,attempt_count,lesson_id,public_error_code,updated_at" },
      { op: "eq", column: "id", value: jobId },
      { op: "eq", column: "requester_user_id", value: caller }, { op: "maybeSingle" },
    ]);
    expect(client.rpcCalls).toEqual([]);
    expect(createServiceClient).toHaveBeenCalledTimes(1);
  });

  it("returns null for a missing requester row", async () => {
    const client = createMockSupabase({ tables: { lesson_creation_jobs: () => ({ data: null, error: null }) } });
    vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
    expect(await getRequesterJob(lessonId, requesterId)).toBeNull();
  });

  it.each([{ data: { ...row, state: "bogus" }, error: null }, { data: null, error: { message: "lookup failed", code: "08006" } }])("throws lookup database/parse errors", async (result) => {
    const client = createMockSupabase({ tables: { lesson_creation_jobs: () => result } });
    vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
    await expect(getRequesterJob(jobId, requesterId)).rejects.toBeDefined();
  });

  it.each([row, null])("maps retry success or foreign/missing to projection or null", async (data) => {
    const client = rpcFixture("retry_lesson_creation_job", data);
    expect(await retryRequesterJob(jobId, requesterId)).toEqual(data ? projection : null);
    expectRpc(client, "retry_lesson_creation_job", { p_job_id: jobId, p_requester: requesterId });
  });

  it("propagates the RPC's not-retryable rejection", async () => {
    const error = { message: "job_not_retryable", code: "23505" };
    const client = rpcFixture("retry_lesson_creation_job", null, error);
    await expect(retryRequesterJob(jobId, requesterId)).rejects.toBe(error);
    expectRpc(client, "retry_lesson_creation_job", { p_job_id: jobId, p_requester: requesterId });
  });

  it("claims a row with separately parsed worker-private fields", async () => {
    const client = rpcFixture("claim_lesson_creation_job", { ...row, state: "running", attempt_count: 1, lease_token: leaseToken, lease_expires_at: "2026-09-13T08:02:00.000Z" });
    expect(await claimNextLessonCreationJob(now)).toEqual({
      job: { ...projection, state: "running", attemptCount: 1 }, requesterId, origin: "learner",
      requestedAccess: "PRIVATE", youtubeVideoId: "abcdefghijk", leaseToken, leaseExpiresAt: "2026-09-13T08:02:00.000Z",
    });
    expectRpc(client, "claim_lesson_creation_job", { p_now: now, p_lease_seconds: 120 });
  });

  it("returns null only for an empty claim", async () => {
    const client = rpcFixture("claim_lesson_creation_job", null);
    expect(await claimNextLessonCreationJob(now)).toBeNull();
    expectRpc(client, "claim_lesson_creation_job", { p_now: now, p_lease_seconds: 120 });
  });

  it("rejects a claim without a valid lease", async () => {
    rpcFixture("claim_lesson_creation_job", { ...row, state: "running" });
    await expect(claimNextLessonCreationJob(now)).rejects.toBeDefined();
  });

  it("renews a transition with its lease fence", async () => {
    const client = rpcFixture("transition_lesson_creation_job", { ...row, state: "running", step: "fetching_transcript" });
    await expect(transitionClaimedJob(transitionInput)).resolves.toBeUndefined();
    expectRpc(client, "transition_lesson_creation_job", transitionArgs);
  });

  it("maps a transient requeue with its available time", async () => {
    const client = rpcFixture("transition_lesson_creation_job", { ...row, public_error_code: "temporary_failure" });
    await transitionClaimedJob({ ...transitionInput, availableAt: now, error: "temporary_failure" });
    expectRpc(client, "transition_lesson_creation_job", { ...transitionArgs, p_available_at: now, p_error: "temporary_failure" });
  });

  it("maps a terminal transition without a retry time", async () => {
    const client = rpcFixture("transition_lesson_creation_job", { ...row, state: "failed", step: "failed", public_error_code: "metadata_unavailable" });
    await transitionClaimedJob({ ...transitionInput, step: "failed", error: "metadata_unavailable" });
    expectRpc(client, "transition_lesson_creation_job", { ...transitionArgs, p_step: "failed", p_available_at: null, p_error: "metadata_unavailable" });
  });

  it.each([
    { state: "succeeded", step: "ready", lesson_id: lessonId, public_error_code: null },
    { state: "failed", step: "failed", lesson_id: null, public_error_code: "quota_exceeded" },
  ])("returns parsed finalize outcome $state", async (outcome) => {
    const client = rpcFixture("finalize_lesson_creation_job", { ...row, ...outcome });
    expect(await finalizeClaimedJob(finalizeInput)).toEqual({ ...projection, state: outcome.state, step: outcome.step, lessonId: outcome.lesson_id, publicErrorCode: outcome.public_error_code });
    expectRpc(client, "finalize_lesson_creation_job", finalizeArgs);
  });

  it("translates atomic content payload keys exactly", async () => {
    const client = rpcFixture("finalize_lesson_creation_job", { ...row, state: "succeeded", step: "ready", lesson_id: lessonId });
    await finalizeClaimedJob({ ...finalizeInput, lessonId: null, content: {
      title: "Lesson", thumbnailUrl: null, source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2.5, textJp: "Caption", textTranslation: null, furiganaJson: null }],
    } });
    expectRpc(client, "finalize_lesson_creation_job", { ...finalizeArgs, p_lesson_id: null, p_content: {
      title: "Lesson", thumbnail_url: null, source: "youtube_caption",
      lines: [{ start_time: 0, end_time: 2.5, text_jp: "Caption", text_translation: null, furigana_json: null }],
    } });
  });

  it("preserves missing/foreign finalize null", async () => {
    const client = rpcFixture("finalize_lesson_creation_job", null);
    expect(await finalizeClaimedJob(finalizeInput)).toBeNull();
    expectRpc(client, "finalize_lesson_creation_job", finalizeArgs);
  });

  it.each([0, 2])("returns recovered count %s", async (count) => {
    const client = rpcFixture("recover_expired_lesson_creation_jobs", count);
    expect(await recoverExpiredLessonCreationJobs(now)).toBe(count);
    expectRpc(client, "recover_expired_lesson_creation_jobs", { p_now: now });
  });

  const operations = [
    { name: "enqueue_lesson_creation_job", args: enqueueArgs, run: () => enqueueLessonCreation(enqueueInput) },
    { name: "retry_lesson_creation_job", args: { p_job_id: jobId, p_requester: requesterId }, run: () => retryRequesterJob(jobId, requesterId) },
    { name: "claim_lesson_creation_job", args: { p_now: now, p_lease_seconds: 120 }, run: () => claimNextLessonCreationJob(now) },
    { name: "transition_lesson_creation_job", args: transitionArgs, run: () => transitionClaimedJob(transitionInput) },
    { name: "finalize_lesson_creation_job", args: finalizeArgs, run: () => finalizeClaimedJob(finalizeInput) },
    { name: "recover_expired_lesson_creation_jobs", args: { p_now: now }, run: () => recoverExpiredLessonCreationJobs(now) },
  ];
  it.each(operations)("throws unchanged RPC errors from $name", async ({ name, args, run }) => {
    const error = { message: "database unavailable", code: "08006" };
    const client = rpcFixture(name, null, error);
    await expect(run()).rejects.toBe(error);
    expectRpc(client, name, args);
  });
  it.each(operations)("rejects malformed results from $name", async ({ name, args, run }) => {
    const client = rpcFixture(name, { ...row, updated_at: "not-a-date" });
    await expect(run()).rejects.toBeDefined();
    expectRpc(client, name, args);
  });
  it.each([null, [], [row], {}])("does not turn missing/invalid enqueue data into queue-empty", async (data) => {
    const client = rpcFixture("enqueue_lesson_creation_job", data);
    await expect(enqueueLessonCreation(enqueueInput)).rejects.toBeDefined();
    expectRpc(client, "enqueue_lesson_creation_job", enqueueArgs);
  });

  it("records and rejects unregistered RPCs", async () => {
    const client = createMockSupabase({ tables: {} });
    await expect(client.rpc("unknown_job_rpc", { p_job_id: jobId })).rejects.toThrow('no resolver registered for RPC "unknown_job_rpc"');
    expect(client.rpcCalls).toEqual([{ name: "unknown_job_rpc", args: { p_job_id: jobId } }]);
  });

  it("rejects inherited RPC property names as unregistered", async () => {
    const client = createMockSupabase({ tables: {}, rpcs: {} });
    await expect(client.rpc("toString", { p_job_id: jobId })).rejects.toThrow('no resolver registered for RPC "toString"');
    expect(client.rpcCalls).toEqual([{ name: "toString", args: { p_job_id: jobId } }]);
  });
});
