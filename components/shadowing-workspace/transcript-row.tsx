"use client";

import { memo, useMemo } from "react";
import { useTranslations } from "@/lib/i18n";
import type { ReadingFurigana, SentenceMarkKind } from "@/lib/preferences/options";
import { toTranscriptLineRow, type WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { cn } from "@/lib/utils";
import { MineLineControl } from "@/components/video-player/mine-line-control";
import { PinLineControl } from "@/components/video-player/pin-line-control";
import { BookmarkGlyph, FlagGlyph, ReplayGlyph } from "./player-glyphs";
import { furiganaShownByMode, RubySentence } from "./ruby-sentence";

export type RowState = "past" | "current" | "future";
/** `covered` = mode `reveal` and not yet revealed for this line (spec §7.8). */
export type RowTranslation = "shown" | "hidden" | "covered";

export interface TranscriptRowProps {
  line: WorkspaceLine;
  /** The line's position in `lines`: the one index for the number, `data-index`, Replay and auto-follow. */
  position: number;
  number: string;
  state: RowState;
  /** Only meaningful on the current row: false in the gap after it ends. */
  spoken: boolean;
  bookmarked: boolean;
  difficult: boolean;
  bookmarkPending: boolean;
  difficultPending: boolean;
  translation: RowTranslation;
  /** The mode this row's readings follow: `hidden` in the normal view, the persisted mode in Full Transcript. */
  furiganaMode: ReadingFurigana;
  /** This line's session override (`lineFurigana[id]`), undefined when none. */
  furiganaOverride: boolean | undefined;
  full: boolean;
  onReplay(index: number): void;
  onToggleMark(lineId: string, kind: SentenceMarkKind): void;
  onRevealTranslation(lineId: string): void;
  onToggleFurigana(lineId: string, shownByMode: boolean): void;
}

const ACTION = "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

/**
 * One transcript line (Figma `105:3731`, spec §7.6). The row body is a button stretched over the whole row
 * (click = Replay); the translation cover and the actions sit above it. Actions show on hover and keyboard
 * focus but stay in the accessibility tree. Memoised: every prop changes only on a sentence change or a
 * user toggle, so a sentence change re-renders the two rows whose state moved, not all 282.
 */
export const TranscriptRow = memo(function TranscriptRow(props: TranscriptRowProps) {
  const { line, position, number, state, spoken, bookmarked, difficult, translation, furiganaMode, furiganaOverride, full } = props;
  const t = useTranslations("shadowing");
  const row = useMemo(() => toTranscriptLineRow(line), [line]);
  const current = state === "current";
  const japaneseClass = cn(
    full ? "text-heading" : "text-body-lg",
    current ? cn("font-semibold", spoken ? "text-foreground" : "text-foreground/80") : state === "past" ? "text-muted-foreground" : "text-foreground/90",
  );

  return (
    <li
      data-index={position}
      data-state={state}
      data-spoken={current ? spoken : undefined}
      className={cn(
        "group relative rounded-lg border-l-2 py-sm pl-sm pr-xs transition-colors focus-within:bg-muted/60 hover:bg-muted/60",
        current
          ? spoken ? "border-primary bg-primary/10 hover:bg-primary/10 focus-within:bg-primary/10" : "border-primary/50 bg-primary/5 hover:bg-primary/5 focus-within:bg-primary/5"
          : "border-transparent",
      )}
    >
      <div className="flex gap-sm">
        <span className={cn("flex shrink-0 flex-col items-center gap-2xs pt-2xs text-caption tabular-nums", current ? "text-primary-strong" : "text-muted-foreground")}>
          <span aria-hidden="true">{number}</span>
          {bookmarked && <BookmarkGlyph filled className="size-icon-xs text-primary-strong" />}
          {bookmarked && <span className="sr-only">{t("workspace.transcript.bookmarked")}</span>}
          {difficult && <FlagGlyph filled className="size-icon-xs text-accent-strong" />}
          {difficult && <span className="sr-only">{t("workspace.transcript.markedDifficult")}</span>}
        </span>
        <div className="min-w-0 flex-1 space-y-2xs">
          <button
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={() => props.onReplay(position)}
            // The ring is drawn on the stretched ::before; drop the global :focus-visible ring so there is one.
            className="block w-full text-left outline-none focus-visible:ring-0 focus-visible:ring-offset-0 before:absolute before:inset-0 before:rounded-lg focus-visible:before:ring-2 focus-visible:before:ring-ring"
          >
            <span className="sr-only">{t("workspace.transcript.lineNumber", { number: position + 1 })} </span>
            {full || furiganaOverride !== undefined ? (
              <RubySentence as="span" segments={line.furigana} text={line.textJp} mode={furiganaMode} override={furiganaOverride} className={cn("block", japaneseClass, "leading-jp")} />
            ) : (
              <span lang="ja" className={cn("block font-jp", japaneseClass)}>{line.textJp}</span>
            )}
          </button>
          {line.textTranslation !== null && translation === "shown" && (
            <p className={cn("relative", full ? "text-body" : "text-caption", current ? "text-foreground/80" : "text-muted-foreground")}>{line.textTranslation}</p>
          )}
          {line.textTranslation !== null && translation === "covered" && (
            <button
              type="button"
              onClick={() => props.onRevealTranslation(line.id)}
              className="relative rounded-md text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t("workspace.transcript.showTranslation")}
            </button>
          )}
        </div>
      </div>
      <div
        role="group"
        aria-label={t("workspace.transcript.actions")}
        // Invisible actions must not take taps (touch has no hover). Not pinned by Mine's status: it is never
        // cleared, so the toolbar would cover the line for the session; Mine returns focus to its trigger instead.
        className={cn(
          "pointer-events-none absolute right-xs top-2xs flex items-start gap-2xs rounded-md bg-card opacity-0 shadow-raised transition-opacity",
          "focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100",
        )}
      >
        <button type="button" aria-label={t("workspace.transcript.replay")} title={t("workspace.transcript.replay")} onClick={() => props.onReplay(position)} className={ACTION}>
          <ReplayGlyph className="size-icon-sm" />
        </button>
        <button
          type="button"
          aria-label={t("workspace.transcript.bookmark")}
          title={t("workspace.transcript.bookmark")}
          aria-pressed={bookmarked}
          aria-disabled={props.bookmarkPending || undefined}
          onClick={() => { if (!props.bookmarkPending) props.onToggleMark(line.id, "bookmark"); }}
          className={ACTION}
        >
          <BookmarkGlyph filled={bookmarked} className="size-icon-sm" />
        </button>
        <button
          type="button"
          aria-label={t("workspace.transcript.difficult")}
          title={t("workspace.transcript.difficult")}
          aria-pressed={difficult}
          aria-disabled={props.difficultPending || undefined}
          onClick={() => { if (!props.difficultPending) props.onToggleMark(line.id, "difficult"); }}
          className={ACTION}
        >
          <FlagGlyph filled={difficult} className="size-icon-sm" />
        </button>
        {line.furigana?.some((segment) => segment.reading) && (
          <button
            type="button"
            aria-label={t("workspace.transcript.lineFurigana")}
            title={t("workspace.transcript.lineFurigana")}
            // Pressed = this line has an override; a second press deletes it (the reducer), back to the mode.
            aria-pressed={furiganaOverride !== undefined}
            onClick={() => props.onToggleFurigana(line.id, furiganaShownByMode(furiganaMode))}
            className={cn(ACTION, "font-jp text-caption")}
          >
            <span aria-hidden="true">あ</span>
          </button>
        )}
        <MineLineControl line={row} />
        <PinLineControl line={row} />
      </div>
    </li>
  );
});
