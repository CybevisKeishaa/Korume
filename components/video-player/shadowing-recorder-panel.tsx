"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PronunciationAssessmentResult, WordPronunciationScore } from "@/lib/speech-types";
import { blobToWav16kMono } from "@/lib/audio/blob-to-wav";
import type { PitchAccentScore } from "@/lib/pitch";
import { ConfirmButton } from "@/components/community/confirm-button";
import { useCompanion } from "@/components/companion/use-companion";
import { useRecorder } from "./recorder";
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
const DEFAULT_PITCH_SCORE_UPLOAD_BUDGET_MS = 3000;

type ScoreState =
  | { status: "idle" }
  | { status: "scoring" }
  | { status: "ready"; result: PronunciationAssessmentResult }
  | { status: "error"; message: string }
  | { status: "unavailable" };

/**
 * Which `shadowing.recorder.score.errors.*` catalog entry a non-200
 * pronunciation-score response maps to. A descriptor, not a resolved string
 * — this is a module-level function and `t()` is only callable from within
 * component render (same shape as `video-summary-panel.tsx`'s
 * `classifySummaryError`, Task 11c). 503 ("unavailable") persists for the
 * rest of this panel's lifetime instead of being retried, per CLAUDE.md §9's
 * 503-degrade requirement, and carries no message to resolve.
 */
type ScoreErrorDescriptor =
  | { key: "rateLimited"; seconds: string }
  | { key: "rateLimitedGeneric" }
  | { key: "notFound" }
  | { key: "invalid" }
  | { key: "generic" };

type ClassifiedScore = { status: "unavailable" } | { status: "error"; descriptor: ScoreErrorDescriptor };

function classifyScoreError(status: number, retryAfter: string | null): ClassifiedScore {
  if (status === 503) return { status: "unavailable" };
  if (status === 429) {
    return {
      status: "error",
      descriptor: retryAfter ? { key: "rateLimited", seconds: retryAfter } : { key: "rateLimitedGeneric" },
    };
  }
  if (status === 404) return { status: "error", descriptor: { key: "notFound" } };
  if (status === 422) return { status: "error", descriptor: { key: "invalid" } };
  return { status: "error", descriptor: { key: "generic" } };
}

/**
 * Which `shadowing.recorder.upload.errors.*` catalog entry a non-201 session
 * API response maps to. Same module-scope-can't-call-t() shape as
 * `classifyScoreError` above.
 */
type UploadErrorDescriptor =
  | { key: "unauthorized" }
  | { key: "rateLimited"; seconds: string }
  | { key: "rateLimitedGeneric" }
  | { key: "invalid" }
  | { key: "generic" };

function classifyUploadError(status: number, retryAfter: string | null): UploadErrorDescriptor {
  if (status === 401) return { key: "unauthorized" };
  if (status === 429) {
    return retryAfter ? { key: "rateLimited", seconds: retryAfter } : { key: "rateLimitedGeneric" };
  }
  if (status === 400 || status === 422) return { key: "invalid" };
  return { key: "generic" };
}

type ShareState =
  | { status: "idle" }
  | { status: "sharing" }
  | { status: "shared"; shareId: string }
  | { status: "error"; message: string };

/**
 * Which `shadowing.recorder.share.errors.*` catalog entry a non-201, non-409
 * peer-review share response maps to (CLAUDE.md §2/§5 — sharing is explicit,
 * revocable consent). 409 (already shared) is handled specially by the
 * caller, not through this descriptor.
 */
type ShareErrorDescriptor =
  | { key: "rateLimited"; seconds: string }
  | { key: "rateLimitedGeneric" }
  | { key: "generic" };

function classifyShareError(status: number, retryAfter: string | null): ShareErrorDescriptor {
  if (status === 429) {
    return retryAfter ? { key: "rateLimited", seconds: retryAfter } : { key: "rateLimitedGeneric" };
  }
  return { key: "generic" };
}

