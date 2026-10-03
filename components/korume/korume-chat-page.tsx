"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocale, useRouter, useTranslations } from "@/lib/i18n";
import { unionGrounding } from "@/lib/korume/grounding";
import { Composer } from "./composer";
import { KorumeRail, type SmallMemory } from "./korume-rail";
import { MessageList } from "./message-list";
import { ThreadMenu } from "./thread-menu";
import { TurnNotice } from "./turn-notice";
import { LOCKING_NOTICES, useKorumeThread } from "./use-korume-thread";
import type {
  KorumeThreadDetail,
  KorumeThreadView,
} from "@/lib/korume/types";

type KorumeChatPageProps = {
  detail: KorumeThreadDetail | null;
  threads: KorumeThreadView[];
  nextCursor: string | null;
  memory: SmallMemory | null;
  disabled: boolean;
  unavailable?: boolean;
  notFound: boolean;
};

/**
 * The conversation is keyed here, not by the server page: Next keeps this page mounted across `?thread` changes, so
 * another thread must remount it — but the thread a free chat just created must NOT (the server re-renders it under
 * `?thread=<id>` after `router.refresh()`; a remount would drop focus and scroll). "New conversation" on an unsaved
 * free chat stays on the same URL, so it re-keys too. Every remount after the first moves focus to the composer.
 */
export function KorumeChatPage(props: KorumeChatPageProps) {
  const [conversation, setConversation] = useState(0);
  const [created, setCreated] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => setSettled(true), []);
  // Back/Forward always lands in another conversation. Without this, Back from a created thread to a free or not-found
  // URL keeps the free key, so the old conversation stays — and puts its thread back in the URL. In a transition, so
  // it renders with the router's restore, not with the old props first.
  useEffect(() => {
    const leave = () => startTransition(startOver);
    window.addEventListener("popstate", leave);
    return () => window.removeEventListener("popstate", leave);
  }, []);
  const threadId = props.detail?.thread.id ?? null;
  const key = threadId === null || threadId === created ? `free:${conversation}` : `${threadId}:${conversation}`;
  return (
    <KorumeConversation
      key={key}
      {...props}
      focusComposer={settled}
      onThreadCreated={setCreated}
      onNewConversation={startOver}
    />
  );

  function startOver() {
    setCreated(null);
    setConversation((n) => n + 1);
  }
}

/** "Today" for today, else the locale's date — computed after mount: server and learner may be in different days. */
function useDividerLabel(firstAt: string | undefined): string | null {
  const t = useTranslations("companion");
  const locale = useLocale();
  const [label, setLabel] = useState<string | null>(firstAt ? null : t("ask.chat.today"));
  useEffect(() => {
    if (!firstAt) return;
    const first = new Date(firstAt);
    setLabel(first.toDateString() === new Date().toDateString() ? t("ask.chat.today") : new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(first));
  }, [firstAt, locale, t]);
  return label;
}

