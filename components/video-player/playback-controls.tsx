"use client";

import { cn } from "@/lib/utils";
import type { FuriganaDisplayMode } from "@/lib/video-types";

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

export interface SpeedControlProps {
  value: number;
  onChange: (rate: number) => void;
}

/** Playback-speed picker. A `radiogroup` of toggle buttons, one active at a time. */
export function SpeedControl({ value, onChange }: SpeedControlProps) {
  return (
    <div role="radiogroup" aria-label="Playback speed" className="flex items-center gap-1">
      {SPEEDS.map((speed) => {
        const active = value === speed;
        return (
          <button
            key={speed}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(speed)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {speed}x
          </button>
        );
      })}
    </div>
  );
}

export interface LoopControlsProps {
  loopA: number | null;
  loopB: number | null;
  onSetA: () => void;
  onSetB: () => void;
  onClear: () => void;
}

/** A–B loop controls: set the loop start/end at the current playhead, or clear it. */
export function LoopControls({ loopA, loopB, onSetA, onSetB, onClear }: LoopControlsProps) {
  return (
    <div className="flex items-center gap-1" aria-label="A–B loop">
      <button
        type="button"
        onClick={onSetA}
        aria-pressed={loopA !== null}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          loopA !== null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        Set A{loopA !== null ? ` (${formatTime(loopA)})` : ""}
      </button>
      <button
        type="button"
        onClick={onSetB}
        aria-pressed={loopB !== null}
        className={cn(
          "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          loopB !== null
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:text-foreground",
        )}
      >
        Set B{loopB !== null ? ` (${formatTime(loopB)})` : ""}
      </button>
      {(loopA !== null || loopB !== null) && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Clear loop
        </button>
      )}
    </div>
  );
}

const FURIGANA_MODES: { value: FuriganaDisplayMode; label: string }[] = [
  { value: "adaptive", label: "Adaptive" },
  { value: "all", label: "All" },
  { value: "off", label: "Off" },
];

export interface FuriganaModeControlProps {
  value: FuriganaDisplayMode;
  onChange: (mode: FuriganaDisplayMode) => void;
}

/**
 * Three-state furigana display picker (CLAUDE.md §5.4): "Adaptive" (default)
 * shows a reading only for words the user hasn't mastered yet, "All"/"Off"
 * are the old hard on/off states, kept for readers who want either extreme.
 */
export function FuriganaModeControl({ value, onChange }: FuriganaModeControlProps) {
  return (
    <div role="radiogroup" aria-label="Furigana" className="flex items-center gap-1">
      {FURIGANA_MODES.map((mode) => {
        const active = value === mode.value;
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode.value)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

export interface ToggleButtonProps {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

/** A single labelled on/off toggle (furigana, translation, ...). */
export function ToggleButton({ pressed, onClick, children }: ToggleButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        pressed
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}
