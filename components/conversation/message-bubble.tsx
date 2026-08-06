"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ConversationMessageRow } from "@/lib/conversation-types";

export interface MessageBubbleProps {
  message: ConversationMessageRow;
  className?: string;
}

type PlayState = "idle" | "loading" | "playing" | "unavailable";

const TTS_ENDPOINT = "/api/speech/tts";

/**
 * Which `conversation.messageBubble.*` catalog entry a non-200 TTS response
 * maps to — a key descriptor, not a resolved string, because this is a
 * module-level function and `t()` is only callable from within component
 * render. `notConfigured` is the TTS-specific 503 degrade — distinct from
 * `voice-recorder-button.tsx`'s STT one.
 */
function classifyTtsError(status: number): { key: "notConfigured" | "tooManyVoice" | "playFailed"; unavailable: boolean } {
  if (status === 503) return { key: "notConfigured", unavailable: true };
  if (status === 429) return { key: "tooManyVoice", unavailable: false };
  return { key: "playFailed", unavailable: false };
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
 *
 * `message.content` is the chat text itself — AI-authored or user-typed
 * CONTENT (spec D8) — and is never localized, only the surrounding chrome is.
 */
export function MessageBubble({ message, className }: MessageBubbleProps) {
  const t = useTranslations("conversation");
  const tCommon = useTranslations("common");
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
        const descriptor = classifyTtsError(res.status);
        setError(t(`messageBubble.${descriptor.key}`));
        setPlayState(descriptor.unavailable ? "unavailable" : "idle");
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
      // BUBBLE-SPECIFIC — distinct from common.errors.network, do not merge
      // (Task 15 audit): "couldn't play that message" is a different failure
      // than the generic network-error text every other module shows.
      setError(t("messageBubble.networkError"));
      setPlayState("idle");
    }
  }, [message.content, t]);

  const isAi = message.role === "ai";

  return (
    <div
      className={cn(
        "max-w-[85%] rounded-lg px-4 py-2 text-sm",
        isAi ? "self-start bg-secondary text-foreground" : "self-end bg-primary/10 text-foreground",
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
              title={playState === "unavailable" ? t("messageBubble.notConfigured") : undefined}
              className="h-7 px-2 text-xs"
            >
              {playState === "loading" ? tCommon("states.loading") : t("messageBubble.play")}
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
            className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-strong"
            title={t("messageBubble.pronunciationScoreTitle")}
          >
            {t("messageBubble.pronunciationLabel")} {Math.round(message.pronunciation_score)}
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
