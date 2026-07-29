"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TranscriptWithLines, VideoRow } from "@/lib/video-types";
import { PinLineControl } from "./pin-line-control";
import { YouTubePlayer, type YouTubePlayerHandle } from "./youtube-player";

export interface DictationViewProps {
  video: VideoRow;
  /** null when this video has no transcript yet — nothing to dictate against. */
  transcript: TranscriptWithLines | null;
}

/**
 * Mirrors `DictationDiff` from `lib/dictation/types.ts`, the shape returned
 * by `POST /api/dictation/attempt`. Declared locally rather than imported so
 * this client component has zero runtime coupling to server-only dictation
 * code — the same duplication pattern `lib/video-types.ts` uses for DB rows.
 */
interface DictationDiffPart {
  type: "match" | "missing" | "extra" | "wrong";
  expected?: string;
  actual?: string;
}

interface DictationResult {
  accuracy: number;
  diff: DictationDiffPart[];
}

/**
 * Which catalog entry a failed attempt maps to — a descriptor, not a
 * resolved string, because this is a module-level function and `t()` is
 * only callable from within component render (same shape as
 * `vocab-examples-panel.tsx`'s `ErrorDescriptor`). `network` resolves from
 * `common.errors.network` (promoted there in Task 11b — the identical
 * string is needed by 2+ modules, P4); `signIn`/`scoreFailed` resolve from
 * this module's own `dictation.errors.*`.
 */
type AttemptError = { key: "network" } | { key: "signIn" } | { key: "scoreFailed" };

type AttemptOutcome =
  | { ok: true; data: DictationResult }
  | { ok: false; error: AttemptError };

async function submitDictationAttempt(
  videoId: string,
  lineId: string,
  userInput: string,
): Promise<AttemptOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/dictation/attempt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId, lineId, userInput }),
    });
  } catch {
    return { ok: false, error: { key: "network" } };
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: DictationResult; error?: string }
    | null;

  if (!res.ok || !json?.data) {
    return { ok: false, error: { key: res.status === 401 ? "signIn" : "scoreFailed" } };
  }

  return { ok: true, data: json.data };
}

/**
 * One character of the scored diff. Never relies on color alone: each
 * non-match type carries an `aria-hidden` glyph cue plus screen-reader-only
 * text describing what happened.
 */
function DiffChar({ item }: { item: DictationDiffPart }) {
  const t = useTranslations("dictation");
  if (item.type === "wrong") {
    return (
      <span
        data-diff-type="wrong"
        className="rounded bg-danger/10 px-0.5 text-danger-strong underline decoration-wavy decoration-2"
      >
        <span aria-hidden="true">✕</span>
        {item.actual}
        <span className="sr-only">{t("diff.wrongSr", { expected: item.expected ?? "" })}</span>
      </span>
    );
  }
  if (item.type === "missing") {
    return (
      <span
        data-diff-type="missing"
        className="rounded border border-dashed border-accent px-0.5 text-accent-strong"
      >
        <span aria-hidden="true">▢</span>
        {item.expected}
        <span className="sr-only">{t("diff.missingSr")}</span>
      </span>
    );
  }
  if (item.type === "extra") {
    return (
      <span data-diff-type="extra" className="px-0.5 text-muted-foreground line-through">
        {item.actual}
        <span className="sr-only">{t("diff.extraSr")}</span>
      </span>
    );
  }
  return <span data-diff-type="match">{item.expected}</span>;
}

// Must be a `type`, not an `interface` — a type alias gets an implicit
// index signature and is assignable to next-intl's `t(key, values)` values
// parameter (`Record<string, string | number | Date>`) without a cast; an
// `interface` does not, and adding one by hand (`[key: string]: number`)
// silently disables typo checking on the four field names below. Do not
// "tidy" this back to an `interface`.
type DiffCounts = {
  match: number;
  wrong: number;
  missing: number;
  extra: number;
};

/**
 * Returns the raw counts rather than a formatted string — this is a
 * module-level function, and `t()` is only callable from within component
 * render (same shape as Task 10's `BAND_LABEL`/`messageForStatus`). The
 * component formats these via one ICU message (`dictation.diff.summary`)
 * with four named arguments.
 */
function summarizeDiff(diff: DictationDiffPart[]): DiffCounts {
  const counts: DiffCounts = { match: 0, wrong: 0, missing: 0, extra: 0 };
  for (const item of diff) counts[item.type] += 1;
  return counts;
}

