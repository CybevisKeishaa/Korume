"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useRouter, useTranslations } from "@/lib/i18n";
import { unionGrounding } from "@/lib/korume/grounding";
import { Composer } from "@/components/korume/composer";
import { KorumeRail } from "@/components/korume/korume-rail";
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
 * Enlarge (owner ruling 2026-10-03) lifts the same popup to the middle of the screen with the thread's Learning
 * context beside it — the same conversation state, no navigation; Escape or the backdrop shrinks it back.
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
  const { video, lines } = useLesson();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
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
  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);
  const entities = useMemo(() => unionGrounding(thread.messages), [thread.messages]);

  const index = lines.findIndex((line) => line.id === anchor.lineId);
  const line = index >= 0 ? lines[index] : undefined;
  const quoted = line ? Array.from(line.textJp) : [];
  const chipText = quoted.length > CHIP_CHARS ? `${quoted.slice(0, CHIP_CHARS).join("")}…` : quoted.join("");
  const currentLineId = current.index === null ? undefined : lines[current.index]?.id;
  const locked = thread.notice !== null && LOCKING_NOTICES.has(thread.notice.kind);
  // Before the first send there is no thread yet: create it (anchor and all, idempotent by id), then go.
  const openFullChat = async () => {
    if (await thread.ensureThread().catch(() => false)) router.push(`/korume/chat?thread=${thread.threadId}`);
  };

  return (
    <>
      {open && expanded ? <div aria-hidden="true" data-testid="korume-backdrop" onClick={() => setExpanded(false)} className="fixed inset-0 z-30 bg-foreground/20" /> : null}
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
          if (expanded) setExpanded(false);
          else onClose();
        }}
        data-expanded={expanded}
        className={`${open ? "flex" : "hidden"} ${expanded
          ? "fixed inset-0 z-40 m-auto h-[--korume-expanded-height] w-[--korume-expanded-width]"
          : "absolute bottom-md right-md z-20 h-[--korume-popup-height] max-h-[calc(100%-2*var(--space-md))] w-[--korume-sheet-width] min-w-[--korume-sheet-min] max-w-[100vw]"
        } flex-col overflow-hidden rounded-lg border border-border bg-background shadow-overlay`}
        // Both lines explicit: an absolutely positioned grid item's `auto` end line is the container's EDGE, so
        // `gridRow: "2"` alone ran the popup down under the drawer bar (measured 2026-10-03).
        style={expanded ? undefined : { gridRow: "2 / 3", gridColumn: "-2 / -1" }}
      >
        <header className="flex items-center gap-sm border-b border-border px-md py-sm">
          <h2 id={titleId} className="flex-1 text-body-lg font-semibold text-foreground">{t("ask.sheet.title")}</h2>
          {thread.created ? (
            <Link href={`/korume/chat?thread=${thread.threadId}`} className="rounded-md px-xs text-caption font-medium text-primary-strong hover:bg-primary/10">
              {t("ask.sheet.expand")}
            </Link>
          ) : (
            <button type="button" onClick={() => void openFullChat()} className="rounded-md px-xs text-caption font-medium text-primary-strong hover:bg-primary/10">
              {t("ask.sheet.expand")}
            </button>
          )}
          <button type="button" aria-label={t(expanded ? "ask.sheet.shrink" : "ask.sheet.enlarge")} onClick={() => setExpanded((e) => !e)} className="flex aspect-square h-control-sm items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={expanded ? "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"} />
            </svg>
          </button>
          <button type="button" aria-label={t("ask.sheet.close")} onClick={onClose} className="flex aspect-square h-control-sm items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </header>
        <div className={expanded ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]" : "flex min-h-0 flex-1 flex-col"}>
          <div className="flex min-h-0 flex-1 flex-col">
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
            <div data-korume-scroll className="min-h-0 flex-1 overflow-y-auto px-md py-md">
              <MessageList messages={thread.messages} pending={thread.pending} onFollowup={locked ? undefined : (text) => void thread.send(text)} onRetry={() => void thread.retry()} />
            </div>
            <div className="flex flex-col gap-sm border-t border-border px-md py-sm">
              {thread.notice ? <TurnNotice notice={thread.notice} /> : null}
              <Composer onSend={(text) => void thread.send(text)} disabled={locked} placeholder={t("ask.composerPlaceholder")} />
            </div>
          </div>
          {expanded ? (
            <div className="min-h-0 overflow-y-auto border-l border-border p-md">
              <KorumeRail
                anchor={line ? { videoId: video.id, videoTitle: video.title, lineId: line.id, lineText: line.textJp, translation: line.textTranslation, startTime: line.startTime, span: anchor.span } : null}
                entities={entities}
                memory={null}
              />
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
