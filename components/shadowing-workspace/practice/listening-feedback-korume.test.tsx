import { useLayoutEffect } from "react";
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@/test/render";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { scoreWordBank } from "@/lib/dictation/listening-score";
import type { LineChunks } from "@/lib/dictation/types";
import { ShadowingWorkspaceShell } from "../workspace-shell";
import { resetTabWritesForTests } from "../workspace-context";
import { useListeningReveal } from "./listening-reveal-context";
import { ListeningModeBody } from "./listening-mode-body";

vi.mock("@/components/study-time/use-study-presence", () => ({ useStudyPresence: vi.fn() }));
const router = { refresh: vi.fn(), replace: vi.fn() };
let searchParams = new URLSearchParams("line=line-1");
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  useRouter: () => router,
  usePathname: () => "/shadowing/video-1/listening",
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/en/shadowing/video-1/listening", useSearchParams: () => searchParams }));

const LINES = { "line-1": ["今日は", "雨です。"], "line-2": ["でも", "晴れ"] } as const;
type LineId = keyof typeof LINES;
const lesson: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
  transcript: { id: "t", lines: (Object.keys(LINES) as LineId[]).map((id, index) => ({
    id, index, startTime: 12 + index * 3, endTime: 15 + index * 3, textJp: LINES[id].join(""), textTranslation: null, furigana: null,
  })) },
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
};
const chunksOf = (id: LineId): LineChunks => ({
  version: 1, textHash: "a".repeat(64), reliable: true, reason: null, chunks: [...LINES[id]], display: [...LINES[id]], typingHintUnit: "chunk",
});

type AttemptBody = { kind: "submit" | "reveal"; lineId: LineId; chunkOrder?: number[]; hintedUnits: number[] };
function serve(body: AttemptBody): Response {
  const chunks = [...LINES[body.lineId]];
  if (body.kind === "reveal") return Response.json({ data: { kind: "reveal", answer: chunks.join(""), chunks, display: chunks } });
  return Response.json({ data: { kind: "submit", ...scoreWordBank(chunks, body.chunkOrder ?? [], new Set(body.hintedUnits)), answer: chunks.join("") } });
}
let attemptHandler: (body: AttemptBody) => Promise<Response>;
const fetchMock = vi.fn();
/** Holds the next attempt request until the test releases it with the server's real answer. */
function holdAttempt() {
  let held: { body: AttemptBody; done: (response: Response) => void } | null = null;
  attemptHandler = (body) => new Promise((done) => { held = { body, done }; });
  return async () => { await act(async () => { const request = held as unknown as NonNullable<typeof held>; request.done(serve(request.body)); }); };
}

let reveal: ReturnType<typeof useListeningReveal> | undefined;
type Frame = { attempt: number; answer: boolean; korume: string | null };
const frames: Frame[] = [];
const figure = () => document.querySelector<HTMLImageElement>("[data-mascot-pose^='listening-']");
/** Records every commit (layout effect, before paint), as Task 5's probe does, so "in the same commit" is checked. */
function CommitProbe() {
  reveal = useListeningReveal();
  useLayoutEffect(() => {
    frames.push({
      attempt: reveal?.attempt ?? -1,
      answer: document.querySelector("[data-testid='listening-answer']") !== null,
      korume: figure()?.getAttribute("data-mascot-pose") ?? null,
    });
  });
  return null;
}
const shell = () => <ShadowingWorkspaceShell bootstrap={lesson}><CommitProbe /><ListeningModeBody /></ShadowingWorkspaceShell>;
const bank = () => screen.getByRole("list", { name: "Word bank" });
const place = (text: string) => fireEvent.click(within(bank()).getByRole("button", { name: text }));
const check = () => screen.getByRole("button", { name: /^(Check|Checking…)$/ });
const feedback = () => screen.getByTestId("listening-feedback");

async function open(line: LineId = "line-1", format = "word_bank") {
  searchParams = new URLSearchParams(`line=${line}&format=${format}`);
  const view = render(shell());
  if (format === "word_bank") await screen.findByRole("list", { name: "Your sentence" });
  else await screen.findByRole("textbox", { name: "Type what you hear" });
  return view;
}
async function checkPerfect(line: LineId = "line-1") {
  LINES[line].forEach(place);
  fireEvent.click(check());
  await screen.findByTestId("listening-score");
}

