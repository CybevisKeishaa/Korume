import { type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { WorkspaceProviders, sessionReducer, useCurrentSentence, useMarks, usePlaybackController, usePositionStore, usePreferences, useSession } from "./workspace-context";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));

/** Lets pending request promises and their onSettled callbacks run. */
const flush = () => act(async () => { await Promise.resolve(); });

const BOOTSTRAP: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
  transcript: {
    id: "transcript-1",
    lines: [
      { id: "line-1", index: 0, startTime: 0, endTime: 5, textJp: "一", textTranslation: "one", furigana: null },
      { id: "line-2", index: 1, startTime: 10, endTime: null, textJp: "二", textTranslation: "two", furigana: null },
    ],
  },
  masteryMap: {}, preferences: { ...DEFAULT_PREFERENCES }, resume: { position: 0, lastWatchedAt: null }, lessonBookmarked: false,
  marks: [],
};

function wrapper({ children }: { children: ReactNode }) {
  return <WorkspaceProviders bootstrap={BOOTSTRAP}>{children}</WorkspaceProviders>;
}

beforeEach(() => {
  refresh.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
});

describe("sessionReducer", () => {
  it("uses the workspace view state machine", () => {
    const initial = sessionReducer(undefined, { type: "exit-view" });
    expect(sessionReducer(initial, { type: "toggle-view", view: "focus" }).view).toBe("focus");
    expect(sessionReducer({ ...initial, view: "focus" }, { type: "toggle-view", view: "focus" }).view).toBe("normal");
  });

  it("cycles translation overrides through the persisted mode's opposite", () => {
    const initial = sessionReducer(undefined, { type: "exit-view" });
    const hidden = sessionReducer(initial, { type: "cycle-transcript-translation", persisted: "always" });
    const shown = sessionReducer(hidden, { type: "cycle-transcript-translation", persisted: "always" });
    expect(hidden.transcriptTranslation).toBe("hidden");
    expect(shown.transcriptTranslation).toBe("shown");
    expect(sessionReducer(shown, { type: "cycle-transcript-translation", persisted: "always" }).transcriptTranslation).toBe("follow");
  });

  it("stores a per-line furigana override on the first press and deletes it on the second", () => {
    const initial = sessionReducer(undefined, { type: "exit-view" });
    const revealed = sessionReducer(initial, { type: "toggle-line-furigana", lineId: "a", shownByMode: false });
    expect(revealed.lineFurigana).toEqual({ a: true });
    // The second press ignores shownByMode: the line goes back to whatever its mode says.
    expect(sessionReducer(revealed, { type: "toggle-line-furigana", lineId: "a", shownByMode: true }).lineFurigana).toEqual({});
    expect(sessionReducer(initial, { type: "toggle-line-furigana", lineId: "a", shownByMode: true }).lineFurigana).toEqual({ a: false });
  });

  it("clears scoped session-only overrides", () => {
    const state = {
      ...sessionReducer(undefined, { type: "exit-view" }), transcriptTranslation: "shown" as const,
      lineFurigana: { "line-1": true }, lineTranslationRevealed: { "line-1": true },
    };
    expect(sessionReducer(state, { type: "reset-overrides", scope: "translation" })).toMatchObject({ transcriptTranslation: "follow", lineFurigana: { "line-1": true }, lineTranslationRevealed: {} });
    expect(sessionReducer(state, { type: "reset-overrides", scope: "furigana" })).toMatchObject({ transcriptTranslation: "shown", lineFurigana: {}, lineTranslationRevealed: { "line-1": true } });
    expect(sessionReducer(state, { type: "reset-overrides" })).toMatchObject({ transcriptTranslation: "follow", lineFurigana: {}, lineTranslationRevealed: {} });
  });
});

