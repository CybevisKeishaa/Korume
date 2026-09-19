import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoRow } from "@/lib/data/videos";
import { TransientLessonCreationProviderError } from "./errors";
import { createServiceClient } from "@/lib/supabase/service";
import { createMockSupabase } from "@/test/supabase-mock";
import type {
  ClaimedLessonCreationJob,
  FinalizeClaimedJobInput,
  LessonCreationContent,
  TransitionClaimedJobInput,
} from "./store";
import {
  defaultLessonCreationDependencies,
  InvalidLessonCreationStoreDataError,
  LessonCreationPipelineError,
  processClaimedLessonCreationJob,
  type LessonCreationDependencies,
  type LessonCreationPersistenceDependencies,
} from "./pipeline";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));

const JOB_ID = "dc2ceca1-1647-489b-985e-97aa4ac00abc";
const REQUESTER_ID = "dce6afaa-43d0-47cc-b983-1e504579f574";
const LESSON_ID = "6636547d-b082-4bb1-bc74-852418d4c9f1";
const LEASE_TOKEN = "b4a4485c-9539-408b-a9ea-67a89e845234";
const VIDEO_ID = "dQw4w9WgXcQ";
const NOW = "2026-09-14T03:00:00.000Z";

function video(libraryAccess: VideoRow["library_access"]): VideoRow {
  return {
    id: LESSON_ID,
    youtube_video_id: VIDEO_ID,
    title: "Existing lesson",
    duration_seconds: null,
    thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    jlpt_level_estimate: null,
    added_by_user_id: libraryAccess === "PRIVATE" ? REQUESTER_ID : null,
    library_access: libraryAccess,
    promotion_starred: false,
    created_at: NOW,
  };
}

/**
 * Distributes over the claim union, so the fixture cannot pair an origin with an
 * access level the contract forbids. A plain `Pick` would merge the members and
 * silently allow `admin` + `PRIVATE`.
 */
type ClaimCatalogue<T extends ClaimedLessonCreationJob = ClaimedLessonCreationJob> = T extends unknown
  ? Pick<T, "origin" | "requestedAccess">
  : never;

const ADMIN_CLAIM = { origin: "admin", requestedAccess: "FREE" } as const;

function claim(
  step: ClaimedLessonCreationJob["job"]["step"] = "deduplicating",
  catalogue: ClaimCatalogue = { origin: "learner", requestedAccess: "PRIVATE" },
): ClaimedLessonCreationJob {
  return {
    job: {
      id: JOB_ID,
      state: "running",
      step,
      attemptCount: 1,
      lessonId: null,
      publicErrorCode: null,
      updatedAt: NOW,
    },
    requesterId: REQUESTER_ID,
    ...catalogue,
    youtubeVideoId: VIDEO_ID,
    leaseToken: LEASE_TOKEN,
    leaseExpiresAt: "2026-09-14T03:02:00.000Z",
  };
}

function providers(overrides: Partial<LessonCreationDependencies> = {}): LessonCreationDependencies {
  return {
    findExistingLesson: vi.fn().mockResolvedValue(null),
    fetchOembed: vi.fn().mockResolvedValue({
      title: "  A useful lesson  ",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    }),
    fetchCaptions: vi.fn().mockResolvedValue({
      source: "youtube_caption",
      lines: [
        { startTime: 0, endTime: 1.5, textJp: "<b>日本語</b>", textTranslation: null },
        { startTime: 1.5, endTime: 3, textJp: "を勉強します", textTranslation: "Study Japanese" },
      ],
    }),
    toFurigana: vi.fn().mockResolvedValue([{ text: "日本語", reading: "にほんご" }]),
    ...overrides,
  };
}

function persistence(options: {
  onRead?: (readNumber: number, durable: ReturnType<typeof claim>["job"]) => ReturnType<typeof claim>["job"] | null;
  onTransition?: (input: TransitionClaimedJobInput) => void | Promise<void>;
  onFinalize?: (input: FinalizeClaimedJobInput) => void;
} = {}): LessonCreationPersistenceDependencies & {
  reads: number;
  transitions: TransitionClaimedJobInput[];
  finalizations: FinalizeClaimedJobInput[];
} {
  let durable = claim().job;
  const result = {
    reads: 0,
    transitions: [] as TransitionClaimedJobInput[],
    finalizations: [] as FinalizeClaimedJobInput[],
    async getRequesterJob() {
      result.reads += 1;
      return options.onRead ? options.onRead(result.reads, durable) : durable;
    },
    async transitionClaimedJob(input: TransitionClaimedJobInput) {
      result.transitions.push(input);
      durable = { ...durable, state: "running", step: input.step, updatedAt: NOW };
      await options.onTransition?.(input);
    },
    async finalizeClaimedJob(input: FinalizeClaimedJobInput) {
      result.finalizations.push(input);
      options.onFinalize?.(input);
      durable = {
        ...durable,
        state: "succeeded",
        step: "ready",
        lessonId: input.lessonId ?? LESSON_ID,
        updatedAt: NOW,
      };
      return durable;
    },
  };
  return result;
}