/**
 * The dictation loop: play one transcript line with its Japanese text
 * hidden, let the learner type what they hear, score it against
 * `/api/dictation/attempt`, and render the character-level diff.
 */
export function DictationView({ video, transcript }: DictationViewProps) {
  const t = useTranslations("dictation");
  const tCommon = useTranslations("common");
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DictationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const lines = useMemo(() => transcript?.lines ?? [], [transcript]);
  const currentLine = lines[lineIndex] ?? null;

  // On mount, once the player is ready, and whenever the active line
  // changes: cue playback to the line start and clear the previous attempt.
  useEffect(() => {
    if (!playerReady || !currentLine) return;
    playerRef.current?.seekTo(currentLine.start_time);
    playerRef.current?.pause();
    setUserInput("");
    setResult(null);
    setErrorMessage(null);
    setRevealed(false);
  }, [lineIndex, playerReady, currentLine]);

  const handleReady = useCallback(() => setPlayerReady(true), []);

  const handleTick = useCallback(
    (time: number) => {
      if (currentLine?.end_time != null && time >= currentLine.end_time) {
        playerRef.current?.pause();
      }
    },
    [currentLine],
  );

  const handleReplay = useCallback(() => {
    if (!currentLine) return;
    playerRef.current?.seekTo(currentLine.start_time);
    playerRef.current?.play();
  }, [currentLine]);

  const handlePrev = useCallback(() => {
    setLineIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setLineIndex((i) => Math.min(lines.length - 1, i + 1));
  }, [lines.length]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!currentLine || submitting) return;
      setSubmitting(true);
      setErrorMessage(null);
      const outcome = await submitDictationAttempt(video.id, currentLine.id, userInput);
      setSubmitting(false);
      if (!outcome.ok) {
        setErrorMessage(
          outcome.error.key === "network" ? tCommon("errors.network") : t(`errors.${outcome.error.key}`),
        );
        return;
      }
      setResult(outcome.data);
    },
    [currentLine, submitting, userInput, video.id, t, tCommon],
  );

  if (lines.length === 0) {
    return (
      <div className="space-y-4">
        <div className="aspect-video overflow-hidden rounded-lg bg-black">
          <YouTubePlayer
            ref={playerRef}
            videoId={video.youtube_video_id}
            className="h-full w-full"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t("noTranscript.title")}</p>
          <p className="mt-1">{t("noTranscript.body")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="aspect-video overflow-hidden rounded-lg bg-black">
        <YouTubePlayer
          ref={playerRef}
          videoId={video.youtube_video_id}
          className="h-full w-full"
          onReady={handleReady}
          onTick={handleTick}
          tickIntervalMs={200}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t("lineCount", { current: lineIndex + 1, total: lines.length })}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={lineIndex === 0}
          >
            {t("controls.previous")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReplay}>
            {t("controls.replay")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={lineIndex === lines.length - 1}
          >
            {t("controls.next")}
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="dictation-input">{t("inputLabel")}</Label>
          <Input
            id="dictation-input"
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="font-jp mt-1"
            placeholder="こんにちは..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? t("hide") : t("reveal")}
          </Button>
        </div>
      </form>

      {/* The pin control rides with the revealed answer, never beside the
          hidden one: its dialog shows the line's Japanese text, so offering it
          before Reveal would hand the learner a spoiler route around the
          exercise. */}
      {revealed && currentLine && (
        <div className="flex items-start gap-1">
          <p className="font-jp flex-1 rounded-md border border-border bg-muted px-3 py-2 text-base">
            {currentLine.text_jp}
          </p>
          <PinLineControl line={currentLine} />
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-danger-strong">
          {errorMessage}
        </p>
      )}

      <div aria-live="polite">
        {result && (
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p className="text-lg font-semibold">{t("accuracy", { accuracy: result.accuracy })}</p>
            <p className="font-jp text-lg leading-loose" lang="ja">
              {result.diff.map((item, index) => (
                // Diff is a fixed, ordered character array from one scoring
                // response — index is a stable and appropriate key here.
                // eslint-disable-next-line react/no-array-index-key
                <DiffChar key={index} item={item} />
              ))}
            </p>
            <p className="sr-only">{t("diff.summary", summarizeDiff(result.diff))}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li>
                <span aria-hidden="true">✕</span> {t("legend.wrong")}
              </li>
              <li>
                <span aria-hidden="true">▢</span> {t("legend.missing")}
              </li>
              <li>
                {t.rich("legend.extra", {
                  strike: (chunks) => <span className="line-through">{chunks}</span>,
                })}
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
