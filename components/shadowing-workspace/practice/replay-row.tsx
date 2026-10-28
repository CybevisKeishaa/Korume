"use client";

import { useTranslations } from "@/lib/i18n";
import { usePlayerWiring } from "../playback-root";
import { useCurrentSentence, usePlaybackController } from "../workspace-context";
import { PracticeGlyph } from "./practice-glyph";

const RATE = "rounded-full px-xs py-2xs text-caption font-semibold aria-pressed:bg-foreground/10 aria-pressed:text-foreground text-muted-foreground";

/** Replays the current sentence from its start. */
export function ReplayAudio() {
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const controller = usePlaybackController();
  const { index } = useCurrentSentence();
  return <button type="button" disabled={index === null} onClick={() => { if (index !== null) controller.seekToSentence(index, { play: true }); }}
    className="inline-flex shrink-0 items-center gap-xs text-body font-semibold text-primary-strong disabled:opacity-50">
    <PracticeGlyph name="listening-replay-audio" />{tl("replay.audio")}
  </button>;
}

/** Loop and the two rates: the player bar's own state, so every placement stays in sync. */
export function ReplayLoopRates() {
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const { loop, toggleLoop, rate, setRate } = usePlayerWiring();
  return <div className="flex shrink-0 items-center gap-xs">
    <button type="button" aria-pressed={loop.enabled} onClick={toggleLoop}
      className="flex flex-col items-center rounded-full px-sm py-2xs text-caption font-semibold text-muted-foreground aria-pressed:bg-primary/15 aria-pressed:text-primary-strong">
      <PracticeGlyph name="listening-loop" />{tl("replay.loop")}
    </button>
    {[0.75, 1].map((value) => <button key={value} type="button" aria-label={tl("replay.rate", { rate: String(value) })} aria-pressed={rate === value} onClick={() => setRate(value)} className={RATE}>{value}×</button>)}
  </div>;
}

/**
 * Replay audio, Loop and the two rates (Figma 123:2835). With the video shown it is a row of the practice panel; in
 * listen-only its two parts live in the player's dock instead (Ruling T1): one component, two placements.
 */
export function ReplayRow() {
  return <div className="flex items-center justify-between gap-sm rounded-full bg-muted px-md py-sm">
    <ReplayAudio />
    <ReplayLoopRates />
  </div>;
}
