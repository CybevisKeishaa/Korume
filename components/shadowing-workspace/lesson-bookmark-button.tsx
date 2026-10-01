"use client";

import { useTranslations } from "@/lib/i18n";
import { BookmarkGlyph } from "./player-glyphs";
import { useMarks } from "./workspace-context";

export const HEADER_ICON_BUTTON =
  "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

/**
 * Lesson bookmark (spec §7.2, §3 deviation register: the frame lacks it). PUT/DELETE through the keyed
 * mutator in `MarksProvider`, so a stale failure never rolls back a newer success. While a request is in
 * flight the button is `aria-disabled`, not `disabled`, so keyboard focus stays on it (T7 review I-4).
 */
export function LessonBookmarkButton() {
  const t = useTranslations("shadowing");
  const { lessonBookmarked, toggleLessonBookmark, pending } = useMarks();
  const busy = pending("lesson-bookmark");
  return (
    <button
      type="button"
      aria-label={t("workspace.header.bookmarkLesson")}
      title={t("workspace.header.bookmarkLesson")}
      aria-pressed={lessonBookmarked}
      aria-disabled={busy || undefined}
      onClick={() => { if (!busy) toggleLessonBookmark(); }}
      className={HEADER_ICON_BUTTON}
    >
      <BookmarkGlyph filled={lessonBookmarked} className="size-icon-sm" />
    </button>
  );
}
