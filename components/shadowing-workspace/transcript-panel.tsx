"use client";

import { useCallback, useId, useMemo, useRef } from "react";
import { useTranslations } from "@/lib/i18n";
import type { ReadingTranslation, ReadingWidth, SentenceMarkKind } from "@/lib/preferences/options";
import { matchingLineIndexes } from "@/lib/shadowing-workspace/transcript-search";
import { cn } from "@/lib/utils";
import { ExpandGlyph, SearchGlyph, ShowTextGlyph } from "./player-glyphs";
import { TranscriptRow, type RowState, type RowTranslation } from "./transcript-row";
import { useAutoFollow } from "./use-auto-follow";
import { useCurrentSentence, useLesson, useMarks, usePlaybackController, usePreferences, useSession, type SessionState } from "./workspace-context";

const HEADER_BUTTON = "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong";
/** Full Transcript reading measure (Reading Settings › Width). */
const MEASURE: Record<ReadingWidth, string> = { narrow: "max-w-[52ch]", normal: "max-w-[68ch]", wide: "max-w-[84ch]" };

/** spec §7.8: the 👁 session override beats the persisted mode; `reveal` covers until the line is revealed. */
function rowTranslation(override: SessionState["transcriptTranslation"], persisted: ReadingTranslation, revealed: boolean): RowTranslation {
  if (override !== "follow") return override;
  if (persisted === "reveal") return revealed ? "shown" : "covered";
  return persisted === "always" ? "shown" : "hidden";
}

/**
 * The transcript column (Figma `105:3708`, spec §7.6): header with count and length, the 👁 session
 * override (never a preference write), ⤢ Full Transcript, search, and the rows. Search keeps original
 * numbers and suspends auto-follow while the query is non-empty.
 */
export function TranscriptPanel() {
  const t = useTranslations("shadowing");
  const searchId = useId();
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const { index: currentIndex, isSpoken } = useCurrentSentence();
  const [session, dispatch] = useSession();
  const { preferences } = usePreferences();
  const marks = useMarks();
  const scrollRef = useRef<HTMLDivElement>(null);
  const query = session.query;
  const full = session.view === "full-transcript";

  const visible = useMemo(() => matchingLineIndexes(lines, query), [lines, query]);
  const { suspended, resume } = useAutoFollow(scrollRef, currentIndex, query.trim() === "", session.view);

  const onReplay = useCallback((index: number) => controller.seekToSentence(index, { play: true }), [controller]);
  const { toggleMark } = marks;
  const onToggleMark = useCallback((lineId: string, kind: SentenceMarkKind) => toggleMark(lineId, kind), [toggleMark]);
  const onRevealTranslation = useCallback((lineId: string) => dispatch({ type: "reveal-line-translation", lineId }), [dispatch]);
  const onToggleFurigana = useCallback((lineId: string, shownByMode: boolean) => dispatch({ type: "toggle-line-furigana", lineId, shownByMode }), [dispatch]);

  const persisted = preferences.readingTranslation;
  const translationShown = session.transcriptTranslation === "shown" || (session.transcriptTranslation === "follow" && persisted === "always");
  const digits = lines.length > 99 ? 3 : 2;
  const lastLine = lines[lines.length - 1];
  const seconds = video.durationSeconds ?? lastLine?.endTime ?? lastLine?.startTime ?? 0;
  const minutes = Math.max(1, Math.round(seconds / 60));
  const searching = query.trim() !== "";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-card">
      <div className="space-y-sm border-b p-md">
        <div className="flex items-start justify-between gap-sm">
          <div>
            <h2 className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{t("workspace.transcript.label")}</h2>
            <p className="text-caption text-muted-foreground">{t("workspace.transcript.meta", { count: lines.length, minutes })}</p>
          </div>
          <div className="flex gap-2xs">
            <button
              type="button"
              aria-pressed={translationShown}
              aria-label={t("workspace.transcript.translations")}
              title={t("workspace.transcript.translations")}
              onClick={() => dispatch({ type: "cycle-transcript-translation", persisted })}
              className={HEADER_BUTTON}
            >
              <ShowTextGlyph className="size-icon-sm" />
            </button>
            <button
              type="button"
              aria-pressed={full}
              aria-label={t("workspace.transcript.fullTranscript")}
              title={t("workspace.transcript.fullTranscript")}
              onClick={() => dispatch({ type: "toggle-view", view: "full-transcript" })}
              className={HEADER_BUTTON}
            >
              <ExpandGlyph className="size-icon-sm" />
            </button>
          </div>
        </div>
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">{t("workspace.transcript.search")}</label>
          <SearchGlyph className="pointer-events-none absolute left-sm top-1/2 size-icon-sm -translate-y-1/2 text-muted-foreground" />
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder={t("workspace.transcript.search")}
            onChange={(event) => dispatch({ type: "set-query", query: event.target.value })}
            onKeyDown={(event) => {
              const first = visible[0];
              if (event.key === "Enter" && searching && first !== undefined) {
                event.preventDefault();
                controller.seekToSentence(first);
              }
            }}
            className="h-control-sm w-full rounded-full bg-muted pl-xl pr-sm text-body placeholder:text-muted-foreground"
          />
        </div>
        <p role="status" className="sr-only">{searching ? t("workspace.transcript.matches", { count: visible.length }) : ""}</p>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain" data-testid="transcript-scroll">
          {visible.length === 0 ? (
            <p className="p-md text-body text-muted-foreground">{t("workspace.transcript.noMatches")}</p>
          ) : (
            <ol aria-label={t("workspace.transcript.label")} className={cn("space-y-2xs p-xs", full && cn("mx-auto", MEASURE[preferences.readingWidth]))}>
              {visible.map((index) => {
                const line = lines[index];
                if (!line) return null;
                const state: RowState = currentIndex === null || index > currentIndex ? "future" : index < currentIndex ? "past" : "current";
                return (
                  <TranscriptRow
                    key={line.id}
                    line={line}
                    number={String(index + 1).padStart(digits, "0")}
                    state={state}
                    spoken={state === "current" ? isSpoken : true}
                    bookmarked={marks.isMarked(line.id, "bookmark")}
                    difficult={marks.isMarked(line.id, "difficult")}
                    bookmarkPending={marks.pending(`mark:${line.id}:bookmark`)}
                    difficultPending={marks.pending(`mark:${line.id}:difficult`)}
                    translation={rowTranslation(session.transcriptTranslation, persisted, session.lineTranslationRevealed[line.id] === true)}
                    furiganaMode={full ? preferences.readingFurigana : "hidden"}
                    furiganaOverride={session.lineFurigana[line.id]}
                    full={full}
                    onReplay={onReplay}
                    onToggleMark={onToggleMark}
                    onRevealTranslation={onRevealTranslation}
                    onToggleFurigana={onToggleFurigana}
                  />
                );
              })}
            </ol>
          )}
        </div>
        {suspended && currentIndex !== null && (
          <button
            type="button"
            onClick={resume}
            className="absolute bottom-sm left-1/2 -translate-x-1/2 rounded-full bg-primary px-md py-2xs text-caption font-semibold text-primary-foreground shadow-raised"
          >
            {t("workspace.transcript.backToCurrent")}
          </button>
        )}
      </div>
    </div>
  );
}
