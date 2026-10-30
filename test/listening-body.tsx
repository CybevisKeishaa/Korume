import { useLayoutEffect } from "react";
import { vi } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { chunkUnits, grapheme1Units, grapheme4Units, scoreTyping, scoreWordBank, type Range } from "@/lib/dictation/listening-score";
import { displayMap } from "@/lib/dictation/display";
import { normalizeJa } from "@/lib/dictation/normalize";
import type { LineChunks, LineCloze } from "@/lib/dictation/types";
import { graphemes, scoreCloze } from "@/lib/dictation/cloze";
import { ShadowingWorkspaceShell } from "@/components/shadowing-workspace/workspace-shell";
import { useListeningReveal, type ListeningReveal } from "@/components/shadowing-workspace/practice/listening-reveal-context";
import { ListeningModeBody } from "@/components/shadowing-workspace/practice/listening-mode-body";

/**
 * The Listening body's shared test fixtures: a lesson, its chunks, a server that scores with the real scorers, a
 * fetch stub and a commit probe. Each test file keeps its own `vi.mock` calls (navigation, study presence).
 */
export const LINES = {
  // Normalised chunks (scored) and their raw display (shown): `…` is `...` once normalised (P13).
  "line-1": { text: "今日は雨です。でも明日は晴れ…", chunks: ["今日は", "雨です。", "でも", "明日は晴れ..."], display: ["今日は", "雨です。", "でも", "明日は晴れ…"] },
  "line-2": { text: "今日は雨です。", chunks: ["今日は", "雨です。"], display: ["今日は", "雨です。"] },
  "line-3": { text: "ABCの歌です。", chunks: ["ABCの歌です。"], display: ["ABCの歌です。"] },
  // Half-width kana and a full-width "？" are shown as written (P13); ㌘ expands to three base characters.
  "line-4": { text: "ﾃｽﾄはいいです？", chunks: ["テストは", "いいです?"], display: ["ﾃｽﾄは", "いいです？"] },
  "line-5": { text: "砂糖1㌘", chunks: ["砂糖1グラム"], display: ["砂糖1㌘"] },
} as const;
const UNRELIABLE = new Set(["line-3", "line-5"]);
/** kuromoji 助詞/助動詞 ranges over the base, as the server would send them to the scorer. */
const GRAMMAR: Partial<Record<string, Range[]>> = { "line-2": [{ start: 2, end: 3 }, { start: 4, end: 6 }] };
export type LineId = keyof typeof LINES;
/** `textTranslation`: line-1 has one, the others none (spec §3.5: Bản dịch is hidden then). */
export const TRANSLATIONS: Partial<Record<LineId, string>> = { "line-1": "Rain today. But tomorrow, sun…" };
export const lesson: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode 1", channelTitle: null, durationSeconds: 30, jlptLevel: "N3" },
  transcript: { id: "t", lines: (Object.keys(LINES) as LineId[]).map((id, index) => ({
    id, index, startTime: 12 + index * 3, endTime: 15 + index * 3, textJp: LINES[id].text, textTranslation: TRANSLATIONS[id] ?? null, furigana: null,
  })) },
  masteryMap: {}, preferences: DEFAULT_PREFERENCES, resume: null, lessonBookmarked: false, marks: [], notes: { lessonNote: null, sentenceNotes: [] },
};
const chunksOf = (id: LineId): LineChunks => ({
  version: 1, textHash: "a".repeat(64), reliable: !UNRELIABLE.has(id), reason: UNRELIABLE.has(id) ? "latin_or_digit" : null,
  chunks: [...LINES[id].chunks], display: [...LINES[id].display], typingHintUnit: UNRELIABLE.has(id) ? "grapheme4" : "chunk", romaji: `romaji of ${id}`,
});

/** `GET …/cloze` (spec §3.4): line-1 has two blanks, line-2 one, the others none (the no-candidate notice). */
const CLOZE: Partial<Record<LineId, { segments: [string, number | null][]; readings: string[]; blanks: number[] }>> = {
  "line-1": { segments: [["今日は", null], ["雨", 0], ["です。でも", null], ["明日", 1], ["は晴れ…", null]], readings: ["あめ", "あした"], blanks: [2, 6] },
  "line-2": { segments: [["今日は", null], ["雨", 0], ["です。", null]], readings: ["あめ"], blanks: [2] },
};
export const clozeOf = (id: LineId): LineCloze => {
  const c = CLOZE[id] ?? { segments: [[LINES[id].text, null]], readings: [], blanks: [] };
  return { version: 1, textHash: "c".repeat(64), blanks: c.blanks, readings: c.readings,
    segments: c.segments.map(([text, blank]) => ({ text, blank, romaji: blank === null ? "romaji" : "___" })) };
};
function serveCloze(body: AttemptBody): Response {
  const c = clozeOf(body.lineId);
  const blanks = c.segments.flatMap((s) => s.blank === null ? [] : [{ token: 0, surface: s.text, reading: c.readings[s.blank] ?? "" }]);
  if (body.kind === "reveal") return Response.json({ data: { kind: "reveal", answer: LINES[body.lineId].text, chunks: blanks.map((b) => b.surface), display: blanks.map((b) => b.surface) } });
  let start = 0;
  const hinted = blanks.map((b) => {
    const len = graphemes(b.reading);
    const mine = body.hintedUnits.filter((h) => h >= start && h < start + len);
    start += len;
    return mine;
  });
  const scored = scoreCloze(blanks, body.answers as string[], hinted);
  return Response.json({ data: { kind: "submit", ...scored, answer: LINES[body.lineId].text, helped: body.easy === true || body.hintedUnits.length > 0 } });
}

