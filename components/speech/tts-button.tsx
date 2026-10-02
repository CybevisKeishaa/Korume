"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type PlayState = "idle" | "loading" | "playing" | "unavailable" | "error";

/**
 * Speaks `text` through `POST /api/speech/tts` on click (the pattern of `jlpt-listening-play-button.tsx`):
 * synthesised once, then replayed from the cached blob. A 503 (TTS not configured) disables it for good with
 * its reason as the visible title. Labels come from the caller, so any feature can use it.
 */
export function TtsButton({ text, label, unavailableLabel, className }: {
  text: string;
  label: string;
  unavailableLabel: string;
  className?: string;
}) {
  const [state, setState] = useState<PlayState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (urlRef.current) {
      setState("playing");
      void audio.play();
      return;
    }
    setState("loading");
    try {
      const response = await fetch("/api/speech/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) return setState(response.status === 503 ? "unavailable" : "error");
      urlRef.current = URL.createObjectURL(await response.blob());
      audio.src = urlRef.current;
      setState("playing");
      void audio.play();
    } catch {
      setState("error");
    }
  }, [text]);

  const unavailable = state === "unavailable";
  return (
    <>
      <button
        type="button"
        aria-label={unavailable ? unavailableLabel : label}
        title={unavailable ? unavailableLabel : label}
        disabled={unavailable || state === "loading"}
        aria-busy={state === "loading" || undefined}
        onClick={() => void play()}
        className={cn(
          "inline-flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-icon-sm">
          <path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
        </svg>
      </button>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- spoken pronunciation of the visible text. */}
      <audio ref={audioRef} onEnded={() => setState("idle")} hidden />
    </>
  );
}
