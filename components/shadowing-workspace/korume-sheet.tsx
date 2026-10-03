"use client";

import { useEffect, useId, useRef } from "react";
import { Link, useTranslations } from "@/lib/i18n";
import { Composer } from "@/components/korume/composer";
import { MessageList } from "@/components/korume/message-list";
import { TurnNotice } from "@/components/korume/turn-notice";
import { LOCKING_NOTICES, useKorumeThread, type DraftAnchor } from "@/components/korume/use-korume-thread";
import { useCurrentSentence, useLesson, usePlaybackController } from "./workspace-context";

const CHIP_CHARS = 18;

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Korume beside the transcript (spec §6.2): a non-modal popup floating at the bottom right of the transcript column's
 * grid area, where the mascot sits (owner ruling 2026-10-03: a popup, not a full-height sheet), so the player is
 * never wrapped, resized or remounted. The anchor is fixed for the life of the draft — playback moving on
 * offers a NEW draft, it never re-points this one. Kept mounted while closed, so reopening returns to the thread.
 */
export function KorumeSheet({ open, anchor, onClose, onAskCurrent, onReturnFocus }: {
  open: boolean;
  anchor: DraftAnchor;
  onClose: () => void;
  onAskCurrent: () => void;
  /** Where focus goes when the sheet closes: the mascot that opened it. */
  onReturnFocus: () => void;
}) {
  const t = useTranslations("companion");
  const { lines } = useLesson();
  const current = useCurrentSentence();
  const controller = usePlaybackController();
  const thread = useKorumeThread({ anchor });
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  // False at mount: a sheet that mounts already open (the first open) still takes focus.
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) sheetRef.current?.querySelector<HTMLTextAreaElement>("[data-korume-composer]")?.focus();
    if (!open && wasOpen.current) onReturnFocus();
    wasOpen.current = open;
  }, [onReturnFocus, open]);
  useEffect(() => {
    if (thread.notice?.kind === "disabled") onClose();
  }, [onClose, thread.notice]);

  const index = lines.findIndex((line) => line.id === anchor.lineId);
  const line = index >= 0 ? lines[index] : undefined;
  const quoted = line ? Array.from(line.textJp) : [];
  const chipText = quoted.length > CHIP_CHARS ? `${quoted.slice(0, CHIP_CHARS).join("")}…` : quoted.join("");
  const currentLineId = current.index === null ? undefined : lines[current.index]?.id;
  const locked = thread.notice !== null && LOCKING_NOTICES.has(thread.notice.kind);

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={!open}
      data-testid="korume-sheet"
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
      }}
      className={`${open ? "flex" : "hidden"} absolute bottom-md right-md z-20 h-[--korume-popup-height] max-h-[calc(100%-2*var(--space-md))] w-[--korume-sheet-width] min-w-[--korume-sheet-min] max-w-[100vw] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-overlay`}
      // Both lines explicit: an absolutely positioned grid item's `auto` end line is the container's EDGE, so
      // `gridRow: "2"` alone ran the popup down under the drawer bar (measured 2026-10-03).
      style={{ gridRow: "2 / 3", gridColumn: "-2 / -1" }}
    >
      <header className="flex items-center gap-sm border-b border-border px-md py-sm">
        <h2 id={titleId} className="flex-1 text-body-lg font-semibold text-foreground">{t("ask.sheet.title")}</h2>
        {thread.created ? (
          <Link href={`/korume/chat?thread=${thread.threadId}`} className="rounded-md px-xs text-caption font-medium text-primary-strong hover:bg-primary/10">
            {t("ask.sheet.expand")}
          </Link>
        ) : (
          <button type="button" disabled className="rounded-md px-xs text-caption font-medium text-muted-foreground opacity-60">{t("ask.sheet.expand")}</button>
        )}
        <button type="button" aria-label={t("ask.sheet.close")} onClick={onClose} className="flex aspect-square h-control-sm items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div className="flex flex-wrap items-center gap-xs border-b border-border px-md py-xs">
        {line ? (
          <button
            type="button"
            aria-label={`${t("ask.sheet.anchor")}: ${line.textJp}`}
            onClick={() => controller.seekToSentence(index)}
            className="min-w-0 truncate rounded-full bg-muted px-sm py-2xs text-caption text-foreground hover:bg-muted/80"
          >
            <span lang="ja" className="font-jp">「{chipText}」</span> · {clock(line.startTime)}
          </button>
        ) : null}
        {currentLineId && currentLineId !== anchor.lineId ? (
          <button type="button" onClick={onAskCurrent} className="rounded-full px-sm py-2xs text-caption font-medium text-primary-strong hover:bg-primary/10">
            {t("ask.sheet.askCurrent")}
          </button>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-md py-md">
        <MessageList messages={thread.messages} pending={thread.pending} onFollowup={locked ? undefined : (text) => void thread.send(text)} onRetry={() => void thread.retry()} />
      </div>
      <div className="flex flex-col gap-sm border-t border-border px-md py-sm">
        {thread.notice ? <TurnNotice notice={thread.notice} /> : null}
        <Composer onSend={(text) => void thread.send(text)} disabled={locked} placeholder={t("ask.composerPlaceholder")} />
      </div>
    </div>
  );
}
