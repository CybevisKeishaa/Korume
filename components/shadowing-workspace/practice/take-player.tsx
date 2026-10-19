"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslations } from "@/lib/i18n";
import { PauseGlyph, PlayGlyph } from "../player-glyphs";

function clock(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * A learner's take, played inside the workspace's own look (owner 2026-10-19: the browser's audio bar read as
 * foreign). One button, a seek bar a keyboard can drive, and the time; the <audio> element itself has no controls.
 */
export function TakePlayer({ src, label, onPlay, audioRef }: {
  src: string; label: string; onPlay?(): void;
  /** The toolbar's "Play my take" plays this same element. */
  audioRef?: RefObject<HTMLAudioElement>;
}) {
  const t = useTranslations("shadowing.workspace");
  const own = useRef<HTMLAudioElement>(null);
  const ref = audioRef ?? own;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  useEffect(() => { setPlaying(false); setTime(0); setDuration(0); }, [src]);

  const toggle = () => {
    const audio = ref.current;
    if (!audio) return;
    if (playing) audio.pause();
    else void audio.play().catch(() => undefined);
  };
  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;
  const readout = `${clock(time)} / ${clock(duration)}`;

  return (
    <div className="flex items-center gap-sm rounded-full border border-border bg-muted/50 py-2xs pe-md ps-2xs">
      <audio ref={ref} src={src} preload="metadata" className="hidden"
        onPlay={() => { setPlaying(true); onPlay?.(); }} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onDurationChange={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)} />
      <button type="button" aria-label={playing ? t("player.pause") : label} onClick={toggle}
        className="flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
        {playing ? <PauseGlyph className="size-icon-xs" /> : <PlayGlyph className="size-icon-xs" />}
      </button>
      <input type="range" min={0} max={duration || 0} step={0.01} value={Math.min(time, duration || 0)}
        aria-label={t("practice.pronunciation.position")} aria-valuetext={readout} disabled={!duration}
        onChange={(event) => { const audio = ref.current; if (audio) { audio.currentTime = Number(event.target.value); setTime(audio.currentTime); } }}
        style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, hsl(var(--border)) ${progress}%)` }}
        className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full accent-primary disabled:cursor-default [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary" />
      <span aria-hidden="true" className="shrink-0 text-caption tabular-nums text-muted-foreground">{readout}</span>
    </div>
  );
}
