import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { assessPronunciation, isSpeechConfigured, type PronunciationAssessmentResult } from "@/lib/speech-scoring";
import { captureShadowScoreMemories } from "@/lib/data/companion";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/speech-scoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/speech-scoring")>();
  return { ...actual, assessPronunciation: vi.fn(), isSpeechConfigured: vi.fn() };
});
// Partial mock: only the Companion capture is stubbed — every other export of
// `lib/data/companion` stays real.
vi.mock("@/lib/data/companion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/companion")>();
  return { ...actual, captureShadowScoreMemories: vi.fn() };
});

import { scorePronunciation } from "./pronunciation";

const SESSION_ID = "c0000000-0000-0000-0000-000000000001";
const LINE_ID = "c0000000-0000-0000-0000-000000000002";
const VIDEO_ID = "c0000000-0000-0000-0000-000000000003";

const RESULT: PronunciationAssessmentResult = {
  recognizedText: "こんにちは",
  pronunciationScore: 88,
  fluencyScore: 76,
  accuracyScore: 91,
  completenessScore: 100,
  words: [],
};

/** Structural stand-in for the uploaded audio — `scorePronunciation` only ever
 * reads `.size` (size validation) and `.arrayBuffer()` (the Azure payload). */
function audioStub(size = 1024): Blob {
  return { size, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Blob;
}

function mockClient(
  tables: Parameters<typeof createMockSupabase>[0]["tables"],
  user: { id: string } | null,
) {
  const supabase = createMockSupabase({ user, tables });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

// `rateLimit` is real and keyed by user id (10/min), so each test uses its own
// user to stay well inside the budget.
let userSeq = 0;
function nextUser() {
  userSeq += 1;
  return { id: `u-pron-${userSeq}` };
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(assessPronunciation).mockReset();
  vi.mocked(isSpeechConfigured).mockReset();
  vi.mocked(captureShadowScoreMemories).mockReset();
  vi.mocked(isSpeechConfigured).mockReturnValue(true);
  vi.mocked(assessPronunciation).mockResolvedValue(RESULT);
});

describe("scorePronunciation", () => {
  it("returns 404 when the session id isn't the caller's own", async () => {
    mockClient({ shadowing_sessions: () => ({ data: null, error: null }) }, nextUser());
    const result = await scorePronunciation({
      audio: audioStub(),
      referenceText: "こんにちは",
      shadowingSessionId: SESSION_ID,
    });
    expect(result).toEqual({ ok: false, status: 404 });
    expect(vi.mocked(captureShadowScoreMemories)).not.toHaveBeenCalled();
  });

  it("persists both scores onto the owned session row", async () => {
    let sessionCalls: QueryCall[] = [];
    mockClient(
      {
        shadowing_sessions: (calls) => {
          sessionCalls = calls;
          if (calls.some((c) => c.op === "update")) return { data: null, error: null };
          return { data: { id: SESSION_ID, video_id: VIDEO_ID, transcript_line_id: LINE_ID }, error: null };
        },
      },
      nextUser(),
    );

    const result = await scorePronunciation({
      audio: audioStub(),
      referenceText: "こんにちは",
      shadowingSessionId: SESSION_ID,
    });

    expect(result).toEqual({ ok: true, data: RESULT });
    const update = sessionCalls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
    expect(update?.values).toEqual({
      pronunciation_score: RESULT.pronunciationScore,
      rhythm_score: RESULT.fluencyScore,
    });
  });

  it("captures shadow-score memories after persisting scores to an owned session", async () => {
    const user = nextUser();
    mockClient(
      {
        shadowing_sessions: (calls) =>
          calls.some((c) => c.op === "update")
            ? { data: null, error: null }
            : { data: { id: SESSION_ID, video_id: VIDEO_ID, transcript_line_id: LINE_ID }, error: null },
      },
      user,
    );

    const result = await scorePronunciation({
      audio: audioStub(),
      referenceText: "こんにちは",
      shadowingSessionId: SESSION_ID,
    });

    expect(result.ok).toBe(true);
    expect(vi.mocked(captureShadowScoreMemories)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(captureShadowScoreMemories)).toHaveBeenCalledWith({
      userId: user.id,
      sessionId: SESSION_ID,
      videoId: VIDEO_ID,
      transcriptLineId: LINE_ID,
      pronunciationScore: RESULT.pronunciationScore,
    });
  });

  it("does not capture when no shadowingSessionId is supplied", async () => {
    // No tables registered: an unregistered `.from()` throws, so this also
    // proves the scoring path touches no session row at all.
    mockClient({}, nextUser());

    const result = await scorePronunciation({ audio: audioStub(), referenceText: "こんにちは" });

    expect(result).toEqual({ ok: true, data: RESULT });
    expect(vi.mocked(captureShadowScoreMemories)).not.toHaveBeenCalled();
  });
});
