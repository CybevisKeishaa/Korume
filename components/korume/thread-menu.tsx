"use client";

import { useState } from "react";
import { Link, useLocale, useTranslations } from "@/lib/i18n";
import type { KorumeThreadView } from "@/lib/korume/types";
import { Popover } from "@/components/ui/popover";

export function ThreadMenu({
  initialThreads,
  initialCursor,
  onNewConversation,
}: {
  initialThreads: KorumeThreadView[];
  initialCursor: string | null;
  /** Called with the navigation: from an unsaved free chat the URL does not change, so the page must reset itself. */
  onNewConversation: () => void;
}) {
  const t = useTranslations("companion");
  const locale = useLocale();
  const [threads, setThreads] = useState(initialThreads);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const loadMore = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/korume/threads?cursor=${encodeURIComponent(cursor)}`,
      );
      if (!response.ok) return;
      const page = (await response.json()) as {
        threads: KorumeThreadView[];
        nextCursor: string | null;
      };
      setThreads((current) => [...current, ...page.threads]);
      setCursor(page.nextCursor);
    } catch {
      // Offline or a bad body: keep the list and the button; the learner can try again.
    } finally {
      setLoading(false);
    }
  };
  return (
    <Popover
      align="end"
      label={t("ask.chat.pastConversations")}
      trigger={
        <button
          type="button"
          aria-label={t("ask.chat.pastConversations")}
          className="flex min-h-hit-target items-center rounded-md px-sm text-muted-foreground hover:bg-muted"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="currentColor"><circle cx="5" cy="12" r="1.75" /><circle cx="12" cy="12" r="1.75" /><circle cx="19" cy="12" r="1.75" /></svg>
        </button>
      }
      className="w-72"
    >
      <nav className="flex flex-col gap-xs">
        <Link
          href="/korume/chat"
          onClick={onNewConversation}
          className="rounded-md px-sm py-xs text-body font-medium text-primary-strong hover:bg-muted"
        >
          {t("ask.chat.newConversation")}
        </Link>
        {threads.map((thread) => (
          <Link
            key={thread.id}
            href={`/korume/chat?thread=${thread.id}`}
            className="rounded-md px-sm py-xs hover:bg-muted"
          >
            <span className="block truncate text-body text-foreground">
              {thread.title ??
                thread.anchor?.lineText ??
                t("ask.chat.untitledConversation")}
            </span>
            <span className="block text-caption text-muted-foreground">
              {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                new Date(thread.updatedAt),
              )}
            </span>
          </Link>
        ))}
        {cursor ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="min-h-hit-target rounded-md px-sm text-start text-caption font-medium text-primary-strong hover:bg-muted disabled:opacity-60"
          >
            {t("ask.chat.loadMore")}
          </button>
        ) : null}
      </nav>
    </Popover>
  );
}