/**
 * `errorType` is the closed union `"None" | "Omission" | "Insertion" |
 * "Mispronunciation"` (`lib/speech-types.ts`). `as const satisfies
 * Record<...>` (rather than annotating the object literal with that type)
 * keeps both exhaustiveness (a new `errorType` member missing here is a type
 * error) and literal string types on the values (so
 * `t(WORD_ERROR_LABEL_KEY[errorType])` type-checks against next-intl's typed
 * keys without a cast) — same pattern as Task 10's `BAND_LABEL_KEY`. `"None"`
 * resolves to "Correct" (the pre-extraction ternary); the other three reuse
 * Azure's own English words verbatim.
 */
const WORD_ERROR_LABEL_KEY = {
  None: "recorder.wordError.none",
  Omission: "recorder.wordError.omission",
  Insertion: "recorder.wordError.insertion",
  Mispronunciation: "recorder.wordError.mispronunciation",
} as const satisfies Record<WordPronunciationScore["errorType"], string>;

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
  const t = useTranslations("shadowing");
  // errors.network is consumed from `common` (promoted there in Task 11b) —
  // the identical string is needed by 2+ modules (P4), so it lives in
  // `common.errors.network`, not duplicated here. This raises that key's
  // consumer count to 3 (vocab-examples-panel, dictation-view, this panel).
  const tCommon = useTranslations("common");
  const recorder = useRecorder();
  // The shadowing route carries NO anchor: emitting is not appearing. The
  // Ambient Layer holds this context (TTL-bounded) until the learner reaches
  // an anchored rest point — the Companion never interrupts the loop (§5.5).
  const companion = useCompanion();
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const [score, setScore] = useState<ScoreState>({ status: "idle" });
  const [pitch, setPitch] = useState<PitchAccentScore | null>(null);
  const [share, setShare] = useState<ShareState>({ status: "idle" });
  const uploadedBlobRef = useRef<Blob | null>(null);

  const shareRecording = useCallback(async () => {
    if (upload.status !== "success") return;
    setShare({ status: "sharing" });
    try {
      const res = await fetch("/api/peer-review/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: upload.recording.id }),
      });
      if (res.status === 201) {
        const json = (await res.json()) as { data: { id: string; createdAt: string } };
        setShare({ status: "shared", shareId: json.data.id });
        return;
      }
      if (res.status === 409) {
        // Already shared (e.g. a stale retry) — treat as shared rather than an error.
        setShare({ status: "shared", shareId: upload.recording.id });
        return;
      }
      const descriptor = classifyShareError(res.status, res.headers.get("Retry-After"));
      setShare({
        status: "error",
        message:
          descriptor.key === "rateLimited"
            ? t("recorder.share.errors.rateLimited", { seconds: descriptor.seconds })
            : t(`recorder.share.errors.${descriptor.key}`),
      });
    } catch {
      setShare({ status: "error", message: tCommon("errors.network") });
    }
  }, [upload, t, tCommon]);

  const revokeShare = useCallback(async () => {
    if (share.status !== "shared") return;
    const shareId = share.shareId;
    try {
      const res = await fetch(`/api/peer-review/shares/${shareId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setShare({ status: "idle" });
        return;
      }
      setShare({ status: "error", message: t("recorder.share.errors.revokeFailed") });
    } catch {
      setShare({ status: "error", message: tCommon("errors.network") });
    }
  }, [share, t, tCommon]);

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
        message: t("recorder.score.conversionFailed"),
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
      const classified = classifyScoreError(res.status, res.headers.get("Retry-After"));
      if (classified.status === "unavailable") {
        setScore({ status: "unavailable" });
        return;
      }
      const { descriptor } = classified;
      setScore({
        status: "error",
        message:
          descriptor.key === "rateLimited"
            ? t("recorder.score.errors.rateLimited", { seconds: descriptor.seconds })
            : t(`recorder.score.errors.${descriptor.key}`),
      });
    } catch {
      setScore({
        status: "error",
        message: tCommon("errors.network"),
      });
    }
  }, [upload, lineText, recorder.blob, t, tCommon]);

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
          companion.emitContext("finished_shadowing");
          return;
        }
        const descriptor = classifyUploadError(res.status, res.headers.get("Retry-After"));
        setUpload({
          status: "error",
          message:
            descriptor.key === "rateLimited"
              ? t("recorder.upload.errors.rateLimited", { seconds: descriptor.seconds })
              : t(`recorder.upload.errors.${descriptor.key}`),
        });
      } catch {
        setUpload({
          status: "error",
          message: tCommon("errors.network"),
        });
      }
    },
    [videoId, lineId, t, tCommon, companion],
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
    setShare({ status: "idle" });
    // A fresh take gets a fresh score, except "unavailable" (503) — once
    // pronunciation scoring is known to be unconfigured, stay disabled for
    // this panel's lifetime instead of retrying a call that will only fail.
    setScore((prev) => (prev.status === "unavailable" ? prev : { status: "idle" }));
    void recorder.start();
  }, [isRecording, recorder]);

  // Which `shadowing.recorder.status.*` catalog entry (or already-resolved
  // pass-through) describes the panel's current state. `recorderError`
  // (`recorder.error`) and `upload.message` are already-translated strings
  // resolved at the point they were set — do not re-wrap them in `t()` here.
  let statusMessage: string;
  if (recorder.state === "requesting-permission") {
    statusMessage = t("recorder.status.requestingPermission");
  } else if (recorder.state === "recording") {
    statusMessage = t("recorder.status.recording");
  } else if (recorder.state === "error" && recorder.error) {
    statusMessage = recorder.error;
  } else if (upload.status === "uploading") {
    statusMessage = t("recorder.status.saving");
  } else if (upload.status === "success") {
    statusMessage = t("recorder.status.saved");
  } else if (upload.status === "error") {
    statusMessage = upload.message;
  } else if (recorder.state === "recorded") {
    statusMessage = t("recorder.status.captured");
  } else {
    statusMessage = "";
  }

  const scoreNotConfiguredMessage = t("recorder.score.notConfigured");

  return (
    <div className={cn("space-y-2", className)}>
      {lineText && (
        <h3 className="sr-only">{t("recorder.a11y.panel", { lineText })}</h3>
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
          {isRecording ? t("recorder.toggle.stop") : t("recorder.toggle.record")}
        </Button>
        <p role="status" className="text-xs text-muted-foreground">
          {statusMessage}
        </p>
      </div>

      {recorder.blob && (
        <>
          <Waveform blob={recorder.blob} label={t("recorder.a11y.waveformLabel")} />
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
          aria-label={t("recorder.a11y.playback")}
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
              title={score.status === "unavailable" ? scoreNotConfiguredMessage : undefined}
            >
              {score.status === "scoring" ? t("recorder.score.actionBusy") : t("recorder.score.action")}
            </Button>
          </div>

          <div aria-live="polite">
            {score.status === "unavailable" && (
              <p className="text-xs text-muted-foreground">{scoreNotConfiguredMessage}</p>
            )}
            {score.status === "error" && (
              <p role="alert" className="text-xs text-danger-strong">
                {score.message}
              </p>
            )}
            {score.status === "ready" && (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-medium">
                    {t("recorder.score.pronunciationLabel")} {Math.round(score.result.pronunciationScore)}
                  </span>
                  <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-medium">
                    {t("recorder.score.fluencyLabel")} {Math.round(score.result.fluencyScore)}
                  </span>
                </div>
                {score.result.words.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5" aria-label={t("recorder.a11y.wordScores")}>
                    {score.result.words.map((w, i) => (
                      <li key={i}>
                        <span
                          title={`${t(WORD_ERROR_LABEL_KEY[w.errorType])} (${Math.round(w.accuracyScore)})`}
                          className={cn(
                            "font-jp rounded px-1.5 py-0.5 text-xs",
                            w.errorType === "None"
                              ? "bg-success/15 text-success-strong"
                              : "bg-danger/15 text-danger-strong",
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

      {upload.status === "success" && (
        <div className="space-y-1.5 border-t border-border pt-2">
          {share.status === "shared" ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-success-strong">{t("recorder.share.shared")}</p>
              <ConfirmButton
                label={t("recorder.share.revoke")}
                confirmLabel={t("recorder.share.revokeConfirm")}
                onConfirm={() => void revokeShare()}
              />
            </div>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void shareRecording()}
                disabled={share.status === "sharing"}
              >
                {share.status === "sharing" ? t("recorder.share.actionBusy") : t("recorder.share.action")}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t("recorder.share.explain")}
              </p>
            </>
          )}
          {share.status === "error" && (
            <p role="alert" className="text-xs text-danger-strong">
              {share.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
