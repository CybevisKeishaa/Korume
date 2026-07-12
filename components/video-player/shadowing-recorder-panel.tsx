"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecorder, type RecorderState } from "./recorder";
import { Waveform } from "./waveform";
import { PitchContour } from "./pitch-contour";

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
  /** Japanese text of the active line, used only to label the panel for screen readers. */
  lineText?: string;
  className?: string;
}

const SESSION_ENDPOINT = "/api/shadowing/session";

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
  className,
}: ShadowingRecorderPanelProps) {
  const recorder = useRecorder();
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const uploadedBlobRef = useRef<Blob | null>(null);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      setUpload({ status: "uploading" });
      const formData = new FormData();
      formData.append("videoId", videoId);
      formData.append("lineId", lineId);
      formData.append("audio", blob, "recording.webm");

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

  // Auto-upload the moment a take finishes recording (once per blob).
  useEffect(() => {
    if (recorder.state !== "recorded" || !recorder.blob) return;
    if (uploadedBlobRef.current === recorder.blob) return;
    uploadedBlobRef.current = recorder.blob;
    void uploadRecording(recorder.blob);
  }, [recorder.state, recorder.blob, uploadRecording]);

  const isRecording = recorder.state === "recording";
  const isBusy = recorder.state === "requesting-permission" || upload.status === "uploading";

  const handleToggle = useCallback(() => {
    if (isRecording) {
      recorder.stop();
      return;
    }
    setUpload({ status: "idle" });
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
          <PitchContour blob={recorder.blob} />
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
    </div>
  );
}