let yt: YouTubeStubHandle;
beforeEach(() => {
  yt = installYouTubeStub();
  sessionStorage.clear();
  resetTabWritesForTests();
  router.replace.mockReset();
  frames.length = 0;
  attemptHandler = (body) => Promise.resolve(serve(body));
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const chunk = String(url).match(/\/api\/lines\/(line-\d)\/chunks$/);
    if (chunk) return Promise.resolve(Response.json({ data: chunksOf(chunk[1] as LineId) }));
    if (String(url) === "/api/dictation/attempt") return attemptHandler(JSON.parse(String(init?.body)) as AttemptBody);
    if (String(url).includes("practice-stats")) return Promise.resolve(Response.json({ data: { lineCount: 2, scoredLines: 0, mean: null, lines: {} } }));
    return Promise.resolve(new Response(null, { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

describe("ListeningFeedbackKorume inside the Listening body (P15)", () => {
  it("shows no figure in the first render, while answering, or while a Check is pending", async () => {
    const release = holdAttempt();
    await open();
    expect(figure()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    LINES["line-1"].slice(1).forEach(place);
    expect(figure()).toBeNull();
    fireEvent.click(check());
    expect(check()).toBeDisabled();
    expect(figure()).toBeNull();
    expect(frames.every((frame) => frame.korume === null)).toBe(true);
    await release();
    await screen.findByTestId("listening-score");
    expect(figure()).not.toBeNull();
  });

  it.each([
    ["a 4xx", () => Promise.resolve(Response.json({ error: "invalid" }, { status: 400 }))],
    ["a 5xx", () => Promise.resolve(new Response(null, { status: 500 }))],
    ["a 429", () => Promise.resolve(new Response(null, { status: 429 }))],
    ["a network failure", () => Promise.reject(new TypeError("offline"))],
  ])("shows no figure after %s", async (_name, failure) => {
    attemptHandler = failure;
    await open();
    LINES["line-1"].forEach(place);
    fireEvent.click(check());
    await screen.findByRole("alert");
    expect(figure()).toBeNull();
    expect(frames.every((frame) => frame.korume === null)).toBe(true);
  });

  it("shows joy after a perfect Check, encourage after a perfect but hinted one, and review after Show answer", async () => {
    await open();
    await checkPerfect();
    expect(figure()).toHaveAttribute("data-mascot-pose", "listening-joy");
    expect(figure()?.getAttribute("src")).toContain("happy.png");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Hint" }));
    place("雨です。");
    fireEvent.click(check());
    await screen.findByTestId("listening-score");
    expect(figure()).toHaveAttribute("data-mascot-pose", "listening-encourage");
    expect(figure()?.getAttribute("src")).toContain("neutral.png");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    fireEvent.click(screen.getByRole("button", { name: "Show answer" }));
    await screen.findByTestId("listening-answer");
    expect(figure()).toHaveAttribute("data-mascot-pose", "listening-review");
    expect(figure()?.getAttribute("src")).toContain("thinking.png");
  });

  it("is decorative: no accessible name, outside the live region, and the P14 text is still read", async () => {
    await open();
    await checkPerfect();
    const korume = figure();
    expect(korume).toHaveAttribute("alt", "");
    expect(korume).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
    expect(feedback()).toHaveAttribute("aria-live", "polite");
    expect(feedback().textContent).toBe("You arranged the whole sentence yourself!");
    expect(feedback().contains(korume)).toBe(false);
  });

  it("is gone in the same commit as the concealment on Try again", async () => {
    await open();
    await checkPerfect();
    const before = reveal?.attempt ?? -1;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(frames.find((frame) => frame.attempt === before + 1)).toEqual({ attempt: before + 1, answer: false, korume: null });
    expect(figure()).toBeNull();
  });

  it("is gone in the same commit as the concealment on Next", async () => {
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    await checkPerfect();
    const before = reveal?.attempt ?? -1;
    fireEvent.click(within(screen.getByTestId("practice-panel")).getByRole("button", { name: /^Next sentence/ }));
    await screen.findByText("Slot 1 of 2, empty");
    const first = frames.find((frame) => frame.attempt > before);
    expect(first).toMatchObject({ answer: false, korume: null });
    expect(figure()).toBeNull();
  });

  it("is gone in the same commit as the concealment on a format switch", async () => {
    const view = await open();
    await checkPerfect();
    const before = reveal?.attempt ?? -1;
    searchParams = new URLSearchParams("line=line-1&format=typing");
    view.rerender(shell());
    expect(frames.find((frame) => frame.attempt === before + 1)).toEqual({ attempt: before + 1, answer: false, korume: null });
    expect(figure()).toBeNull();
  });

  it("never shows the figure for a stale attempt's response resolving after a new attempt started", async () => {
    const release = holdAttempt();
    await open();
    LINES["line-1"].forEach(place);
    fireEvent.click(check());
    // Try again's own reset (P11): the held response now belongs to a discarded attempt.
    act(() => reveal?.newAttempt());
    const from = frames.length;
    await release();
    expect(frames.slice(from).every((frame) => frame.korume === null && !frame.answer)).toBe(true);
    expect(figure()).toBeNull();
    expect(screen.queryByTestId("listening-score")).toBeNull();
  });

  it("never shows the figure for a stale response resolving after Next", async () => {
    const release = holdAttempt();
    await open();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    LINES["line-1"].forEach(place);
    fireEvent.click(check());
    fireEvent.click(within(screen.getByTestId("practice-panel")).getByRole("button", { name: /^Next sentence/ }));
    await screen.findByText("Slot 1 of 2, empty");
    const from = frames.length;
    await release();
    expect(frames.slice(from).every((frame) => frame.korume === null)).toBe(true);
    expect(figure()).toBeNull();
  });
});
