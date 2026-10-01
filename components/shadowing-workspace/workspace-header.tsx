"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { HEADER_ICON_BUTTON, LessonBookmarkButton } from "./lesson-bookmark-button";
import { ModeNav } from "./mode-nav";
import { BackGlyph } from "./player-glyphs";
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
 * One row, ≤ 48px at 1280×529 (`--workspace-video-reserve` assumes it).
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
    <header className="flex items-center gap-md border-b px-md py-2xs">
      <div className="flex min-w-0 flex-1 items-center gap-sm">
        <Link href="/shadowing" aria-label={t("workspace.header.back")} title={t("workspace.header.back")} className={HEADER_ICON_BUTTON}>
          <BackGlyph className="size-icon-sm" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-body font-semibold">{video.title}</h1>
          <p className="truncate text-caption text-muted-foreground">{source}</p>
        </div>
        {video.jlptLevel && (
          <Badge variant="accent" className="shrink-0 border border-accent/40">{t("workspace.header.jlpt", { level: video.jlptLevel })}</Badge>
        )}
        <SentenceCounter />
      </div>
      <ModeNav videoId={video.id} />
      <div className="flex shrink-0 items-center gap-2xs">
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
      </div>
    </header>
  );
}
