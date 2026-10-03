"use client";

import { useEffect, useState } from "react";

const pickJapanese = (voices: SpeechSynthesisVoice[]) => voices.find((v) => v.lang.toLowerCase().startsWith("ja")) ?? null;

/**
 * The browser's Japanese voice, or null (spec §6.1). Voices load asynchronously in most browsers, so an empty list
 * is not an answer: the hook re-reads on `voiceschanged`. No `speechSynthesis` at all → always null.
 */
export function useJapaneseVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
    if (!synth) return;
    const read = () => setVoice(pickJapanese(synth.getVoices()));
    read();
    synth.addEventListener("voiceschanged", read);
    return () => synth.removeEventListener("voiceschanged", read);
  }, []);
  return voice;
}