describe("workspace contexts", () => {
  it("publishes a current sentence only when its sentence position changes", () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return { sentence: useCurrentSentence(), store: usePositionStore() };
    }, { wrapper });

    act(() => { for (let time = 0; time < 5; time += 0.5) result.current.store.set(time); });
    expect(renders).toBe(1);
    act(() => result.current.store.set(5));
    expect(result.current.sentence).toEqual({ index: 0, isSpoken: false });
    expect(renders).toBe(2);
    act(() => result.current.store.set(10));
    expect(result.current.sentence).toEqual({ index: 1, isSpoken: true });
    expect(renders).toBe(3);
  });

  it("updates preferences synchronously, PATCHes one field, and resets matching overrides", async () => {
    const { result } = renderHook(() => ({ preferences: usePreferences(), session: useSession() }), { wrapper });
    act(() => result.current.session[1]({ type: "cycle-transcript-translation", persisted: "always" }));

    act(() => result.current.preferences.setPreference("readingTranslation", "hidden"));

    expect(result.current.preferences.preferences.readingTranslation).toBe("hidden");
    expect(result.current.session[0].transcriptTranslation).toBe("follow");
    expect(fetch).toHaveBeenCalledWith("/api/user/preferences", expect.objectContaining({ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readingTranslation: "hidden" }) }));
    await flush();
  });

  it("clears furigana overrides for a persisted furigana change without persisting quick controls", async () => {
    const { result } = renderHook(() => ({ preferences: usePreferences(), session: useSession() }), { wrapper });
    act(() => result.current.session[1]({ type: "toggle-line-furigana", lineId: "line-1", shownByMode: false }));
    act(() => result.current.session[1]({ type: "cycle-transcript-translation", persisted: "always" }));
    expect(fetch).not.toHaveBeenCalled();

    act(() => result.current.preferences.setPreference("readingFurigana", "always"));

    expect(result.current.session[0].lineFurigana).toEqual({});
    expect(result.current.session[0].transcriptTranslation).toBe("hidden");
    await flush();
  });

  it("rolls back a failed preference only when it is still current", async () => {
    let rejectFirst!: () => void;
    let resolveSecond!: () => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = () => reject(new Error("first")); }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = () => resolve(new Response(null, { status: 200 })); }));
    const { result } = renderHook(() => usePreferences(), { wrapper });

    act(() => { result.current.setPreference("readingTranslation", "hidden"); result.current.setPreference("readingTranslation", "reveal"); });
    await act(async () => { resolveSecond(); });
    await act(async () => { rejectFirst(); });

    expect(result.current.preferences.readingTranslation).toBe("reveal");
  });

  it("uses idempotent mark routes and preserves the second click after a stale rejection", async () => {
    let rejectFirst!: () => void;
    let resolveSecond!: () => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = () => reject(new Error("first")); }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = () => resolve(new Response(null, { status: 200 })); }));
    const { result } = renderHook(() => useMarks(), { wrapper });

    act(() => { result.current.toggleMark("line-1", "bookmark"); result.current.toggleMark("line-1", "bookmark"); });
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/sentence-marks", expect.objectContaining({ method: "PUT", body: JSON.stringify({ transcriptLineId: "line-1", kind: "bookmark" }) }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/sentence-marks", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ transcriptLineId: "line-1", kind: "bookmark" }) }));
    await act(async () => { resolveSecond(); });
    await act(async () => { rejectFirst(); });

    expect(result.current.isMarked("line-1", "bookmark")).toBe(false);
  });

  it("uses the idempotent bookmark route", async () => {
    const { result } = renderHook(() => useMarks(), { wrapper });

    act(() => result.current.toggleLessonBookmark());

    expect(result.current.lessonBookmarked).toBe(true);
    expect(fetch).toHaveBeenCalledWith("/api/videos/video-1/bookmark", expect.objectContaining({ method: "PUT" }));
    await flush();
  });

  it("keeps the last of three clicks when the first, stale request fails last", async () => {
    let rejectFirst!: () => void;
    const settle: Array<() => void> = [];
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = () => reject(new Error("first")); }))
      .mockImplementation(() => new Promise((resolve) => { settle.push(() => resolve(new Response(null, { status: 200 }))); }));
    const { result } = renderHook(() => useMarks(), { wrapper });

    // marked → unmarked → marked: a stale rollback of click 1 would write "unmarked".
    act(() => { for (let click = 0; click < 3; click += 1) result.current.toggleMark("line-1", "bookmark"); });
    await act(async () => { settle.forEach((done) => done()); });
    await act(async () => { rejectFirst(); });
    expect(result.current.isMarked("line-1", "bookmark")).toBe(true);

    vi.mocked(fetch).mockReset();
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = () => reject(new Error("first")); }))
      .mockImplementation(() => new Promise((resolve) => { settle.push(() => resolve(new Response(null, { status: 200 }))); }));
    settle.length = 0;
    act(() => { for (let click = 0; click < 3; click += 1) result.current.toggleLessonBookmark(); });
    await act(async () => { settle.forEach((done) => done()); });
    await act(async () => { rejectFirst(); });
    expect(result.current.lessonBookmarked).toBe(true);
  });

  it("treats a non-2xx response as a failure and rolls back", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
    const marks = renderHook(() => useMarks(), { wrapper });
    act(() => marks.result.current.toggleMark("line-1", "difficult"));
    await flush();
    expect(marks.result.current.isMarked("line-1", "difficult")).toBe(false);

    const preferences = renderHook(() => usePreferences(), { wrapper });
    act(() => preferences.result.current.setPreference("readingWidth", "wide"));
    await flush();
    expect(preferences.result.current.preferences.readingWidth).toBe("normal");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes the router once a write succeeds with nothing newer in flight", async () => {
    const settle: Array<() => void> = [];
    vi.mocked(fetch).mockImplementation(() => new Promise((resolve) => { settle.push(() => resolve(new Response(null, { status: 200 }))); }));
    const { result } = renderHook(() => ({ marks: useMarks(), preferences: usePreferences() }), { wrapper });

    act(() => { result.current.marks.toggleMark("line-1", "bookmark"); result.current.marks.toggleMark("line-1", "bookmark"); });
    await act(async () => { settle[0]!(); });
    expect(refresh).not.toHaveBeenCalled(); // the second click is still in flight
    await act(async () => { settle[1]!(); });
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => result.current.preferences.setPreference("readingWidth", "wide"));
    await act(async () => { settle[2]!(); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("clears a mark mutation's pending state after its request settles", async () => {
    let resolve!: () => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((done) => { resolve = () => done(new Response(null, { status: 200 })); }));
    const { result } = renderHook(() => {
      const marks = useMarks();
      return { marks, pending: marks.pending("mark:line-1:difficult") };
    }, { wrapper });

    act(() => result.current.marks.toggleMark("line-1", "difficult"));
    expect(result.current.pending).toBe(true);
    await act(async () => { resolve(); });

    expect(result.current.pending).toBe(false);
  });

  it("requires the playback controller until the player provider supplies one", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      expect(() => renderHook(() => usePlaybackController(), { wrapper })).toThrow(
        "PlaybackController was not provided to WorkspaceProviders",
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
