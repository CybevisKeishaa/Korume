"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationMessageRow } from "@/lib/conversation-types";

export interface MessageBubbleProps {
  message: ConversationMessageRow;
  className?: string;
}

type PlayState = "idle" | "loading" | "playing" | "unavailable";

const TTS_ENDPOINT = "/api/speech/tts";
const NOT_CONFIGURED_MESSAGE = "Voice playback isn't set up yet.";

/** Maps a non-200 TTS response to a friendly message, flagging 503 as a
 * persistent "not configured" state (never retried again this session). */
function friendlyTtsError(status: number): { message: string; unavailable: boolean } {
  if (status === 503) return { message: NOT_CONFIGURED_MESSAGE, unavailable: true };
  if (status === 429) {
    return { message: "Too many voice requests — try again shortly.", unavailable: false };
  }
  return { message: "Couldn't play that message aloud.", unavailable: false };
}

/**
 * One chat bubble. AI messages get a "Play" button that lazily fetches
 * `POST /api/speech/tts` and caches the resulting blob URL per message so a
 * second click never re-fetches. User messages show a pronunciation-score
 * chip when one was recorded for that utterance (voice mode).
 *
 * 503-degrades: once TTS reports "not configured", the Play button disables
 * itself with an explanatory `title` tooltip instead of retrying — the rest
 * of the chat (text messages) is unaffected.
 */
export function MessageBubble({ message, className }: MessageBubbleProps) {
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
        body: JSON.stringify({ text: message.content }),
      });
      if (!res.ok) {
        const { message: friendly, unavailable } = friendlyTtsError(res.status);
        setError(friendly);
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
      setError("Network error — couldn't play that message.");
      setPlayState("idle");
    }
  }, [message.content]);

  const isAi = message.role === "ai";

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-lg px-4 py-2 text-sm",
        isAi ? "self-start bg-muted text-foreground" : "self-end bg-primary/10 text-foreground",
        className,
      )}
    >
      <p className="font-jp whitespace-pre-wrap">{message.content}</p>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {isAi && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePlay}
              disabled={playState === "loading" || playState === "unavailable"}
              title={playState === "unavailable" ? NOT_CONFIGURED_MESSAGE : undefined}
              className="h-7 px-2 text-xs"
            >
              {playState === "loading" ? "Loading…" : "▶ Play"}
            </Button>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- short synthesized speech clip, no captions to add */}
            <audio
              ref={audioRef}
              onEnded={() => setPlayState("idle")}
              aria-hidden="true"
              className="hidden"
            />
          </>
        )}

        {!isAi && message.pronunciation_score !== null && (
          <span
            className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground"
            title="Pronunciation score for this message"
          >
            発音 {Math.round(message.pronunciation_score)}
          </span>
        )}
      </div>

      {error && (
        <p role="status" className="mt-1 text-xs text-muted-foreground">
          {error}
        </p>
      )}
    </div>
  );
}
