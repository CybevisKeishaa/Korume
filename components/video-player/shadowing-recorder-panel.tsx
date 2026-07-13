"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PronunciationAssessmentResult } from "@/lib/speech-types";
import { blobToWav16kMono } from "@/lib/audio/blob-to-wav";
import type { PitchAccentScore } from "@/lib/pitch";
import { useRecorder, type RecorderState } from "./recorder";
import { Waveform } from "./waveform";
import { PitchContour } from "./pitch-contour";
import { PitchContourOverlay } from "./pitch-contour-overlay";
import { comparePitchToReference } from "./pitch-comparison";

/** Shape of `data` in the shadowing session API's `201` response. */
export interface SavedRecording {
  id: string;
  recordingPath: string;
  signedUrl: string;
  createdAt: string;
}

type UploadState =
  | { status: "idle" }
  | { status: "uploading" }
  | { status: "success"; recording: SavedRecording }
  | { status: "error"; message: string };

export interface ShadowingRecorderPanelProps {
  /** `videos.id` — passed through to the session API untouched. */
  videoId: string;
  /** `transcript_lines.id` — passed through to the session API untouched. */
  lineId: string;
  /** Japanese text of the active line — labels the panel for screen readers
   * and is the TTS source for the pitch-accent reference contour. */
  lineText?: string;
  /**
   * How long the auto-upload waits for the client-side pitch comparison so
   * the score can be attached at creation (see `lib/data/shadowing.ts`).
   * Past the budget the recording saves without a score — saving the take is
   * core, the pitch score is garnish. Default 3000ms.
   */
  pitchScoreUploadBudgetMs?: number;
  className?: string;
}

const SESSION_ENDPOINT = "/api/shadowing/session";
const SCORE_ENDPOINT = "/api/pronunciation/score";
const SCORE_NOT_CONFIGURED_MESSAGE = "Pronunciation scoring isn't set up yet.";
const DEFAULT_PITCH_SCORE_UPLOAD_BUDGET_MS = 3000;

type ScoreState =
  | { status: "idle" }
  | { status: "scoring" }
  | { status: "ready"; result: PronunciationAssessmentResult }
  | { status: "error"; message: string }
  | { status: "unavailable" };

/** Maps a non-200 pronunciation-score response to a friendly message. 503
 * ("unavailable") persists for the rest of this panel's lifetime instead of
 * being retried, per CLAUDE.md §9's 503-degrade requirement. */
function friendlyScoreError(status: number, retryAfter: string | null): ScoreState {
  if (status === 503) return { status: "unavailable" };
  if (status === 429) {
    return {
      status: "error",
      message: retryAfter
        ? `Too many scoring requests — try again in ${retryAfter}s.`
        : "Too many scoring requests — please wait a moment and try again.",
    };
  }
  if (status === 404) {
    return { status: "error", message: "That recording could no longer be found to score." };
  }
  if (status === 422) {
    return { status: "error", message: "That recording couldn't be scored — try recording again." };
  }
  return { status: "error", message: "Something went wrong scoring your pronunciation." };
}

/** Maps a non-201 session API response to a friendly, non-technical message. */
function friendlyUploadError(status: number, retryAfter: string | null): string {
  if (status === 401) return "Sign in to save your recordings.";
  if (status === 429) {
    return retryAfter
      ? `Too many recordings — try again in ${retryAfter}s.`
      : "Too many recordings — please wait a moment and try again.";
  }
  if (status === 400 || status === 422) {
    return "That recording couldn't be saved. Please try recording again.";
  }
  return "Something went wrong saving your recording.";
}

function describeStatus(
  recorderState: RecorderState,
  recorderError: string | null,
  upload: UploadState,
): string {
  if (recorderState === "requesting-permission") return "Requesting microphone access…";
  if (recorderState === "recording") return "Recording…";
  if (recorderState === "error" && recorderError) return recorderError;
  if (upload.status === "uploading") return "Saving recording…";
  if (upload.status === "success") return "Saved.";
  if (upload.status === "error") return upload.message;
  if (recorderState === "recorded") return "Recording captured.";
  return "";
}

/**
 * Record → auto-upload → playback for the currently active transcript line.
 * Composes `useRecorder` (capture) with `Waveform` (visualize) and POSTs to
 * the shadowing session API as `multipart/form-data`
 * (`{ videoId, lineId, audio }` → `201 { data: SavedRecording }`).
 *
 * Mount one of these per active line (parent should `key` it by line id so
 * switching lines starts a fresh take instead of reusing stale state).
 */
