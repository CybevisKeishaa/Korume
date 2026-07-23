"use client";

import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { RelativeTime } from "./relative-time";
import type { ForumPostListItem, ForumTopic } from "@/lib/forum-types";

/**
 * The seven forum topics, in display order. Single source for
 * `forum-board.tsx`'s filter chips, `forum-composer.tsx`'s and
 * `forum-thread.tsx`'s topic `<select>`s, and this file's badge — those four
 * consumers previously each hardcoded their own copy of the id/label list
 * (Task 16 audit, the same duplication hotspot as Task 15's `SCENARIOS`).
 */
export const FORUM_TOPICS: readonly ForumTopic[] = [
  "general",
  "grammar",
  "vocab",
  "listening",
  "speaking",
  "jlpt",
  "study-tips",
];

/**
 * Resolves a topic id to its translated `community.topics.*` label. `t` is
 * passed in rather than called here because a hook can't be called at module
 * scope (same shape as `scenario-picker.tsx`'s `scenarioLabel`, Task 15).
 */
export function topicLabel(t: ReturnType<typeof useTranslations<"community">>, topic: ForumTopic): string {
  return t(`topics.${topic}`);
}

export interface ForumPostItemProps {
  post: ForumPostListItem;
}

/** One row in the forum board's post list: title (links to detail), author, relative time, topic badge, comment count. */
export function ForumPostItem({ post }: ForumPostItemProps) {
  const t = useTranslations("community");

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Link
          href={`/community/${post.id}`}
          className="font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {post.title}
        </Link>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {topicLabel(t, post.topic)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>{post.author?.name ?? t("deletedUser")}</span>
        <span aria-hidden="true">·</span>
        <RelativeTime dateTime={post.createdAt} />
        <span aria-hidden="true">·</span>
        <span>{t("postItem.commentCount", { count: post.commentCount })}</span>
      </div>
    </li>
  );
}
