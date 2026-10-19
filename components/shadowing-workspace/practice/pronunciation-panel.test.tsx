import { useState } from "react";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import type { UseRecorderResult } from "@/components/video-player/recorder";
import { PronunciationAttemptsProvider, usePronunciationAttempts } from "./pronunciation-attempts-context";
import { PronunciationModeBody } from "./pronunciation-mode-body";

const mock = vi.hoisted(() => ({
  index: 0, pause: vi.fn(), seek: vi.fn(), refresh: vi.fn(), convert: vi.fn(), pitch: vi.fn(), mark: vi.fn(), drawer: vi.fn(),
  start: vi.fn(), stop: vi.fn(), reset: vi.fn(), change: null as null | ((state: { state: UseRecorderResult["state"]; blob: Blob | null; error: string | null }) => void),
  lines: [] as WorkspaceLine[],
}));
vi.mock("../workspace-context", () => ({
  useLesson: () => ({ video: { id: "video", durationSeconds: 10 }, lines: mock.lines, transcriptId: "transcript" }),
  useCurrentSentence: () => ({ index: mock.index, isSpoken: true }), useStartPosition: () => 0,
  usePlaybackController: () => ({ pause: mock.pause, seekToSentence: mock.seek }),
  useMarks: () => ({ isMarked: () => false, toggleMark: mock.mark, pending: () => false }),
}));
vi.mock("../drawer/drawer-context", () => ({ useOptionalDrawer: () => ({ dispatch: mock.drawer }) }));
vi.mock("next/navigation", async (original) => ({ ...await original<typeof import("next/navigation")>(), useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/en/shadowing/video/pronunciation" }));
vi.mock("../live-sentence", () => ({ LiveSentence: ({ renderSentence }: { renderSentence?: (props: { text: string }) => React.ReactNode }) => renderSentence ? renderSentence({ text: mock.lines[mock.index]?.textJp ?? "" }) : <p>{mock.lines[mock.index]?.textJp}</p> }));
vi.mock("../reading-settings-popover", () => ({ ReadingSettingsPopover: () => null }));
vi.mock("./practice-stats-context", () => ({ usePracticeStats: () => ({ stats: null, refresh: mock.refresh }) }));
vi.mock("@/components/video-player/recorder", () => ({ useRecorder: () => {
  const [state, setState] = useState<{ state: UseRecorderResult["state"]; blob: Blob | null; error: string | null }>({ state: "idle", blob: null, error: null });
  mock.change = setState;
  return { ...state, start: mock.start, stop: mock.stop, reset: mock.reset };
} }));
vi.mock("@/lib/audio/blob-to-wav", () => ({ blobToWav16kMono: mock.convert }));
vi.mock("@/components/video-player/pitch-comparison", () => ({ comparePitchToReference: mock.pitch }));
vi.mock("@/components/video-player/waveform", () => ({ Waveform: () => null }));

const result = { pronunciationScore: 88, rhythmScore: 80, assessment: { v: 1, accuracy: 90, completeness: 100, recognizedText: "日本語", words: [{ word: "日本語", accuracy: 90, errorType: "None" }] } };
const original = new Blob(["webm"], { type: "audio/webm" });
const wav = new Blob(["wav"], { type: "audio/wav" });
const response = (data: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify({ data }), { status, headers });
const historyItem = (state = "unscored", id = "history") => ({ id, state, format: state === "legacy" ? "webm" : "wav", signedUrl: "/take.wav", createdAt: "2026-10-18T00:00:00Z", pronunciationScore: null, rhythmScore: null, pitchScore: null, assessment: null });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function at<T>(items: readonly T[], index: number): T { const item = items[index]; if (item === undefined) throw new Error(`Missing test item ${index}`); return item; }
function Probe() {
  const { attempts, dispatch } = usePronunciationAttempts();
  return <><output data-testid="attempts">{JSON.stringify(attempts)}</output><button onClick={() => dispatch({ type: "discard", lineId: "one" })}>Discard test take</button></>;
}
const tree = (show = true) => <PronunciationAttemptsProvider>{show && <PronunciationModeBody />}<Probe /></PronunciationAttemptsProvider>;
function mount() { return render(tree()); }
async function start() { fireEvent.click(screen.getByRole("button", { name: "Record" })); await act(async () => { await Promise.resolve(); }); }
async function finish() { await act(async () => { mock.change?.({ state: "recorded", blob: original, error: null }); }); }
let fetchMock: ReturnType<typeof vi.fn>;
function posts(url: string) { return fetchMock.mock.calls.filter(([input, init]) => input === url && init?.method === "POST"); }

describe("pronunciation capture, save and score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mock.index = 0;
    mock.lines = ["one", "two"].map((id, index) => ({ id, index, textJp: index ? "次の文" : "日本語", startTime: index * 2, endTime: index * 2 + 2, textTranslation: null, furigana: null }));
    mock.start.mockImplementation(async () => { mock.change?.({ state: "recording", blob: null, error: null }); });
    mock.reset.mockImplementation(() => { mock.change?.({ state: "idle", blob: null, error: null }); });
    mock.convert.mockResolvedValue(wav); mock.pitch.mockResolvedValue(null);
    vi.stubGlobal("MediaRecorder", class {});
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn() } });
    fetchMock = vi.fn(async (url: string) => url.startsWith("/api/shadowing/session?") ? response([])
      : url === "/api/shadowing/session" ? response({ id: "session-one", signedUrl: "/saved.wav" }, 201) : response(result));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("pauses native audio before opening the microphone, converts once, saves WAV then scores only its session", async () => {
    mock.pitch.mockResolvedValue({ score: 77, overlay: [], confidence: 1, lowConfidence: false });
    mount(); await start();
    expect(at(mock.pause.mock.invocationCallOrder, 0)).toBeLessThan(at(mock.start.mock.invocationCallOrder, 0));
    await finish();
    await screen.findByText("Excellent");
    const saves = posts("/api/shadowing/session"); expect(saves).toHaveLength(1);
    const form = at(saves, 0)[1].body as FormData;
    expect(form.get("audio")).toMatchObject({ type: "audio/wav" });
    expect(form.get("pitchScore")).toBe("77"); expect(form.get("lineId")).toBe("one");
    const scores = posts("/api/pronunciation/score"); expect(scores).toHaveLength(1);
    expect(JSON.parse(at(scores, 0)[1].body as string)).toEqual({ sessionId: "session-one" });
    expect(mock.refresh).toHaveBeenCalled(); expect(screen.getByText("88")).toBeVisible();
    expect(document.querySelectorAll("mark[data-error-type]")).toHaveLength(1);
  });
  it("retains the same WAV on save failure, blocks navigation and retries without another recording", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([]) : url.endsWith("/score") ? response(result) : response({}, 500));
    mount(); await start(); await finish();
    fireEvent.click(await screen.findByRole("button", { name: "Save again" }));
    await waitFor(() => expect(posts("/api/shadowing/session")).toHaveLength(2));
    const saves = posts("/api/shadowing/session");
    expect((at(saves, 0)[1].body as FormData).get("audio")).toEqual((at(saves, 1)[1].body as FormData).get("audio"));
    expect(mock.convert).toHaveBeenCalledTimes(1); expect(mock.start).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Sentence 2, not practised" })).toHaveAttribute("aria-disabled", "true");
  });
  it.each([[503, undefined, "Pronunciation scoring is unavailable right now. Your recording is saved."], [429, "12", "Try again in 12 s"], [429, undefined, "Busy, try again shortly"]])("handles score %i and Retry-After %s honestly", async (status, retry, copy) => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([]) : url.endsWith("/score") ? response({}, status, retry ? { "Retry-After": retry } : undefined) : response({ id: "session-one", signedUrl: "/saved.wav" }, 201));
    mount(); await start(); await finish();
    expect(await screen.findByText(copy)).toBeVisible();
    expect(screen.getByRole("button", { name: "Score again" })).toBeVisible();
    expect(screen.queryByText("88")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Play my take", { selector: "audio" })).toHaveAttribute("src", "/saved.wav");
    expect(mock.refresh).toHaveBeenCalled();
  });
  it("refetches 409 state and polls a scoring lease until it becomes retryable", async () => {
    vi.useFakeTimers();
    let history: unknown[] = [];
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response(history) : url.endsWith("/score") ? response({}, 409) : response({ id: "session-one", signedUrl: "/saved.wav" }, 201));
    mount(); await start(); history = [historyItem("scoring", "session-one")]; await finish();
    expect(screen.getByText("Scoring…")).toBeVisible();
    history = [historyItem("unscored", "session-one")];
    await act(async () => { await vi.advanceTimersByTimeAsync(95_000); });
    expect(screen.getByRole("button", { name: "Score again" })).toBeEnabled();
  });
  it("reloads unscored history and retries that session without uploading", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([historyItem()]) : response(result));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Score again" }));
    await waitFor(() => expect(posts("/api/pronunciation/score")).toHaveLength(1));
    expect(JSON.parse(at(posts("/api/pronunciation/score"), 0)[1].body)).toEqual({ sessionId: "history" });
    expect(posts("/api/shadowing/session")).toHaveLength(0);
  });
  it("auto-stops at the sentence take limit and clears the timer on unmount", async () => {
    vi.useFakeTimers(); const view = mount(); await start();
    await act(async () => { await vi.advanceTimersByTimeAsync(6999); }); expect(mock.stop).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(mock.stop).toHaveBeenCalledTimes(1);
    view.unmount(); const count = mock.stop.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); }); expect(mock.stop).toHaveBeenCalledTimes(count);
  });
  it("retains original audio on conversion failure and retries; rejected pitch does not prevent saving", async () => {
    mock.convert.mockRejectedValueOnce(new Error("decode")); mock.pitch.mockRejectedValue(new Error("tts"));
    mount(); await start(); await finish();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await screen.findByText("Excellent");
    expect(mock.convert).toHaveBeenNthCalledWith(2, original, { maxSeconds: 7 }); expect(mock.start).toHaveBeenCalledTimes(1);
  });
  it("saves without pitch after its three-second budget", async () => {
    vi.useFakeTimers(); mock.pitch.mockReturnValue(new Promise(() => undefined));
    mount(); await start(); await finish(); expect(posts("/api/shadowing/session")).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(posts("/api/shadowing/session")).toHaveLength(1);
    expect((at(posts("/api/shadowing/session"), 0)[1].body as FormData).has("pitchScore")).toBe(false);
  });
  it("routes a late save and score to the captured line and never shows it on a new line", async () => {
    const save = deferred<Response>(); const score = deferred<Response>();
    fetchMock.mockImplementation((url: string) => url.includes("?") ? Promise.resolve(response([])) : url.endsWith("/score") ? score.promise : save.promise);
    const view = mount(); await start(); await finish();
    mock.index = 1; view.rerender(<PronunciationAttemptsProvider><PronunciationModeBody /><Probe /></PronunciationAttemptsProvider>);
    await act(async () => { save.resolve(response({ id: "session-one", signedUrl: "/saved.wav" }, 201)); });
    await act(async () => { score.resolve(response(result)); });
    expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}").one.result.pronunciationScore).toBe(88);
    expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
    expect((at(posts("/api/shadowing/session"), 0)[1].body as FormData).get("lineId")).toBe("one");
  });
  it.each([["convert", false], ["save", false], ["convert", true], ["save", true]] as const)("ignores an abandoned same-line %s outcome (rejected=%s) after a new take starts", async (stage, rejected) => {
    const pendingConvert = deferred<Blob>(); const pendingSave = deferred<Response>();
    if (stage === "convert") mock.convert.mockReturnValueOnce(pendingConvert.promise);
    else fetchMock.mockImplementation((url: string) => url.includes("?") ? Promise.resolve(response([])) : pendingSave.promise);
    mount(); await start(); await finish();
    fireEvent.click(screen.getByRole("button", { name: "Discard test take" })); await start();
    await act(async () => {
      if (stage === "convert") { if (rejected) pendingConvert.reject(new Error("old conversion")); else pendingConvert.resolve(wav); }
      else if (rejected) pendingSave.reject(new Error("old save"));
      else pendingSave.resolve(response({ id: "abandoned", signedUrl: "/old.wav" }, 201));
    });
    const attempts = JSON.parse(screen.getByTestId("attempts").textContent ?? "{}");
    expect(attempts.one.phase).toBe("recording"); expect(attempts.one.sessionId).toBeNull();
    expect(posts("/api/pronunciation/score")).toHaveLength(0);
    if (stage === "convert") expect(posts("/api/shadowing/session")).toHaveLength(0);
  });
  it("shows recorder denial and settings guidance without leaving an unsaved lock", async () => {
    mock.start.mockImplementation(async () => { mock.change?.({ state: "error", blob: null, error: "Microphone access was denied." }); });
    mount(); await start();
    expect(screen.getByText("Microphone access was denied.")).toBeVisible();
    expect(screen.getByText(/browser.*microphone|microphone.*browser/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Sentence 2, not practised" })).toHaveAttribute("aria-disabled", "false");
  });
  it("hides the mic on unsupported browsers", async () => {
    vi.stubGlobal("MediaRecorder", undefined); mount();
    await act(async () => { await Promise.resolve(); });
    expect(screen.queryByRole("button", { name: "Record" })).not.toBeInTheDocument();
    expect(screen.getByText(/browser.*recording|recording.*browser/i)).toBeVisible();
  });
  it("preserves a failed-save WAV across mode return and retries without converting", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([]) : response({}, 500));
    const view = mount(); await start(); await finish(); await screen.findByRole("button", { name: "Save again" });
    view.rerender(tree(false)); view.rerender(tree());
    fireEvent.click(await screen.findByRole("button", { name: "Save again" }));
    await waitFor(() => expect(posts("/api/shadowing/session")).toHaveLength(2));
    await act(async () => { await Promise.resolve(); });
    expect(mock.convert).toHaveBeenCalledTimes(1);
    expect(mock.start).toHaveBeenCalledTimes(1);
  });
  it("leaves interrupted conversion retryable with the original, and ignores its old completion", async () => {
    const convert = deferred<Blob>(); mock.convert.mockReturnValueOnce(convert.promise);
    const view = mount(); await start(); await finish(); view.rerender(tree(false));
    expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}").one.phase).toBe("convert-failed");
    view.rerender(tree());
    await act(async () => { convert.resolve(wav); });
    expect(posts("/api/shadowing/session")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Try again" })); await screen.findByText("Excellent");
    expect(mock.convert).toHaveBeenNthCalledWith(2, original, { maxSeconds: 7 });
  });
  it("stores a score after leaving the mode without resurrecting its capture", async () => {
    const score = deferred<Response>();
    fetchMock.mockImplementation((url: string) => url.includes("?") ? Promise.resolve(response([])) : url.endsWith("/score") ? score.promise : Promise.resolve(response({ id: "session-one", signedUrl: "/saved.wav" }, 201)));
    const view = mount(); await start(); await finish(); view.rerender(tree(false));
    await act(async () => { score.resolve(response(result)); });
    expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}").one.phase).toBe("scored");
    expect(mock.refresh).toHaveBeenCalled();
  });
  it("drops a stale history response after changing lines", async () => {
    const history = deferred<Response>();
    fetchMock.mockImplementation((url: string) => url.endsWith("lineId=one") ? history.promise : Promise.resolve(response([])));
    const view = mount(); mock.index = 1; view.rerender(tree());
    await act(async () => { history.resolve(response([{ ...historyItem("scored"), ...result }])); });
    expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("No takes for this sentence yet.")).toBeVisible();
  });
  it("clears the requesting take after microphone is disabled in settings", async () => {
    mock.start.mockImplementation(async () => { mock.change?.({ state: "disabled-in-settings", blob: null, error: "Microphone is turned off in settings." }); });
    mount(); await start();
    expect(screen.getByRole("link", { name: "Open microphone settings" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sentence 2, not practised" })).toHaveAttribute("aria-disabled", "false");
  });
  it("keeps the reference replay, take playback, intonation and bookmark toolbar affordances", async () => {
    mount(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));
    expect(mock.mark).toHaveBeenCalledWith("one", "bookmark");
    const replays = screen.getAllByRole("button", { name: "Replay native" }); expect(replays).toHaveLength(2);
    fireEvent.click(at(replays, 0)); expect(mock.seek).toHaveBeenCalledWith(0, { play: true });
    const playMine = screen.getAllByRole("button", { name: "Play my take" }); expect(playMine).toHaveLength(2);
    for (const button of playMine) expect(button).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Intonation (reference, compared with a synthesized voice)" }));
    expect(screen.getByRole("button", { name: "Details" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("toolbar")).toHaveLength(1);
  });
  it("expires a real Retry-After consistently for primary and history retries", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([historyItem()]) : response({}, 429, { "Retry-After": "12" }));
    mount(); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Score again" })); await act(async () => { await Promise.resolve(); });
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    let retries = screen.getAllByRole("button", { name: "Score again" }); expect(retries).toHaveLength(2);
    for (const retry of retries) expect(retry).toBeDisabled();
    expect(screen.getByText("Try again in 12 s")).toBeVisible();
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    retries = screen.getAllByRole("button", { name: "Score again" }); expect(retries).toHaveLength(2);
    for (const retry of retries) expect(retry).toBeEnabled();
    fireEvent.click(at(retries, 1)); await act(async () => { await Promise.resolve(); });
    expect(posts("/api/pronunciation/score")).toHaveLength(2);
  });
  it("uses the authoritative scored state after 409, including when stored detail is absent", async () => {
    let history: unknown[] = [];
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response(history) : url.endsWith("/score") ? response({}, 409) : response({ id: "session-one", signedUrl: "/saved.wav" }, 201));
    mount(); await start(); history = [{ ...historyItem("scored", "session-one"), pronunciationScore: 65, rhythmScore: null }];
    await finish(); expect(await screen.findByText("Good")).toBeVisible();
    expect(screen.queryByText("Scoring…")).not.toBeInTheDocument();
    expect(screen.getByText(/Overall score only:/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("No detail recorded for this attempt")).toBeVisible();
  });
  it("stops with Escape without allowing the automatic stop to fire again", async () => {
    vi.useFakeTimers(); mount(); await start();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mock.stop).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
    expect(mock.stop).toHaveBeenCalledTimes(1);
  });
  it("does not present a previous take's detail as the current result while recording again", async () => {
    let history: unknown[] = [];
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response(history) : url.endsWith("/score") ? response(result) : response({ id: "session-one", signedUrl: "/saved.wav" }, 201));
    mount(); await start(); history = [{ ...historyItem("scored", "session-one"), ...result }]; await finish();
    await screen.findByText("Excellent");
    fireEvent.click(screen.getByRole("button", { name: "Details" })); expect(screen.getByText("Accuracy")).toBeVisible();
    await start();
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument();
    expect(screen.queryByText("Excellent")).not.toBeInTheDocument();
  });
  it("stops the microphone when a recording take is discarded in place (review I-2)", async () => {
    mount(); await start();
    const resets = mock.reset.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Discard test take" }));
    await act(async () => { await Promise.resolve(); });
    expect(mock.reset.mock.calls.length).toBeGreaterThan(resets);
    expect(screen.getByRole("button", { name: "Record" })).toBeInTheDocument();
  });
  it("lets a save in flight finish after leaving the mode, so Save again never makes a second row (review M-1)", async () => {
    const save = deferred<Response>();
    fetchMock.mockImplementation((url: string) => url.includes("?") ? Promise.resolve(response([])) : url.endsWith("/score") ? Promise.resolve(response(result)) : save.promise);
    const view = mount(); await start(); await finish();
    await waitFor(() => expect(posts("/api/shadowing/session")).toHaveLength(1));
    view.rerender(tree(false));
    expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}").one.phase).toBe("saving");
    await act(async () => { save.resolve(response({ id: "session-one", signedUrl: "/saved.wav" }, 201)); });
    await waitFor(() => expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}").one.phase).toBe("scored"));
    expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}").one.sessionId).toBe("session-one");
    expect(posts("/api/shadowing/session")).toHaveLength(1);
  });
  it("explains a locked sentence change to keyboard and screen reader users (review M-4)", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([]) : response({}, 500));
    mount(); await start(); await finish(); await screen.findByRole("button", { name: "Save again" });
    for (const name of ["Next sentence", "Record"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Finish saving this take first");
    }
    fireEvent.click(screen.getByRole("button", { name: "Next sentence" }));
    expect(mock.seek).not.toHaveBeenCalled();
  });
  it("shows a reloaded take's stored intonation score when the in-memory contour is gone (review M-5)", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([{ ...historyItem("scored", "old"), ...result, pitchScore: 64 }]) : response(result));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Details" }));
    expect(await screen.findByText("Intonation (reference, compared with a synthesized voice)")).toBeVisible();
    expect(screen.getByText("64", { exact: true })).toBeVisible();
  });
  it("offers a way out of a save that keeps failing: Discard take unlocks the mic and the sentence (review M-2)", async () => {
    fetchMock.mockImplementation(async (url: string) => url.includes("?") ? response([]) : response({}, 422));
    mount(); await start(); await finish(); await screen.findByRole("button", { name: "Save again" });
    fireEvent.click(screen.getByRole("button", { name: "Discard take" }));
    expect(JSON.parse(screen.getByTestId("attempts").textContent ?? "{}")).toEqual({});
    expect(screen.getByRole("button", { name: "Record" })).toHaveFocus(); // the button that was clicked is gone (review R-4)
    expect(screen.getByRole("button", { name: "Record" })).not.toHaveAttribute("aria-disabled");
    expect(screen.getByRole("button", { name: "Next sentence" })).not.toHaveAttribute("aria-disabled");
  });
});
