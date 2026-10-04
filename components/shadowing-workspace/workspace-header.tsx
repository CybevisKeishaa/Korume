"use client";

import type { ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LessonBookmarkButton } from "./lesson-bookmark-button";
import { LessonHeaderFrame } from "./lesson-header-frame";
import { useCurrentSentence, useLesson, useSession } from "./workspace-context";
import { WorkspaceOverflowMenu } from "./workspace-overflow-menu";

/** Its own component: it re-renders on every sentence change, the rest of the header does not. */
function SentenceCounter() {
  const t = useTranslations("shadowing");
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  if (lines.length === 0) return null;
  return (
    <p className="shrink-0 font-mono text-caption tabular-nums text-muted-foreground">
      {t("workspace.header.sentenceCounter", { current: index === null ? "—" : index + 1, total: lines.length })}
    </p>
  );
}

/**
 * The workspace header (Figma `105:3527`, spec §7.2). Left: ← Back, title, source line, JLPT badge, sentence
 * counter. Right, in frame order: [Study Environment] · Focus Mode · [⛶ · ⚙] · lesson Bookmark · `⋯`. The
 * bracketed triggers belong to Tasks 9/10 and arrive through `beforeFocus` / `afterFocus`: a trigger with no
 * behaviour yet would be a dead control (Q1). The frame's "72% complete" is deliberately absent (§3).
 * One row, ≤ 48px at 1280×529 (`--workspace-video-reserve` assumes it). The frame is `LessonHeaderFrame`, shared
 * with Summary (summary spec §7.1); everything that needs workspace context is passed in here.
 */
export function WorkspaceHeader({ beforeFocus, afterFocus }: { beforeFocus?: ReactNode; afterFocus?: ReactNode }) {
  const t = useTranslations("shadowing");
  const { video } = useLesson();
  const [session, dispatch] = useSession();
  const focus = session.view === "focus";
  // spec: a missing JLPT or duration drops its part, never a placeholder; a null channel reads "YouTube".
  const source = [
    video.channelTitle ?? t("workspace.header.sourceFallback"),
    video.jlptLevel,
    video.durationSeconds ? t("workspace.header.minutes", { minutes: Math.max(1, Math.round(video.durationSeconds / 60)) }) : null,
  ].filter(Boolean).join(" · ");

  return (
    <LessonHeaderFrame
      videoId={video.id}
      backHref="/shadowing"
      backLabel={t("workspace.header.back")}
      title={video.title}
      source={source}
      jlptLabel={video.jlptLevel ? t("workspace.header.jlpt", { level: video.jlptLevel }) : null}
      afterTitle={<SentenceCounter />}
      actions={(
        <>
          {beforeFocus}
          <button
            type="button"
            aria-pressed={focus}
            onClick={() => dispatch({ type: "toggle-view", view: "focus" })}
            className={cn("h-control-sm rounded-md px-sm text-caption font-medium text-muted-foreground hover:bg-muted hover:text-foreground", focus && "bg-primary/10 text-primary-strong")}
          >
            {t("workspace.header.focusMode")}
          </button>
          {afterFocus}
          <LessonBookmarkButton />
          <WorkspaceOverflowMenu />
        </>
      )}
    />
  );
}
