"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TranscriptWithLines, VideoRow } from "@/lib/video-types";
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

type AttemptOutcome =
  | { ok: true; data: DictationResult }
  | { ok: false; message: string };

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
    return { ok: false, message: "Network error — check your connection and try again." };
  }

  const json = (await res.json().catch(() => null)) as
    | { data?: DictationResult; error?: string }
    | null;

  if (!res.ok || !json?.data) {
    const message =
      res.status === 401
        ? "Sign in to submit a dictation attempt."
        : "That attempt couldn't be scored. Please try again.";
    return { ok: false, message };
  }

  return { ok: true, data: json.data };
}

/**
 * One character of the scored diff. Never relies on color alone: each
 * non-match type carries an `aria-hidden` glyph cue plus screen-reader-only
 * text describing what happened.
 */
function DiffChar({ item }: { item: DictationDiffPart }) {
  if (item.type === "wrong") {
    return (
      <span
        data-diff-type="wrong"
        className="rounded bg-danger/10 px-0.5 text-danger underline decoration-wavy decoration-2"
      >
        <span aria-hidden="true">✕</span>
        {item.actual}
        <span className="sr-only"> wrong, expected {item.expected}</span>
      </span>
    );
  }
  if (item.type === "missing") {
    return (
      <span
        data-diff-type="missing"
        className="rounded border border-dashed border-accent px-0.5 text-accent"
      >
        <span aria-hidden="true">▢</span>
        {item.expected}
        <span className="sr-only"> missing</span>
      </span>
    );
  }
  if (item.type === "extra") {
    return (
      <span data-diff-type="extra" className="px-0.5 text-muted-foreground line-through">
        {item.actual}
        <span className="sr-only"> extra, not scored</span>
      </span>
    );
  }
  return <span data-diff-type="match">{item.expected}</span>;
}

function summarizeDiff(diff: DictationDiffPart[]): string {
  const counts = { match: 0, wrong: 0, missing: 0, extra: 0 };
  for (const item of diff) counts[item.type] += 1;
  return (
    `${counts.match} correct, ${counts.wrong} wrong, ${counts.missing} missing, ` +
    `${counts.extra} extra characters (extra characters are shown but not scored).`
  );
}

/**
 * The dictation loop: play one transcript line with its Japanese text
 * hidden, let the learner type what they hear, score it against
 * `/api/dictation/attempt`, and render the character-level diff.
 */
export function DictationView({ video, transcript }: DictationViewProps) {
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
        setErrorMessage(outcome.message);
        return;
      }
      setResult(outcome.data);
    },
    [currentLine, submitting, userInput, video.id],
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
          <p className="font-medium text-foreground">No transcript yet</p>
          <p className="mt-1">
            This video doesn&apos;t have a transcript to dictate yet. Transcript submission is
            coming soon.
          </p>
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
          Line {lineIndex + 1} of {lines.length}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={lineIndex === 0}
          >
            Previous line
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleReplay}>
            Replay line
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={lineIndex === lines.length - 1}
          >
            Next line
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <Label htmlFor="dictation-input">Type what you hear (Japanese)</Label>
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
            {submitting ? "Scoring..." : "Submit"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={revealed}
            onClick={() => setRevealed((v) => !v)}
          >
            {revealed ? "Hide answer" : "Reveal answer"}
          </Button>
        </div>
      </form>

      {revealed && (
        <p className="font-jp rounded-md border border-border bg-muted px-3 py-2 text-base">
          {currentLine?.text_jp}
        </p>
      )}

      {errorMessage && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage}
        </p>
      )}

      <div aria-live="polite">
        {result && (
          <div className="space-y-2 rounded-lg border border-border p-4">
            <p className="text-lg font-semibold">{`Accuracy: ${result.accuracy}%`}</p>
            <p className="font-jp text-lg leading-loose" lang="ja">
              {result.diff.map((item, index) => (
                // Diff is a fixed, ordered character array from one scoring
                // response — index is a stable and appropriate key here.
                // eslint-disable-next-line react/no-array-index-key
                <DiffChar key={index} item={item} />
              ))}
            </p>
            <p className="sr-only">{summarizeDiff(result.diff)}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <li>
                <span aria-hidden="true">✕</span> wrong
              </li>
              <li>
                <span aria-hidden="true">▢</span> missing (counted)
              </li>
              <li>
                <span className="line-through">extra</span> — shown, not scored
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
