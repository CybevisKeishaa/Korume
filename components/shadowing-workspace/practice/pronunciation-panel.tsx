"use client";

import { useId, useRef } from "react";
import { Square } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { alignWords } from "@/lib/pronunciation/align-words";
import { hasUnsaved } from "@/lib/pronunciation/attempts";
import { REVIEW_PRONUNCIATION_BELOW, STRONG_PRONUNCIATION_AT } from "@/lib/summary/thresholds";
import { LiveSentence } from "../live-sentence";
import { NextGlyph, PreviousGlyph, ReplayGlyph } from "../player-glyphs";
import { useLesson, useMarks, usePlaybackController } from "../workspace-context";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";
import { ScoredSentence } from "./scored-sentence";
import { PronunciationAnalysis } from "./pronunciation-analysis";
import { TakePlayer } from "./take-player";
import type { usePronunciationCapture } from "./use-pronunciation-capture";
import type { usePronunciationSessions } from "./use-pronunciation-sessions";

const ACTION = "inline-flex min-h-control-sm items-center justify-center gap-xs rounded-full border border-border px-sm py-xs text-caption text-muted-foreground hover:bg-muted disabled:opacity-50 aria-disabled:opacity-50";
const ICON_ACTION = "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted aria-pressed:text-primary-strong disabled:opacity-50";
/** Exact Figma vectors as alpha masks: colours follow the shared contrast tokens in either theme. */
function PracticeGlyph({ name, large = false }: { name: "replay-native" | "play-take" | "intonation" | "bookmark" | "microphone"; large?: boolean }) {
  return <span aria-hidden="true" className={`${large ? "size-icon-lg" : "size-icon-sm"} inline-block shrink-0 bg-current`}
    style={{ maskImage: `url(/images/practice/${name}.svg)`, maskSize: "contain", maskRepeat: "no-repeat", maskPosition: "center" }} />;
}
export type PronunciationSessions = ReturnType<typeof usePronunciationSessions>;
export type PronunciationCapture = ReturnType<typeof usePronunciationCapture>;

