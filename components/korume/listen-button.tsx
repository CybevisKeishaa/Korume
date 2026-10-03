"use client";

import { useTranslations } from "@/lib/i18n";
import { useJapaneseVoice } from "./use-japanese-voice";

/**
 * A quick listen with the browser's own Japanese voice — a convenience, not a pronunciation reference. Absent, not
 * disabled, when there is no Japanese voice: no English fallback reading Japanese text (spec §6.1).
 */
export function ListenButton({ text }: { text: string }) {
  const t = useTranslations("companion");
  const voice = useJapaneseVoice();
  if (!voice) return null;
  const speak = () => {
    const synth = window.speechSynthesis;
    // One utterance at a time: a second click restarts instead of queueing behind the first.
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.voice = voice;
    synth.speak(utterance);
  };
  return (
    <button
      type="button"
      onClick={speak}
      className="inline-flex min-h-hit-target items-center gap-2xs rounded-md px-xs text-caption font-medium text-primary-strong hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-xs" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5Z" />
        <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11" />
      </svg>
      {t("ask.listen")}
    </button>
  );
}