export type AttemptBody = { kind: "submit" | "reveal"; lineId: LineId; chunkOrder?: number[]; hintedUnits: number[] } & Record<string, unknown>;
/** The server's answer to a valid body: the real scorers over the line's normalised chunks or base. */
export function serve(body: AttemptBody): Response {
  const line = LINES[body.lineId];
  if (body.format === "cloze") return serveCloze(body);
  if (body.kind === "reveal") return Response.json({ data: { kind: "reveal", answer: line.text, chunks: line.chunks, display: line.display } });
  if (body.format === "typing") {
    const base = normalizeJa(line.text);
    const units = body.hintUnit === "grapheme1" ? grapheme1Units(base) : body.hintUnit === "grapheme4" ? grapheme4Units(base) : chunkUnits([...line.chunks]);
    const scored = scoreTyping(base, String(body.input), body.hintedUnits.flatMap((i) => units[i] ?? []), GRAMMAR[body.lineId] ?? [], displayMap(line.text));
    return Response.json({ data: { kind: "submit", ...scored, answer: line.text } });
  }
  const scored = scoreWordBank([...line.chunks], body.chunkOrder ?? [], new Set(body.hintedUnits));
  return Response.json({ data: { kind: "submit", ...scored, answer: line.text } });
}

/** `server.attempt` answers POST /api/dictation/attempt; a test swaps it to hold or fail a request. */
export const server = { attempt: (body: AttemptBody): Promise<Response> => Promise.resolve(serve(body)) };
export const fetchMock = vi.fn();
export const calls = (part: string) => fetchMock.mock.calls.filter(([url]) => String(url).includes(part));
export const attemptBodies = () => calls("/api/dictation/attempt").map(([, init]) => JSON.parse(String((init as RequestInit).body)) as AttemptBody);

/** Resets `server.attempt` and stubs fetch with the chunks, attempt and practice-stats routes. */
export function stubListeningFetch() {
  server.attempt = (body) => Promise.resolve(serve(body));
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: RequestInit) => {
    const chunk = String(url).match(/\/api\/lines\/(line-\d)\/chunks$/);
    if (chunk) return Promise.resolve(Response.json({ data: chunksOf(chunk[1] as LineId) }));
    const cloze = String(url).match(/\/api\/lines\/(line-\d)\/cloze$/);
    if (cloze) return Promise.resolve(Response.json({ data: clozeOf(cloze[1] as LineId) }));
    if (String(url) === "/api/dictation/attempt") return server.attempt(JSON.parse(String(init?.body)) as AttemptBody);
    if (String(url).includes("practice-stats")) return Promise.resolve(Response.json({ data: { lineCount: 3, scoredLines: 0, mean: null, lines: {} } }));
    return Promise.resolve(new Response(null, { status: 200 }));
  });
  vi.stubGlobal("fetch", fetchMock);
}

export function slotList() { return document.querySelector<HTMLElement>("ol[aria-label='Your sentence']"); }
export const korume = () => document.querySelector<HTMLImageElement>("[data-mascot-pose^='listening-']");

type Frame = { attempt: number; subtitle: boolean; dock: boolean; filled: number; typed: string | null; answer: boolean; korume: string | null };
/** The reveal context and every commit CommitProbe saw; a test empties `frames` in its own `beforeEach`. */
export const probe: { reveal: ListeningReveal | undefined; frames: Frame[] } = { reveal: undefined, frames: [] };
/**
 * Records a frame on every commit in which the reveal context changed (layout effect, before paint), so "in the
 * same commit" is checked, not only the settled DOM. It does not re-render on other state changes.
 */
function CommitProbe() {
  const reveal = useListeningReveal();
  probe.reveal = reveal;
  useLayoutEffect(() => {
    probe.frames.push({
      attempt: reveal.attempt,
      subtitle: document.querySelector("[data-testid='workspace-subtitle']") !== null,
      dock: document.querySelector("[data-listen-dock]") !== null,
      filled: slotList()?.querySelectorAll("button").length ?? 0,
      typed: document.querySelector<HTMLInputElement>("input[type='text']")?.value ?? null,
      answer: document.querySelector("[data-testid='listening-answer']") !== null,
      korume: korume()?.getAttribute("data-mascot-pose") ?? null,
    });
  });
  return null;
}
export const shell = () => <ShadowingWorkspaceShell bootstrap={lesson}><CommitProbe /><ListeningModeBody /></ShadowingWorkspaceShell>;
