import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import { createClient } from "@/lib/supabase/server";
import { getMyLessonResume, getVideo, requireUser } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { getVocabMasteryMap } from "@/lib/data/vocab-progress";
import { getMyPreferences } from "@/lib/data/preferences";
import { isLessonBookmarked } from "@/lib/data/lesson-bookmarks";
import { listMySentenceMarks } from "@/lib/data/sentence-marks";
import { loadWorkspaceBootstrap } from "./shadowing-workspace";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/videos", () => ({ getVideo: vi.fn(), getMyLessonResume: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/data/transcripts", () => ({ getTranscript: vi.fn() }));
vi.mock("@/lib/data/vocab-progress", () => ({ getVocabMasteryMap: vi.fn() }));
vi.mock("@/lib/data/preferences", () => ({ getMyPreferences: vi.fn() }));
vi.mock("@/lib/data/lesson-bookmarks", () => ({ isLessonBookmarked: vi.fn() }));
vi.mock("@/lib/data/sentence-marks", () => ({ listMySentenceMarks: vi.fn() }));

const VIDEO = {
  id: "00000000-0000-4000-8000-000000000001", youtube_video_id: "yt-1", title: "Episode 1", duration_seconds: 120,
  thumbnail_url: null, channel_title: "Channel", jlpt_level_estimate: "N3", added_by_user_id: null,
  library_access: "FREE" as const, promotion_starred: false, created_at: "2026-10-01T00:00:00.000Z",
};
const TRANSCRIPT = {
  id: "transcript-1", video_id: VIDEO.id, source: "youtube_caption" as const, language: "ja", created_at: "2026-10-01T00:00:00.000Z",
  lines: [
    { id: "line-b", start_time: 10, end_time: null, text_jp: "後", text_translation: null, furigana_json: [] },
    { id: "line-a", start_time: 2, end_time: 5, text_jp: "前", text_translation: "Before", furigana_json: [] },
  ],
};

function configureFullLoad() {
  vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as never);
  vi.mocked(getVideo).mockResolvedValue({ ok: true, data: VIDEO });
  vi.mocked(getTranscript).mockResolvedValue({ ok: true, data: TRANSCRIPT });
  vi.mocked(getVocabMasteryMap).mockResolvedValue({ 語: 4 });
  vi.mocked(getMyPreferences).mockResolvedValue({ ...DEFAULT_PREFERENCES, readingTranslation: "reveal" });
  vi.mocked(getMyLessonResume).mockResolvedValue({ position: 12, lastWatchedAt: "2026-10-01T01:00:00.000Z" });
  vi.mocked(isLessonBookmarked).mockResolvedValue(true);
  vi.mocked(listMySentenceMarks).mockResolvedValue([{ lineId: "line-a", kind: "bookmark" }]);
}

function expectPlain(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  expect(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype).toBe(true);
  for (const child of Object.values(value)) expectPlain(child);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createClient).mockReturnValue({} as ReturnType<typeof createClient>);
  configureFullLoad();
});

describe("loadWorkspaceBootstrap", () => {
  it("returns 404 before any workspace read for a malformed video id", async () => {
    await expect(loadWorkspaceBootstrap("not-a-uuid")).resolves.toEqual({ ok: false, status: 404 });
    expect(requireUser).not.toHaveBeenCalled();
    expect(getVideo).not.toHaveBeenCalled();
    expect(getTranscript).not.toHaveBeenCalled();
  });

  it("returns 401 before reading workspace data when signed out", async () => {
    vi.mocked(requireUser).mockResolvedValue(null);

    await expect(loadWorkspaceBootstrap(VIDEO.id)).resolves.toEqual({ ok: false, status: 401 });
    expect(getVideo).not.toHaveBeenCalled();
    expect(getTranscript).not.toHaveBeenCalled();
  });

  it("returns 404 when the video is unavailable", async () => {
    vi.mocked(getVideo).mockResolvedValue({ ok: false, status: 404 });

    await expect(loadWorkspaceBootstrap(VIDEO.id)).resolves.toEqual({ ok: false, status: 404 });
  });

  it("keeps the lesson open with no transcript when the transcript read is unavailable", async () => {
    vi.mocked(getTranscript).mockResolvedValue({ ok: false, status: 404 });

    await expect(loadWorkspaceBootstrap(VIDEO.id)).resolves.toMatchObject({ ok: true, data: { transcript: null, marks: [] } });
    expect(listMySentenceMarks).not.toHaveBeenCalled();
  });

  it("keeps a missing transcript null and does not read its marks", async () => {
    vi.mocked(getTranscript).mockResolvedValue({ ok: true, data: null });

    const result = await loadWorkspaceBootstrap(VIDEO.id);

    expect(result).toMatchObject({ ok: true, data: { transcript: null, marks: [] } });
    expect(listMySentenceMarks).not.toHaveBeenCalled();
  });

  it("returns a serializable, canonically ordered bootstrap DTO", async () => {
    const result = await loadWorkspaceBootstrap(VIDEO.id);

    expect(result).toMatchObject({
      ok: true,
      data: {
        userId: "user-1", video: { id: VIDEO.id, jlptLevel: "N3" },
        transcript: { id: TRANSCRIPT.id, lines: [{ id: "line-a", index: 0 }, { id: "line-b", index: 1 }] },
        masteryMap: { 語: 4 }, preferences: { readingTranslation: "reveal" },
        resume: { position: 12, lastWatchedAt: "2026-10-01T01:00:00.000Z" }, lessonBookmarked: true,
        marks: [{ lineId: "line-a", kind: "bookmark" }],
      },
    });
    expect(listMySentenceMarks).toHaveBeenCalledWith(TRANSCRIPT.id);
    if (!result.ok) throw new Error("expected bootstrap");
    expect(structuredClone(result.data)).toEqual(result.data);
    expectPlain(result.data);
    expect(Object.getPrototypeOf(result.data.masteryMap)).toBe(Object.prototype);
  });

  it("falls back to the default preferences when none are stored", async () => {
    vi.mocked(getMyPreferences).mockResolvedValue(null);

    await expect(loadWorkspaceBootstrap(VIDEO.id)).resolves.toMatchObject({ ok: true, data: { preferences: DEFAULT_PREFERENCES } });
  });

  it("narrows an unknown JLPT value to null", async () => {
    vi.mocked(getVideo).mockResolvedValue({ ok: true, data: { ...VIDEO, jlpt_level_estimate: "N0" } });

    await expect(loadWorkspaceBootstrap(VIDEO.id)).resolves.toMatchObject({
      ok: true,
      data: { video: { jlptLevel: null } },
    });
  });
});
