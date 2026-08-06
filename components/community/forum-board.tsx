"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ForumComposer } from "./forum-composer";
import { ForumPostItem, FORUM_TOPICS, topicLabel } from "./forum-post-item";
import type { ForumPostListItem, ForumPostsPage, ForumTopic } from "@/lib/forum-types";

export interface ForumBoardProps {
  /** Server-fetched first page (unfiltered) so the board renders with no client-side loading flash. */
  initialPage: ForumPostsPage;
  className?: string;
}

type TopicFilter = "all" | ForumTopic;

type ListState = { status: "idle" | "loading" } | { status: "error"; message: string };

function buildUrl(topic: TopicFilter, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (topic !== "all") params.set("topic", topic);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return qs ? `/api/forum/posts?${qs}` : "/api/forum/posts";
}

/**
 * Forum board: topic filter chips, post list, cursor "load more", and a
 * togglable "New post" composer. The initial (unfiltered) page comes from the
 * server component so first paint has no fetch/loading flash; every other
 * transition (topic change, load more, post created) is a plain client fetch
 * + revalidate against `GET /api/forum/posts` — no optimistic post insert,
 * since the create response doesn't include the full post shape (author,
 * comment count) needed to render a real list row.
 */
export function ForumBoard({ initialPage, className }: ForumBoardProps) {
  const t = useTranslations("community");
  const tCommon = useTranslations("common");
  const [topic, setTopic] = useState<TopicFilter>("all");
  const [posts, setPosts] = useState<ForumPostListItem[]>(initialPage.posts);
  const [nextCursor, setNextCursor] = useState<string | null>(initialPage.nextCursor);
  const [listState, setListState] = useState<ListState>({ status: "idle" });
  const [composerOpen, setComposerOpen] = useState(false);

  const TOPIC_CHIPS: { value: TopicFilter; label: string }[] = [
    { value: "all", label: t("topics.all") },
    ...FORUM_TOPICS.map((value) => ({ value, label: topicLabel(t, value) })),
  ];

  async function fetchPage(nextTopic: TopicFilter, opts: { cursor?: string | null; append?: boolean } = {}): Promise<void> {
    setListState({ status: "loading" });
    try {
      const res = await fetch(buildUrl(nextTopic, opts.cursor));
      if (!res.ok) {
        setListState({ status: "error", message: t("board.loadError") });
        return;
      }
      const json = (await res.json()) as { data: ForumPostsPage };
      setPosts((prev) => (opts.append ? [...prev, ...json.data.posts] : json.data.posts));
      setNextCursor(json.data.nextCursor);
      setListState({ status: "idle" });
    } catch {
      setListState({ status: "error", message: tCommon("errors.network") });
    }
  }

  function handleTopicChange(next: TopicFilter): void {
    if (next === topic) return;
    setTopic(next);
    void fetchPage(next);
  }

  function handleLoadMore(): void {
    void fetchPage(topic, { cursor: nextCursor, append: true });
  }

  function handleCreated(): void {
    setComposerOpen(false);
    void fetchPage(topic);
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t("board.topicFilterAriaLabel")} className="flex flex-wrap gap-2">
          {TOPIC_CHIPS.map((chip) => {
            const active = chip.value === topic;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={active}
                onClick={() => handleTopicChange(chip.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={() => setComposerOpen((v) => !v)}>
          {composerOpen ? tCommon("actions.cancel") : t("board.newPost")}
        </Button>
      </div>

      {composerOpen && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <ForumComposer onCreated={handleCreated} />
        </div>
      )}

      <div aria-live="polite" className="mt-2">
        {listState.status === "error" && (
          <p role="alert" className="text-sm text-danger-strong">
            {listState.message}
          </p>
        )}
      </div>

      {posts.length === 0 && listState.status !== "loading" ? (
        <p className="mt-6 text-sm text-muted-foreground">{t("board.empty")}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {posts.map((p) => (
            <ForumPostItem key={p.id} post={p} />
          ))}
        </ul>
      )}

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={handleLoadMore} disabled={listState.status === "loading"}>
            {listState.status === "loading" ? tCommon("states.loading") : tCommon("actions.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