function KorumeConversation({
  detail,
  threads,
  nextCursor,
  memory,
  disabled,
  unavailable,
  notFound,
  focusComposer,
  onThreadCreated,
  onNewConversation,
}: KorumeChatPageProps & { focusComposer: boolean; onThreadCreated: (id: string) => void; onNewConversation: () => void }) {
  const t = useTranslations("companion");
  const router = useRouter();
  const state = useKorumeThread({
    threadId: detail?.thread.id,
    anchor: null,
    initial: detail ?? undefined,
  });
  const entities = useMemo(() => unionGrounding(state.messages), [state.messages]);
  const dividerLabel = useDividerLabel(state.messages[0]?.createdAt);
  // The client router caches this page's payload (staleTimes.dynamic): once a turn is answered here, drop that cache
  // so coming back to this thread from ⋯ or the browser does not seed it without the turn. Same key → state kept.
  const answers = state.messages.filter((message) => message.role === "assistant").length;
  const answersSeen = useRef(answers);
  useEffect(() => {
    if (answers <= answersSeen.current) return;
    answersSeen.current = answers;
    router.refresh();
  }, [answers, router]);
  // A free chat's thread goes into the URL as soon as it exists — by replace, so Back never lands on an empty free
  // chat, and reload (or a refresh mid-answer) shows the thread. Next 14.2 syncs useSearchParams with replaceState.
  useEffect(() => {
    if (!state.created || detail) return;
    const url = new URL(window.location.href);
    url.searchParams.set("thread", state.threadId);
    window.history.replaceState(null, "", url);
    onThreadCreated(state.threadId);
  }, [state.created, state.threadId, detail, onThreadCreated]);
  const latest = [...state.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const exposure = latest?.grounding?.find(
    (entity) => entity.seenCount !== undefined,
  );
  const locked =
    state.notice !== null && LOCKING_NOTICES.has(state.notice.kind);
  const goBack = () => {
    if (detail?.thread.originRoute)
      return router.push(detail.thread.originRoute);
    if (
      // A same-origin referrer alone is not an in-app entry: a page opened in a new tab has one and no history.
      document.referrer &&
      new URL(document.referrer).origin === window.location.origin &&
      window.history.length > 1
    )
      return router.back();
    return router.push("/dashboard");
  };
  const unavailableState = disabled || unavailable;

  return (
    // Desktop: exactly one viewport tall — the conversation scrolls inside its card, the composer never leaves view.
    <div className="mx-auto flex max-w-screen-xl flex-col px-lg py-md lg:h-dvh">
      <header className="mb-md flex shrink-0 items-center gap-md">
        <button
          type="button"
          onClick={goBack}
          className="min-h-hit-target rounded-md px-sm text-body text-muted-foreground hover:bg-muted"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mr-xs inline size-icon-sm"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {t("ask.chat.back")}
        </button>
        <div className="flex-1 border-l border-border pl-md">
          <h1 className="text-body-lg font-semibold text-foreground">
            {t("ask.chat.brand")}
          </h1>
          <p className="text-caption text-muted-foreground">
            {t("ask.chat.knowledge")}
          </p>
        </div>
        <Link
          href="/companion"
          className="text-caption text-muted-foreground hover:text-foreground"
        >
          {t("ask.chat.memory")}
        </Link>
        <Link
          href="/settings"
          aria-label={t("ask.chat.settings")}
          className="text-muted-foreground hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-icon-sm"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2 2-.06-.06A1.7 1.7 0 0 0 15.86 18a1.7 1.7 0 0 0-1 1.54V20h-2.84v-.46A1.7 1.7 0 0 0 11 18a1.7 1.7 0 0 0-1.88.34l-.06.06-2-2 .06-.06A1.7 1.7 0 0 0 7.46 15a1.7 1.7 0 0 0-1.54-1H5.5v-2.84h.42A1.7 1.7 0 0 0 7.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2-2 .06.06A1.7 1.7 0 0 0 11 6.46a1.7 1.7 0 0 0 1-1.54V4.5h2.84v.42a1.7 1.7 0 0 0 1 1.54 1.7 1.7 0 0 0 1.88-.34l.06-.06 2 2-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.54 1h.42V14h-.42A1.7 1.7 0 0 0 19.4 15Z" />
          </svg>
        </Link>
      </header>
      {unavailableState ? (
        <section className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-xl">
          <h2 className="text-body-lg font-semibold">
            {t(
              unavailable
                ? "ask.chat.unavailableTitle"
                : "ask.chat.disabledTitle",
            )}
          </h2>
          <p className="mt-sm text-body text-muted-foreground">
            {t(
              unavailable
                ? "ask.chat.unavailableDescription"
                : "ask.chat.disabledDescription",
            )}
          </p>
          {disabled ? (
            <Link
              href="/settings"
              className="mt-md inline-block text-body font-medium text-primary-strong hover:underline"
            >
              {t("ask.chat.settings")}
            </Link>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-xl lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <section className="flex flex-col overflow-hidden rounded-lg border border-border bg-card lg:min-h-0">
            <header className="flex shrink-0 items-center justify-between border-b border-border px-lg py-xs">
              <p className="flex items-baseline gap-sm">
                <span className="text-caption font-semibold tracking-wide text-primary-strong">
                  {t("ask.chat.signature")}
                </span>
                <span className="text-body font-medium text-foreground">
                  {t("ask.chat.subtitle")}
                </span>
              </p>
              <ThreadMenu initialThreads={threads} initialCursor={nextCursor} onNewConversation={onNewConversation} />
            </header>
            <div className="flex min-h-[30rem] flex-1 flex-col lg:min-h-0">
              <div data-korume-scroll className="min-h-0 flex-1 space-y-lg overflow-y-auto px-lg py-lg">
                {dividerLabel ? (
                  <p className="flex items-center gap-sm text-caption uppercase tracking-wide text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
                    {dividerLabel}
                  </p>
                ) : null}
                {notFound ? (
                  <p role="status" className="text-body text-muted-foreground">
                    {t("ask.chat.notFound")}
                  </p>
                ) : null}
                {exposure ? (
                  <p className="rounded-lg border border-border bg-muted px-md py-sm text-body text-muted-foreground">
                    {t(
                      exposure.seenCapped
                        ? "ask.chat.groundingCapped"
                        : "ask.chat.grounding",
                      { label: exposure.label, count: exposure.seenCount ?? 0 },
                    )}
                  </p>
                ) : null}
                <MessageList
                  messages={state.messages}
                  pending={state.pending}
                  onFollowup={
                    locked ? undefined : (text) => void state.send(text)
                  }
                  onRetry={() => void state.retry()}
                />
              </div>
              <div className="shrink-0 border-t border-border px-lg py-sm">
                {state.notice ? (
                  <div className="mb-sm">
                    <TurnNotice notice={state.notice} />
                  </div>
                ) : null}
                <Composer
                  autoFocus={focusComposer}
                  onSend={(text) => void state.send(text)}
                  disabled={locked}
                  placeholder={
                    detail?.thread.anchor
                      ? t("ask.composerPlaceholder")
                      : t("ask.composerPlaceholderFree")
                  }
                />
              </div>
            </div>
          </section>
          <div className="lg:min-h-0 lg:overflow-y-auto">
            <KorumeRail
              anchor={detail?.thread.anchor ?? null}
              entities={entities}
              memory={memory}
            />
          </div>
        </div>
      )}
    </div>
  );
}
