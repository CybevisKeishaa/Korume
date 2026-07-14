import Link from "next/link";
import { RelativeTime } from "./relative-time";
import type { ForumPostListItem, ForumTopic } from "@/lib/forum-types";

const TOPIC_LABELS: Record<ForumTopic, string> = {
  general: "General",
  grammar: "Grammar",
  vocab: "Vocab",
  listening: "Listening",
  speaking: "Speaking",
  jlpt: "JLPT",
  "study-tips": "Study tips",
};

export interface ForumPostItemProps {
  post: ForumPostListItem;
}

/** One row in the forum board's post list: title (links to detail), author, relative time, topic badge, comment count. */
export function ForumPostItem({ post }: ForumPostItemProps) {
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
          {TOPIC_LABELS[post.topic]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <span>{post.author?.name ?? "Deleted user"}</span>
        <span aria-hidden="true">·</span>
        <RelativeTime dateTime={post.createdAt} />
        <span aria-hidden="true">·</span>
        <span>
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </span>
      </div>
    </li>
  );
}
