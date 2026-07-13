"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRecorder } from "@/components/video-player/recorder";
import { blobToWav16kMono } from "@/lib/audio/blob-to-wav";
import type { SpeechRecognitionResult } from "@/lib/speech-types";

export interface TranscribedVoiceMessage extends SpeechRecognitionResult {
  /** The recording that produced this transcription — reused for an optional
   * per-utterance pronunciation score once the caller has final text. */
  blob: Blob;
}

export interface VoiceRecorderButtonProps {
  /** Called once STT succeeds for a completed recording. */
  onTranscribed: (result: TranscribedVoiceMessage) => void;
  /** External disable (e.g. the surrounding session has ended). */
  disabled?: boolean;
  className?: string;
}

type Phase = "idle" | "transcribing";

const STT_ENDPOINT = "/api/speech/stt";
const NOT_CONFIGURED_MESSAGE =
  "Voice input isn't set up yet. You can still type your message.";

/** Maps a non-200 STT response to a friendly, non-technical message. */
function friendlySttError(status: number, retryAfter: string | null): { message: string; unavailable: boolean } {
  if (status === 503) return { message: NOT_CONFIGURED_MESSAGE, unavailable: true };
  if (status === 429) {
    return {
      message: retryAfter
        ? `Too many voice requests — try again in ${retryAfter}s.`
        : "Too many voice requests — please wait a moment and try again.",
      unavailable: false,
    };
  }
  if (status === 422) {
    return { message: "That recording couldn't be transcribed. Try again.", unavailable: false };
  }
  return { message: "Something went wrong transcribing your voice. Please try again.", unavailable: false };
}

/**
 * Mic toggle → record (via `useRecorder`) → `POST /api/speech/stt` → reports
 * the recognized text (plus the original blob, for an optional follow-up
 * pronunciation score) to the caller. Never sends the recognized text
 * anywhere itself — the caller (chat composer) always shows it for
 * confirmation before it's treated as a real message.
 *
 * 503-degrades per CLAUDE.md §2/§9: once Azure Speech reports "not
 * configured", the mic button disables itself for the rest of this
 * component's lifetime (with an explanatory `title` tooltip) instead of
 * retrying a call that will only ever fail — text chat is unaffected.
 */
export function VoiceRecorderButton({
  onTranscribed,
  disabled = false,
  className,
}: VoiceRecorderButtonProps) {
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const handledBlobRef = useRef<Blob | null>(null);

  const transcribe = useCallback(
    async (blob: Blob) => {
      setPhase("transcribing");
      setMessage(null);

      // Azure's short-audio endpoint accepts WAV/PCM, not the webm/opus the
      // recorder produces — convert only the uploaded bytes; `blob` itself
      // (handed back via `onTranscribed`) stays the original recording.
      let wav: Blob;
      try {
        wav = await blobToWav16kMono(blob);
      } catch {
        setMessage("We couldn't process that recording. Please try again.");
        setPhase("idle");
        return;
      }

      const formData = new FormData();
      formData.append("audio", wav, "voice-message.wav");

      try {
        const res = await fetch(STT_ENDPOINT, { method: "POST", body: formData });
        if (res.ok) {
          const json = (await res.json()) as { data: SpeechRecognitionResult };
          onTranscribed({ ...json.data, blob });
          setPhase("idle");
          return;
        }
        const { message: friendly, unavailable: nowUnavailable } = friendlySttError(
          res.status,
          res.headers.get("Retry-After"),
        );
        setMessage(friendly);
        if (nowUnavailable) setUnavailable(true);
      } catch {
        setMessage("Network error — check your connection and try again.");
      } finally {
        setPhase("idle");
      }
    },
    [onTranscribed],
  );

  useEffect(() => {
    if (recorder.state !== "recorded" || !recorder.blob) return;
    if (handledBlobRef.current === recorder.blob) return;
    handledBlobRef.current = recorder.blob;
    void transcribe(recorder.blob);
  }, [recorder.state, recorder.blob, transcribe]);

  const isRecording = recorder.state === "recording";
  const isBusy =
    recorder.state === "requesting-permission" || phase === "transcribing";

  const handleToggle = useCallback(() => {
    if (isRecording) {
      recorder.stop();
      return;
    }
    setMessage(null);
    void recorder.start();
  }, [isRecording, recorder]);

  let statusMessage = "";
  if (recorder.state === "requesting-permission") statusMessage = "Requesting microphone access…";
  else if (isRecording) statusMessage = "Recording…";
  else if (recorder.state === "error" && recorder.error) statusMessage = recorder.error;
  else if (phase === "transcribing") statusMessage = "Transcribing…";
  else if (message) statusMessage = message;

  return (
    <div className={cn("inline-flex flex-col gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={disabled || unavailable || isBusy}
        aria-pressed={isRecording}
        title={unavailable ? NOT_CONFIGURED_MESSAGE : undefined}
        className={isRecording ? "bg-danger text-white hover:bg-danger/90" : undefined}
      >
        {isRecording ? "Stop recording" : "Record voice message"}
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {statusMessage}
      </p>
    </div>
  );
}