export function ShadowingRecorderPanel({
  videoId,
  lineId,
  lineText,
  pitchScoreUploadBudgetMs = DEFAULT_PITCH_SCORE_UPLOAD_BUDGET_MS,
  className,
}: ShadowingRecorderPanelProps) {
  const recorder = useRecorder();
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [score, setScore] = useState<ScoreState>({ status: "idle" });
  const [pitch, setPitch] = useState<PitchAccentScore | null>(null);
  const uploadedBlobRef = useRef<Blob | null>(null);

  const requestScore = useCallback(async () => {
    if (upload.status !== "success" || !lineText || !recorder.blob) return;
    setScore({ status: "scoring" });

    // Azure's short-audio endpoint accepts WAV/PCM, not webm/opus — convert
    // only the scoring upload; the stored recording stays the original webm.
    let wav: Blob;
    try {
      wav = await blobToWav16kMono(recorder.blob);
    } catch {
      setScore({
        status: "error",
        message: "We couldn't process that recording. Please try again.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("referenceText", lineText);
    formData.append("shadowingSessionId", upload.recording.id);
    formData.append("audio", wav, "recording.wav");

    try {
      const res = await fetch(SCORE_ENDPOINT, { method: "POST", body: formData });
      if (res.status === 200) {
        const json = (await res.json()) as { data: PronunciationAssessmentResult };
        setScore({ status: "ready", result: json.data });
        return;
      }
      setScore(friendlyScoreError(res.status, res.headers.get("Retry-After")));
    } catch {
      setScore({
        status: "error",
        message: "Network error — check your connection and try again.",
      });
    }
  }, [upload, lineText, recorder.blob]);

  const uploadRecording = useCallback(
    async (blob: Blob, pitchScore?: number) => {
      setUpload({ status: "uploading" });
      const formData = new FormData();
      formData.append("videoId", videoId);
      formData.append("lineId", lineId);
      formData.append("audio", blob, "recording.webm");
      if (pitchScore !== undefined) formData.append("pitchScore", String(pitchScore));

      try {
        const res = await fetch(SESSION_ENDPOINT, { method: "POST", body: formData });
        if (res.status === 201) {
          const json = (await res.json()) as { data: SavedRecording };
          setUpload({ status: "success", recording: json.data });
          return;
        }
        setUpload({
          status: "error",
          message: friendlyUploadError(res.status, res.headers.get("Retry-After")),
        });
      } catch {
        setUpload({
          status: "error",
          message: "Network error — check your connection and try again.",
        });
      }
    },
    [videoId, lineId],
  );

  // Auto-upload the moment a take finishes recording (once per blob). The
  // pitch comparison (差別化 #1) starts first so its score can ride along on
  // the session insert (`lib/data/shadowing.ts` accepts it only at creation),
  // but the upload never waits longer than the budget — and the overlay still
  // appears whenever the comparison lands, even after the save.
  useEffect(() => {
    if (recorder.state !== "recorded" || !recorder.blob) return;
    if (uploadedBlobRef.current === recorder.blob) return;
    const blob = recorder.blob;
    uploadedBlobRef.current = blob;

    void (async () => {
      let pitchScore: number | undefined;
      if (lineText) {
        const comparison = comparePitchToReference(blob, lineText).then((result) => {
          // Ignore results for takes that are no longer current.
          if (uploadedBlobRef.current === blob) setPitch(result);
          return result;
        });
        const settled = await Promise.race([
          comparison,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), pitchScoreUploadBudgetMs)),
        ]);
        // A low-confidence 0 is a "couldn't compare", not a real score.
        if (settled && !settled.lowConfidence) pitchScore = settled.score;
      }
      await uploadRecording(blob, pitchScore);
    })();
  }, [recorder.state, recorder.blob, lineText, pitchScoreUploadBudgetMs, uploadRecording]);

  const isRecording = recorder.state === "recording";
  const isBusy = recorder.state === "requesting-permission" || upload.status === "uploading";

  const handleToggle = useCallback(() => {
    if (isRecording) {
      recorder.stop();
      return;
    }
    setUpload({ status: "idle" });
    setPitch(null);
    // A fresh take gets a fresh score, except "unavailable" (503) — once
    // pronunciation scoring is known to be unconfigured, stay disabled for
    // this panel's lifetime instead of retrying a call that will only fail.
    setScore((prev) => (prev.status === "unavailable" ? prev : { status: "idle" }));
    void recorder.start();
  }, [isRecording, recorder]);

  const statusMessage = describeStatus(recorder.state, recorder.error, upload);

  return (
    <div className={cn("space-y-2", className)}>
      {lineText && (
        <h3 className="sr-only">{`Shadowing recorder for "${lineText}"`}</h3>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleToggle}
          disabled={isBusy}
          aria-pressed={isRecording}
          size="sm"
          className={isRecording ? "bg-danger text-white hover:bg-danger/90" : undefined}
        >
          {isRecording ? "Stop recording" : "Record"}
        </Button>
        <p role="status" className="text-xs text-muted-foreground">
          {statusMessage}
        </p>
      </div>

      {recorder.blob && (
        <>
          <Waveform blob={recorder.blob} label="Your recording waveform" />
          {pitch ? (
            <PitchContourOverlay score={pitch} />
          ) : (
            <PitchContour blob={recorder.blob} />
          )}
        </>
      )}

      {upload.status === "success" && (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- user's own short speech clip, no captions to add
        <audio
          controls
          src={upload.recording.signedUrl}
          aria-label="Play your saved recording"
          className="w-full"
        />
      )}

      {upload.status === "success" && lineText && (
        <div className="space-y-2 border-t border-border pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={requestScore}
              disabled={score.status === "scoring" || score.status === "unavailable"}
              title={score.status === "unavailable" ? SCORE_NOT_CONFIGURED_MESSAGE : undefined}
            >
              {score.status === "scoring" ? "Scoring…" : "Score my pronunciation"}
            </Button>
          </div>

          <div aria-live="polite">
            {score.status === "unavailable" && (
              <p className="text-xs text-muted-foreground">{SCORE_NOT_CONFIGURED_MESSAGE}</p>
            )}
            {score.status === "error" && (
              <p role="alert" className="text-xs text-danger">
                {score.message}
              </p>
            )}
            {score.status === "ready" && (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-medium">
                    発音 {Math.round(score.result.pronunciationScore)}
                  </span>
                  <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-medium">
                    リズム {Math.round(score.result.fluencyScore)}
                  </span>
                </div>
                {score.result.words.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Word-level pronunciation">
                    {score.result.words.map((w, i) => (
                      <li key={i}>
                        <span
                          title={`${w.errorType === "None" ? "Correct" : w.errorType} (${Math.round(w.accuracyScore)})`}
                          className={cn(
                            "font-jp rounded px-1.5 py-0.5 text-xs",
                            w.errorType === "None"
                              ? "bg-success/15 text-success"
                              : "bg-danger/15 text-danger",
                          )}
                        >
                          {w.word}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
