"use client";

import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { FuriganaDisplayMode } from "@/lib/video-types";

const SPEEDS = [0.5, 0.75, 1, 1.25] as const;

export interface SpeedControlProps {
  value: number;
  onChange: (rate: number) => void;
}

/** Playback-speed picker. A `radiogroup` of toggle buttons, one active at a time. */
export function SpeedControl({ value, onChange }: SpeedControlProps) {
  const t = useTranslations("common");
  return (
    <div
      role="radiogroup"
      aria-label={t("player.a11y.playbackSpeed")}
      className="flex items-center gap-1"
    >
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
  const t = useTranslations("common");
  return (
    <div className="flex items-center gap-1" aria-label={t("player.a11y.abLoop")}>
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
        {t("player.loop.setA")}
        {loopA !== null ? ` (${formatTime(loopA)})` : ""}
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
        {t("player.loop.setB")}
        {loopB !== null ? ` (${formatTime(loopB)})` : ""}
      </button>
      {(loopA !== null || loopB !== null) && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {t("player.loop.clear")}
        </button>
      )}
    </div>
  );
}

/**
 * Furigana mode -> `common.player.furigana.*` catalog key. This used to be
 * the rendered English label itself, in a module-level array — but a
 * module-level constant can't call `t()` (only a component body can), so it
 * holds the catalog key instead, resolved by the sole consumer below.
 *
 * `as const satisfies Record<FuriganaDisplayMode, string>` (rather than
 * annotating the object literal with that type) keeps both properties this
 * needs: exhaustiveness (a new `FuriganaDisplayMode` member missing here is a
 * type error — a 4th mode must not be able to silently lose its label) AND
 * literal string types on the values (so `t(FURIGANA_MODE_KEY[mode])`
 * type-checks against next-intl's typed keys without a cast). Third instance
 * of this pattern, after Task 10's `BAND_LABEL_KEY` and 11b's
 * `summarizeDiff`.
 */
const FURIGANA_MODE_KEY = {
  adaptive: "player.furigana.adaptive",
  all: "player.furigana.all",
  off: "player.furigana.off",
} as const satisfies Record<FuriganaDisplayMode, string>;

/**
 * Derived from `FURIGANA_MODE_KEY`'s own keys rather than re-listed as a
 * second literal array. A second array (`["adaptive", "all", "off"]`
 * annotated `FuriganaDisplayMode[]`) is NOT exhaustiveness-checked by that
 * annotation — TS widens a `string[]`-shaped literal against it without
 * complaint, so a 4th `FuriganaDisplayMode` member could be added to
 * `lib/video-types.ts` and this array would keep compiling, silently
 * rendering no button at all for it (worse than losing just its label).
 * Deriving from the `satisfies`-checked map means there is exactly one
 * source of truth for the closed set, and it inherits that map's
 * exhaustiveness guarantee.
 */
const FURIGANA_MODES = Object.keys(FURIGANA_MODE_KEY) as FuriganaDisplayMode[];

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
  const t = useTranslations("common");
  return (
    <div role="radiogroup" aria-label={t("player.a11y.furigana")} className="flex items-center gap-1">
      {FURIGANA_MODES.map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {t(FURIGANA_MODE_KEY[mode])}
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
