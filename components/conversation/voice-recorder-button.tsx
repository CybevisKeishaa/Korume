"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
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

/**
 * Which `conversation.voiceRecorder.*` catalog entry a non-200 STT response
 * maps to — a key descriptor, not a resolved string, because this is a
 * module-level function and `t()` is only callable from within component
 * render (same shape as `shadowing-recorder-panel.tsx`'s
 * `classifyScoreError`). `notConfigured` is the STT-specific 503 degrade —
 * distinct from `message-bubble.tsx`'s TTS one.
 */
type SttErrorDescriptor =
  | { key: "notConfigured"; unavailable: true }
  | { key: "tooManyWithSeconds"; seconds: string; unavailable: false }
  | { key: "tooManyGeneric"; unavailable: false }
  | { key: "transcribeFailed"; unavailable: false }
  | { key: "genericError"; unavailable: false };

function classifySttError(status: number, retryAfter: string | null): SttErrorDescriptor {
  if (status === 503) return { key: "notConfigured", unavailable: true };
  if (status === 429) {
    return retryAfter
      ? { key: "tooManyWithSeconds", seconds: retryAfter, unavailable: false }
      : { key: "tooManyGeneric", unavailable: false };
  }
  if (status === 422) return { key: "transcribeFailed", unavailable: false };
  return { key: "genericError", unavailable: false };
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
  const t = useTranslations("conversation");
  const tCommon = useTranslations("common");
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
        setMessage(t("voiceRecorder.conversionFailed"));
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
        const descriptor = classifySttError(res.status, res.headers.get("Retry-After"));
        setMessage(
          descriptor.key === "tooManyWithSeconds"
            ? t("voiceRecorder.tooManyWithSeconds", { seconds: descriptor.seconds })
            : t(`voiceRecorder.${descriptor.key}`),
        );
        if (descriptor.unavailable) setUnavailable(true);
      } catch {
        // Reuses common.errors.network (P4) — byte-identical to the network
        // message every other module's fetch-throw path already shows.
        setMessage(tCommon("errors.network"));
      } finally {
        setPhase("idle");
      }
    },
    [onTranscribed, t, tCommon],
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
  if (recorder.state === "requesting-permission") statusMessage = t("voiceRecorder.requestingPermission");
  else if (isRecording) statusMessage = t("voiceRecorder.recording");
  else if (recorder.state === "error" && recorder.error) statusMessage = recorder.error;
  else if (phase === "transcribing") statusMessage = t("voiceRecorder.transcribing");
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
        title={unavailable ? t("voiceRecorder.notConfigured") : undefined}
        className={isRecording ? "bg-danger text-danger-foreground hover:bg-danger/90" : undefined}
      >
        {isRecording ? t("voiceRecorder.stopRecording") : t("voiceRecorder.recordVoiceMessage")}
      </Button>
      <p role="status" className="text-xs text-muted-foreground">
        {statusMessage}
      </p>
    </div>
  );
}