export function PronunciationPanel({ index, capture, sessions, detailsOpen, detailsId, onToggleDetails }: {
  index: number | null; capture: PronunciationCapture; sessions: PronunciationSessions;
  detailsOpen: boolean; detailsId: string; onToggleDetails(): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.pronunciation");
  const shadowing = useTranslations("shadowing");
  const controller = usePlaybackController();
  const { lines } = useLesson();
  const marks = useMarks();
  const audioRef = useRef<HTMLAudioElement>(null);
  const micRef = useRef<HTMLButtonElement>(null);
  const lockHintId = useId();
  const { attempts, dispatch } = usePronunciationAttempts();
  const { recorder } = capture;
  const { attempt, selected, sessionId, failure, retrySeconds } = sessions;
  const unsaved = hasUnsaved(attempts);
  // Locked, not disabled: the control stays focusable and its description says why (WCAG 4.1.2; title alone is mouse-only).
  const lock = (locked: boolean) => locked ? { "aria-disabled": true as const, "aria-describedby": lockHintId, title: t("finishSaving") } : {};
  const line = index === null ? undefined : lines[index];
  const recording = recorder.state === "recording";
  const requesting = recorder.state === "requesting-permission";
  const busy = requesting || attempt?.phase === "converting" || attempt?.phase === "saving";
  const saved = !!attempt?.sessionId;
  const historyMatches = !attempt || selected?.id === attempt.sessionId;
  const result = attempt?.phase === "scored" ? attempt.result : historyMatches && selected?.state === "scored" ? selected : null;
  const scoring = historyMatches && selected ? selected.state === "scoring" : attempt?.phase === "scoring";
  const score = result?.pronunciationScore;
  const audio = attempt?.signedUrl ?? (historyMatches ? selected?.signedUrl : null);
  const kind = result ? null : failure?.kind ?? (attempt?.phase.startsWith("unscored-") ? attempt.phase.slice(9) : null);
  const canRetry = !scoring && kind !== "unheard" && sessionId !== null && (attempt ? attempt.phase.startsWith("unscored-") : selected?.state === "unscored" || selected?.state === "legacy");
  const label = score != null ? score >= STRONG_PRONUNCIATION_AT ? "excellent" : score < REVIEW_PRONUNCIATION_BELOW ? "keepPractising" : "good" : null;
  const replay = () => { if (index !== null) controller.seekToSentence(index, { play: true }); };
  const playMine = () => { controller.pause(); void audioRef.current?.play().catch(() => undefined); };

  return <div className="space-y-sm">
    <div role="toolbar" aria-label={shadowing("workspace.transcript.actions")} className="flex justify-center gap-xs">
      <button type="button" aria-label={t("replayNative")} disabled={index === null || recording || requesting} onClick={replay} className={ICON_ACTION}><PracticeGlyph name="replay-native" /></button>
      <button type="button" aria-label={t("playMine")} disabled={!audio || recording || requesting} onClick={playMine} className={ICON_ACTION}><PracticeGlyph name="play-take" /></button>
      <button type="button" aria-label={t("intonation")} aria-expanded={detailsOpen} aria-controls={detailsId} onClick={onToggleDetails} className={ICON_ACTION}><PracticeGlyph name="intonation" /></button>
      <button type="button" aria-label={shadowing("workspace.transcript.bookmark")} aria-pressed={line ? marks.isMarked(line.id, "bookmark") : false} disabled={!line || marks.pending(`${line.id}:bookmark`)}
        onClick={() => { if (line) marks.toggleMark(line.id, "bookmark"); }} className={ICON_ACTION}><PracticeGlyph name="bookmark" /></button>
    </div>
    <LiveSentence renderSentence={result ? (props) => <ScoredSentence text={props.text} spans={result.assessment?.words ? alignWords(props.text, result.assessment.words) : null} reading={props} /> : undefined} />
    <div className="flex flex-col items-center gap-sm py-sm">
      {capture.supported ? <button ref={micRef} type="button" aria-label={t(recording ? "stop" : "record")} disabled={index === null} {...lock(busy || (unsaved && !recording))}
        onClick={() => { if (recording) capture.stop(); else if (index !== null && !busy && !unsaved) void capture.start(index); }}
        className="flex size-20 items-center justify-center rounded-full border-8 border-primary/20 bg-muted text-primary-strong hover:bg-primary/10 disabled:opacity-50 aria-disabled:opacity-50">
        {recording ? <Square className="size-icon-lg" aria-hidden="true" /> : <PracticeGlyph name="microphone" large />}
      </button> : <p className="text-caption text-muted-foreground">{shadowing("recorder.errors.notSupported")}</p>}
      <div role="status" aria-live="polite" data-testid="take-status" className="text-center text-body">
        {requesting && <p>{t("requesting")}</p>}
        {recording && <p>{t("recording")}</p>}
        {(attempt?.phase === "converting" || attempt?.phase === "saving") && <p>{t("saving")}</p>}
        {attempt?.phase === "save-failed" && <p>{t("saveFailed")}</p>}
        {attempt?.phase === "convert-failed" && <p>{t("convertFailed")}</p>}
        {scoring && <p>{t("scoring")}</p>}
        {!scoring && kind === "unavailable" && <p>{t("unavailable")}</p>}
        {!scoring && kind === "throttled" && <p>{retrySeconds !== null && retrySeconds > 0 ? t("throttledIn", { seconds: retrySeconds }) : t("throttled")}</p>}
        {!scoring && kind === "unheard" && <p>{t("unheard")}</p>}
        {!scoring && kind === "error" && <p>{t("scoreError")}</p>}
        {label && score != null && <p className="flex items-center justify-center gap-sm"><span className="font-semibold">{t(`label.${label}`)}</span><span className="rounded-full bg-primary px-sm py-2xs text-caption font-bold tabular-nums text-primary-foreground">{Math.round(score)}</span></p>}
      </div>
      {recorder.error && <div role="alert" className="text-center text-caption text-danger-strong"><p>{recorder.error}</p>
        {recorder.state === "error" && <p>{t("micHint")}</p>}
        {recorder.state === "disabled-in-settings" && <Link href="/settings#privacy" className="underline">{shadowing("recorder.errors.disabledInSettingsAction")}</Link>}
      </div>}
      {(attempt?.phase === "save-failed" || attempt?.phase === "convert-failed") && <div className="flex flex-wrap justify-center gap-xs">
        <button type="button" className={ACTION} onClick={() => { if (index !== null) capture.retry(index); }}>{t(attempt.phase === "save-failed" ? "saveAgain" : "convertAgain")}</button>
        {/* A save the server keeps refusing would otherwise lock the mic and the sentence until a link is followed. */}
        <button type="button" className={ACTION} onClick={() => { dispatch({ type: "discard", lineId: attempt.lineId }); micRef.current?.focus(); }}>{t("discardTake")}</button>
      </div>}
      {canRetry && <button type="button" disabled={(!attempt && selected?.format === "webm") || (retrySeconds !== null && retrySeconds > 0)} className={ACTION}
        onClick={() => { if (sessionId && line) void sessions.score(sessionId, line.id); }}>{t("scoreAgain")}</button>}
      {!attempt && selected?.format === "webm" && <p className="text-caption text-muted-foreground">{t("legacy")}</p>}
      <div className="flex flex-wrap justify-center gap-xs">
        <button type="button" disabled={index === null || recording || requesting} onClick={replay} className={ACTION}><ReplayGlyph className="size-icon-xs" />{t("replayNative")}</button>
        <button type="button" disabled={!audio || recording || requesting} onClick={playMine} className={ACTION}><PracticeGlyph name="play-take" />{t("playMine")}</button>
        <button type="button" disabled={index === null || index === 0} {...lock(unsaved)} onClick={() => { if (index !== null && !unsaved) controller.seekToSentence(index - 1); }} className={ACTION}><PreviousGlyph className="size-icon-xs" />{shadowing("workspace.player.previous")}</button>
        <button type="button" disabled={index === null || index >= lines.length - 1} {...lock(unsaved)} onClick={() => { if (index !== null && !unsaved) controller.seekToSentence(index + 1); }} className={ACTION}>{shadowing("workspace.player.next")}<NextGlyph className="size-icon-xs" /></button>
      </div>
      <p id={lockHintId} className="sr-only">{t("finishSaving")}</p>
    </div>
    {audio && (saved || selected) && <TakePlayer src={audio} label={t("playMine")} audioRef={audioRef} onPlay={() => controller.pause()} />}
    {result && line && <PronunciationAnalysis result={result} lineText={line.textJp} onPlayTake={playMine} canPlayTake={!!audio && !recording && !requesting} />}
  </div>;
}
