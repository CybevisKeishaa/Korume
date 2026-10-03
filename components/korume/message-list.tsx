"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "@/lib/i18n";
import type { KorumeMessageView } from "@/lib/korume/types";
import { AnswerBlocks } from "./answer-blocks";
import type { PendingTurnState } from "./use-korume-thread";

function UserBubble({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-secondary px-md py-sm text-body-lg text-secondary-foreground">{text}</p>
    </li>
  );
}

function Signature() {
  const t = useTranslations("companion");
  return <p className="mb-xs text-caption font-semibold tracking-widest text-primary-strong">{t("ask.signature")}</p>;
}

/**
 * The conversation, oldest first. An answer renders from its validated structure when it has one, else from its
 * plain `content`. The in-flight turn shows the learner's words immediately and a status under them.
 */
export function MessageList({ messages, pending, onFollowup, onRetry }: {
  messages: KorumeMessageView[];
  pending: PendingTurnState | null;
  onFollowup?: (text: string) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("companion");
  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant")?.id;
  const list = useRef<HTMLOListElement>(null);
  // The newest turn in view. The scroller is the one the sheet or the chat page marks — never `scrollIntoView`, which
  // would also move the workspace's overflow-hidden ancestors.
  useEffect(() => {
    const scroller = list.current?.closest<HTMLElement>("[data-korume-scroll]");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [messages.length, pending?.turnId, pending?.status]);
  return (
    <ol ref={list} aria-label={t("ask.messages")} className="flex flex-col gap-lg">
      {messages.map((m) => m.role === "user" ? <UserBubble key={m.id} text={m.text} /> : (
        <li key={m.id}>
          <Signature />
          <div className="rounded-lg border border-border bg-card px-md py-md">
            {m.answer
              // Follow-up chips act only on the latest answer: an old suggestion is history, not a control.
              ? <AnswerBlocks answer={m.answer} grounding={m.grounding ?? []} onFollowup={m.id === lastAnswer ? onFollowup : undefined} />
              : <p className="whitespace-pre-wrap text-body-lg text-foreground/90">{m.text}</p>}
          </div>
        </li>
      ))}
      {pending ? (
        <>
          {messages.some((m) => m.role === "user" && m.turnId === pending.turnId) ? null : <UserBubble text={pending.text} />}
          <li aria-live="polite">
            <Signature />
            {pending.status === "sending" || pending.status === "running" ? (
              <p className="text-body text-muted-foreground">{t("ask.thinking")}</p>
            ) : (
              <div className="flex flex-wrap items-center gap-sm">
                <p className="text-body text-muted-foreground">{t("ask.failed")}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="min-h-hit-target rounded-full border border-primary/30 px-sm text-caption font-medium text-primary-strong hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("ask.tryAgain")}
                </button>
              </div>
            )}
          </li>
        </>
      ) : null}
    </ol>
  );
}
