"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "@/lib/i18n";
import { MASCOT_POSES } from "@/components/mascot/mascot-poses";
import type { KorumeMessageView } from "@/lib/korume/types";
import { AnswerBlocks } from "./answer-blocks";
import type { PendingTurnState } from "./use-korume-thread";

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

/** The date divider and, once the learner has met an entity of the latest answer, the grounding line. Shared by the page and the sheet. */
export function ConversationHeader({ messages }: { messages: KorumeMessageView[] }) {
  const t = useTranslations("companion");
  const dividerLabel = useDividerLabel(messages[0]?.createdAt);
  const latest = [...messages].reverse().find((m) => m.role === "assistant");
  const exposure = latest?.grounding?.find((entity) => (entity.seenCount ?? 0) > 0);
  return (
    <>
      {dividerLabel ? (
        <p className="flex items-center gap-sm text-caption uppercase tracking-wide text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
          {dividerLabel}
        </p>
      ) : null}
      {exposure ? (
        <p className="rounded-full border border-primary/10 bg-card px-md py-sm text-body text-muted-foreground">
          {t(exposure.seenCapped ? "ask.chat.groundingCapped" : "ask.chat.grounding", { label: exposure.label, count: exposure.seenCount ?? 0 })}
        </p>
      ) : null}
    </>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <li className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-br-sm bg-secondary px-md py-sm text-body-lg text-secondary-foreground">{text}</p>
    </li>
  );
}

const AVATAR = MASCOT_POSES["companion-sitting"];

/** Figma 215:15164: the round mascot beside the answer, and the ember `KORUME` signature with its small sage dot. */
function AnswerRow({ children, live }: { children: ReactNode; live?: boolean }) {
  const t = useTranslations("companion");
  return (
    <li aria-live={live ? "polite" : undefined} className="flex items-start gap-sm">
      <span aria-hidden="true" className="relative aspect-square h-control-sm shrink-0 overflow-hidden rounded-full bg-primary/10">
        <Image src={`/mascot/poses/${AVATAR.file}`} alt="" width={AVATAR.width} height={AVATAR.height} unoptimized draggable={false} className="size-full select-none object-cover object-top" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-xs flex items-center gap-xs text-caption font-semibold tracking-widest text-primary-strong">
          {t("ask.signature")}
          <span aria-hidden="true" className="size-2xs rounded-full bg-success" />
        </p>
        {children}
      </div>
    </li>
  );
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
        <AnswerRow key={m.id}>
          <div className="rounded-lg rounded-tl-sm border border-border bg-card px-md py-md">
            {m.answer
              // Follow-up chips act only on the latest answer: an old suggestion is history, not a control.
              ? <AnswerBlocks answer={m.answer} grounding={m.grounding ?? []} onFollowup={m.id === lastAnswer ? onFollowup : undefined} />
              : <p className="whitespace-pre-wrap text-body-lg text-foreground/90">{m.text}</p>}
          </div>
        </AnswerRow>
      ))}
      {pending ? (
        <>
          {messages.some((m) => m.role === "user" && m.turnId === pending.turnId) ? null : <UserBubble text={pending.text} />}
          <AnswerRow live>
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
          </AnswerRow>
        </>
      ) : null}
    </ol>
  );
}
