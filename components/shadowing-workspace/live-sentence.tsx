"use client";

import { useId } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { HideTextGlyph, ShowTextGlyph } from "./player-glyphs";
import { RubySentence } from "./ruby-sentence";
import { useCurrentSentence, useLesson, usePreferences, useSession } from "./workspace-context";

const JAPANESE = "text-heading-lg";
const TRANSLATION = "text-body";

/**
 * Live Sentence (Figma `105:3654`, spec §7.5): the current line, large, with readings and its translation.
 * The hide toggle is a session-only listening-recall aid: it hides only the Japanese, never pauses and never
 * writes a preference. No ✨ until Part 1b. The card keeps its height through an intro, a hidden line and
 * gaps, so the player above never jumps.
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
      className={cn("relative rounded-lg border bg-card px-md py-sm transition-colors", isSpoken ? "border-border" : "border-border/50")}
    >
      <p id={labelId} className="text-center text-caption font-semibold uppercase tracking-wide text-primary-strong">
        {t("workspace.liveSentence.label")}
      </p>
      <button
        type="button"
        aria-pressed={hidden}
        aria-label={t(hidden ? "workspace.liveSentence.showJapanese" : "workspace.liveSentence.hideJapanese")}
        onClick={() => dispatch({ type: "toggle-live-sentence" })}
        className="absolute right-sm top-sm flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {hidden ? <ShowTextGlyph className="size-icon-sm" /> : <HideTextGlyph className="size-icon-sm" />}
      </button>
      <div className="mt-xs space-y-xs text-center">
        {line ? (
          <RubySentence
            segments={line.furigana}
            text={line.textJp}
            mode={preferences.readingFurigana}
            override={session.lineFurigana[line.id]}
            // Hidden keeps the box (no jump) and leaves the line out of the accessibility tree.
            hidden={hidden}
            // Softened between sentences by colour, never by opacity on already-muted text (contrast).
            className={cn(JAPANESE, hidden && "invisible", isSpoken ? "text-foreground" : "text-muted-foreground")}
          />
        ) : (
          <p aria-hidden="true" className={cn(JAPANESE, "invisible")}>&nbsp;</p>
        )}
        {line?.textTranslation != null && translationMode === "always" && (
          <p className={cn(TRANSLATION, "text-muted-foreground")}>{line.textTranslation}</p>
        )}
        {line?.textTranslation != null && translationMode === "reveal" && (revealed ? (
          <p className={cn(TRANSLATION, "text-muted-foreground")}>{line.textTranslation}</p>
        ) : (
          <button
            type="button"
            onClick={() => dispatch({ type: "reveal-line-translation", lineId: line.id })}
            className="rounded-md px-sm py-2xs text-caption text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t("workspace.liveSentence.showTranslation")}
          </button>
        ))}
      </div>
    </section>
  );
}
