"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

export interface JlptListeningPlayButtonProps {
  text: string;
  className?: string;
}

type PlayState = "idle" | "loading" | "playing" | "unavailable";

const TTS_ENDPOINT = "/api/speech/tts";

/** Maps a non-200 TTS response to a friendly message, flagging 503 as a
 * persistent "not configured" state (never retried again this question). */
function friendlyTtsError(
  status: number,
  t: ReturnType<typeof useTranslations<"jlpt">>,
): { message: string; unavailable: boolean } {
  if (status === 503) return { message: t("listeningPlayButton.notConfigured"), unavailable: true };
  if (status === 429) {
    return { message: t("listeningPlayButton.rateLimited"), unavailable: false };
  }
  return { message: t("listeningPlayButton.genericError"), unavailable: false };
}

/**
 * Listening-question playback control (spec §5.7): lazily synthesizes
 * `text` via `POST /api/speech/tts` and caches the resulting blob URL so
 * replays never re-fetch. Mirrors `components/conversation/message-bubble.tsx`'s
 * TTS handling, incl. the 503 "not configured" degrade — this module doesn't
 * import that component to stay out of the conversation feature's files.
 */
export function JlptListeningPlayButton({ text, className }: JlptListeningPlayButtonProps) {
  const t = useTranslations("jlpt");
  const [playState, setPlayState] = useState<PlayState>("idle");
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handlePlay = useCallback(async () => {
    setError(null);
    if (objectUrlRef.current && audioRef.current) {
      setPlayState("playing");
      void audioRef.current.play();
      return;
    }

    setPlayState("loading");
    try {
      const res = await fetch(TTS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const { message, unavailable } = friendlyTtsError(res.status, t);
        setError(message);
        setPlayState(unavailable ? "unavailable" : "idle");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      if (audioRef.current) {
        audioRef.current.src = url;
        void audioRef.current.play();
      }
      setPlayState("playing");
    } catch {
      setError(t("listeningPlayButton.networkError"));
      setPlayState("idle");
    }
    // `t` intentionally omitted below (stable for the component's lifetime; see the same note in
    // jlpt-timer.tsx).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handlePlay}
        disabled={playState === "loading" || playState === "unavailable"}
        title={playState === "unavailable" ? t("listeningPlayButton.notConfigured") : undefined}
      >
        {playState === "loading"
          ? t("listeningPlayButton.loading")
          : playState === "playing"
            ? t("listeningPlayButton.replay")
            : t("listeningPlayButton.play")}
      </Button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- short synthesized speech clip, no captions to add */}
      <audio ref={audioRef} onEnded={() => setPlayState("idle")} aria-hidden="true" className="hidden" />
      {error && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