beforeEach(() => vi.restoreAllMocks());

describe("processClaimedLessonCreationJob", () => {
  it.each([false, true])("production dedup only skips providers for a newest transcript with lines: %s", async (studyable) => {
    const client = createMockSupabase({ tables: {
      videos: () => ({ data: video("PRIVATE"), error: null }),
      transcripts: (calls) => ({
        data: calls.some((call) => call.op === "maybeSingle") ? { id: JOB_ID } : [{ id: JOB_ID }],
        error: null,
      }),
      transcript_lines: () => ({ data: studyable ? { id: LESSON_ID } : null, error: null }),
    } });
    vi.mocked(createServiceClient).mockReturnValue(client as unknown as ReturnType<typeof createServiceClient>);
    const dependency = providers({ findExistingLesson: defaultLessonCreationDependencies.findExistingLesson });
    const store = persistence();

    await expect(processClaimedLessonCreationJob(claim(), dependency, store)).resolves.toMatchObject({ state: "succeeded" });
    expect(dependency.fetchCaptions).toHaveBeenCalledTimes(studyable ? 0 : 1);
    expect(store.finalizations).toHaveLength(1);
    expect(store.finalizations[0]?.lessonId).toBe(studyable ? LESSON_ID : null);
    if (!studyable) expect(store.finalizations[0]?.content?.lines).toHaveLength(2);
  });

  it.each(["FREE", "PRIVATE"] as const)(
    "finalizes an existing studyable %s lesson without fetching metadata or captions",
    async (libraryAccess) => {
      const dependency = providers({ findExistingLesson: vi.fn().mockResolvedValue(video(libraryAccess)) });
      const store = persistence();

      const result = await processClaimedLessonCreationJob(claim(), dependency, store);

      expect(result).toMatchObject({ state: "succeeded", step: "ready", lessonId: LESSON_ID });
      expect(dependency.fetchOembed).not.toHaveBeenCalled();
      expect(dependency.fetchCaptions).not.toHaveBeenCalled();
      expect(store.finalizations).toEqual([{
        jobId: JOB_ID,
        requesterId: REQUESTER_ID,
        leaseToken: LEASE_TOKEN,
        lessonId: LESSON_ID,
      }]);
    },
  );

  /**
   * An admin job asks for a FREE/PLUS catalogue lesson. Deduping onto a PRIVATE
   * one publishes nothing, so finishing `succeeded` would report catalogue work
   * that never happened. This early exit only saves the provider calls — the
   * authoritative refusal is in `finalize_lesson_creation_job`, under the
   * advisory lock, because the row can appear after this check has passed.
   */
  it("refuses an admin job deduping onto a private lesson, before any provider call", async () => {
    const dependency = providers({ findExistingLesson: vi.fn().mockResolvedValue(video("PRIVATE")) });
    const store = persistence();

    const error = await processClaimedLessonCreationJob(claim("deduplicating", ADMIN_CLAIM), dependency, store)
      .then(() => null, (thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(LessonCreationPipelineError);
    expect((error as LessonCreationPipelineError).publicErrorCode).toBe("existing_private_lesson");
    expect(store.finalizations).toHaveLength(0);
    expect(dependency.fetchOembed).not.toHaveBeenCalled();
    expect(dependency.fetchCaptions).not.toHaveBeenCalled();
  });

  it("fetches metadata and captions, sanitizes lines, tolerates one furigana failure, and persists once", async () => {
    const dependency = providers();
    vi.mocked(dependency.toFurigana)
      .mockResolvedValueOnce([{ text: "日本語", reading: "にほんご" }])
      .mockRejectedValueOnce(new Error("tokenizer unavailable"));
    const store = persistence();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await processClaimedLessonCreationJob(claim(), dependency, store);

    expect(result).toMatchObject({ state: "succeeded", step: "ready", lessonId: LESSON_ID });
    expect(store.transitions.map((transition) => transition.step)).toEqual([
      "fetching_metadata",
      "fetching_transcript",
      "enriching_furigana",
      "persisting",
    ]);
    expect(store.reads).toBe(5);
    expect(store.finalizations).toHaveLength(1);
    expect(store.finalizations[0]?.lessonId).toBeNull();
    expect(store.finalizations[0]?.content).toEqual({
      title: "A useful lesson",
      thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      source: "youtube_caption",
      lines: [
        {
          startTime: 0,
          endTime: 1.5,
          textJp: "日本語",
          textTranslation: null,
          furiganaJson: [{ text: "日本語", reading: "にほんご" }],
        },
        {
          startTime: 1.5,
          endTime: 3,
          textJp: "を勉強します",
          textTranslation: "Study Japanese",
          furiganaJson: null,
        },
      ],
    } satisfies LessonCreationContent);
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("reports a permanent transcript failure when the caption provider has no usable captions", async () => {
    const dependency = providers({ fetchCaptions: vi.fn().mockResolvedValue(null) });
    const store = persistence();

    await expect(processClaimedLessonCreationJob(claim(), dependency, store)).rejects.toEqual(
      expect.objectContaining<Partial<LessonCreationPipelineError>>({
        publicErrorCode: "transcript_unavailable",
      }),
    );
    expect(store.finalizations).toEqual([]);
  });

  it.each([
    { interruptedAfter: "deduplicating", read: 1, expectedMetadataCalls: 0, expectedCaptionCalls: 0, expectedFuriganaCalls: 0 },
    { interruptedAfter: "fetching_metadata", read: 2, expectedMetadataCalls: 0, expectedCaptionCalls: 0, expectedFuriganaCalls: 0 },
    { interruptedAfter: "fetching_transcript", read: 3, expectedMetadataCalls: 1, expectedCaptionCalls: 0, expectedFuriganaCalls: 0 },
    { interruptedAfter: "enriching_furigana", read: 4, expectedMetadataCalls: 1, expectedCaptionCalls: 1, expectedFuriganaCalls: 0 },
    { interruptedAfter: "persisting", read: 5, expectedMetadataCalls: 1, expectedCaptionCalls: 1, expectedFuriganaCalls: 2 },
  ])(
    "re-reads durable state before $interruptedAfter work and stops a superseded restart",
    async ({ read, expectedMetadataCalls, expectedCaptionCalls, expectedFuriganaCalls }) => {
      const dependency = providers();
      const superseded = {
        ...claim().job,
        state: "failed" as const,
        step: "failed" as const,
        publicErrorCode: "temporary_failure" as const,
      };
      const store = persistence({ onRead: (readNumber, durable) => readNumber === read ? superseded : durable });

      await expect(processClaimedLessonCreationJob(claim(), dependency, store)).rejects.toBeInstanceOf(
        InvalidLessonCreationStoreDataError,
      );
      expect(dependency.fetchOembed).toHaveBeenCalledTimes(expectedMetadataCalls);
      expect(dependency.fetchCaptions).toHaveBeenCalledTimes(expectedCaptionCalls);
      expect(dependency.toFurigana).toHaveBeenCalledTimes(expectedFuriganaCalls);
      expect(store.finalizations).toEqual([]);
    },
  );

  it.each([
    "fetching_metadata",
    "fetching_transcript",
    "enriching_furigana",
    "persisting",
  ] as const)("replays idempotently after a process restart at %s", async (durableStep) => {
    const dependency = providers();
    let interrupted = false;
    const store = persistence({
      onTransition(input) {
        if (!interrupted && input.step === durableStep) {
          interrupted = true;
          throw new Error("simulated process interruption after durable transition");
        }
      },
    });

    await expect(processClaimedLessonCreationJob(claim(), dependency, store)).rejects.toThrow(
      "simulated process interruption",
    );
    expect(await store.getRequesterJob(JOB_ID, REQUESTER_ID)).toMatchObject({
      state: "running", step: durableStep,
    });
    expect(store.finalizations).toHaveLength(0);

    const result = await processClaimedLessonCreationJob(claim(durableStep), dependency, store);

    expect(result).toMatchObject({ state: "succeeded", lessonId: LESSON_ID });
    expect(store.finalizations).toHaveLength(1);
  });

  it("uses fixtures containing metadata and caption text only, never video download or media-byte URLs", () => {
    const fixtureStrings = [
      JSON.stringify(claim()),
      JSON.stringify(video("FREE")),
      JSON.stringify({
        title: "A useful lesson",
        thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        captions: [{ startTime: 0, endTime: 1.5, textJp: "日本語" }],
      }),
    ];

    expect(fixtureStrings).toHaveLength(3);
    expect(fixtureStrings.length).toBeGreaterThan(0);
    for (const fixture of fixtureStrings) {
      expect(fixture).not.toMatch(/googlevideo|videoplayback|mime=video|mime=audio|audio_url|video_url|media_url/i);
    }
  });
});

describe("a stalled metadata provider", () => {
  it("stays transient instead of becoming a terminal verdict on the video", async () => {
    // A timeout says nothing about whether the metadata exists. Wrapping it as
    // `metadata_unavailable` would permanently fail the lesson on attempt 1,
    // and the 10s provider timeout makes that reachable.
    const dependencies = providers({
      fetchOembed: vi.fn().mockRejectedValue(
        new TransientLessonCreationProviderError("YouTube oEmbed timed out."),
      ),
    });

    await expect(
      processClaimedLessonCreationJob(claim(), dependencies, persistence()),
    ).rejects.toBeInstanceOf(TransientLessonCreationProviderError);
  });
});
