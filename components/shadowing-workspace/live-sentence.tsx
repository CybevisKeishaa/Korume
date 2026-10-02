"use client";

import { useId } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HideTextGlyph, ShowTextGlyph } from "./player-glyphs";
import { RubySentence } from "./ruby-sentence";
import { useCurrentSentence, useLesson, usePreferences, useSession } from "./workspace-context";

// Reading Settings size and leading (globals.css `.reading-*`), on the Text colour preset's surface.
const JAPANESE = "reading-jp-heading-lg";
const TRANSLATION = "reading-latin-body";

/**
 * Live Sentence (Figma `105:3654`, spec §7.5): the current line, large, with readings and its translation.
 * The hide toggle is a session-only listening-recall aid: it hides only the Japanese, never pauses and never
 * writes a preference. The card keeps its height through an intro, a hidden line and gaps, so the player
 * above never jumps.
 */
export function LiveSentence() {
  const t = useTranslations("shadowing");
  const labelId = useId();
  const { lines } = useLesson();
  const { index, isSpoken } = useCurrentSentence();
  const [session, dispatch] = useSession();
  const { preferences } = usePreferences();
  const line = index === null ? null : lines[index] ?? null;
  const hidden = session.liveSentenceHidden;
  const translationMode = preferences.readingTranslation;
  const revealed = line ? session.lineTranslationRevealed[line.id] === true : false;

  return (
    <section
      aria-labelledby={labelId}
      data-spoken={isSpoken}
      className={cn("reading-surface relative rounded-lg border px-md py-sm transition-colors", isSpoken ? "border-border" : "border-border/50")}
    >
      <p id={labelId} className="text-center text-caption font-semibold uppercase tracking-wide text-primary-strong">
        {t("workspace.liveSentence.label")}
      </p>
      <button
        type="button"
        aria-pressed={hidden}
        aria-label={t(hidden ? "workspace.liveSentence.showJapanese" : "workspace.liveSentence.hideJapanese")}
        onClick={() => dispatch({ type: "toggle-live-sentence" })}
        className="reading-muted absolute right-sm top-sm flex h-control-sm aspect-square items-center justify-center rounded-md hover:bg-muted reading-hover"
      >
        {hidden ? <ShowTextGlyph className="size-icon-sm" /> : <HideTextGlyph className="size-icon-sm" />}
      </button>
      <div className="reading-measure mx-auto mt-xs space-y-xs text-center">
        {line ? (
          // A selection here, or a plain click on a word, opens the selection popover (spec §6.3).
          <div data-line-id={line.id} data-word-click="" tabIndex={-1} className="cursor-text outline-none">
            <RubySentence
              segments={line.furigana}
              text={line.textJp}
              mode={preferences.readingFurigana}
              override={session.lineFurigana[line.id]}
              // Hidden keeps the box (no jump) and leaves the line out of the accessibility tree.
              hidden={hidden}
              // Softened between sentences by colour, never by opacity on already-muted text (contrast).
              className={cn(JAPANESE, hidden && "invisible", isSpoken ? "reading-foreground" : "reading-muted")}
            />
          </div>
        ) : (
          <p aria-hidden="true" className={cn(JAPANESE, "invisible")}>&nbsp;</p>
        )}
        {line?.textTranslation != null && translationMode === "always" && (
          <p className={cn(TRANSLATION, "reading-muted")}>{line.textTranslation}</p>
        )}
        {line?.textTranslation != null && translationMode === "reveal" && (revealed ? (
          <p className={cn(TRANSLATION, "reading-muted")}>{line.textTranslation}</p>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: "reveal-line-translation", lineId: line.id })}
            className="reading-muted rounded-md px-sm py-2xs text-caption underline-offset-2 reading-hover hover:underline"
          >
            {t("workspace.liveSentence.showTranslation")}
          </button>
        ))}
      </div>
    </section>
  );
}
