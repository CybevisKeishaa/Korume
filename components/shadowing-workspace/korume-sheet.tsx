"use client";

import { useCallback, type CSSProperties, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import { Link, useTranslations } from "@/lib/i18n";
import { railEntities } from "@/lib/korume/grounding";
import { besideLauncher, centred, clampRail, clampRect, resizeRect, type Edge, type Rect, type SheetBounds } from "@/lib/korume/sheet-geometry";
import { Composer } from "@/components/korume/composer";
import { clock, KorumeRail, type SmallMemory } from "@/components/korume/korume-rail";
import { ConversationHeader, MessageList } from "@/components/korume/message-list";
import { TurnNotice } from "@/components/korume/turn-notice";
import { LOCKING_NOTICES, useKorumeThread, type DraftAnchor } from "@/components/korume/use-korume-thread";
import { useCurrentSentence, useLesson, usePlaybackController } from "./workspace-context";
import { useGuardedNavigation } from "./practice/unsaved-take-guard";
import { tokenPixels } from "./workspace-divider";

export interface Size { w: number; h: number }
export type SheetSizes = { small: Size; large: Size };

const CHIP_CHARS = 18;

/** Token values in px, resolved once per open and per window resize — never on a pointermove. */
interface Metrics extends Pick<SheetBounds, "margin" | "minW" | "minH"> { breakpoint: number; small: Size; large: Size; railMin: number; railMax: number; railDefault: number; chatMin: number; handle: number }
function resolveMetrics(): Metrics {
  const px = (token: string) => tokenPixels(document.body, token);
  return {
    railMin: px("--korume-rail-min"), railMax: px("--korume-rail-max"), railDefault: px("--korume-rail-default"), chatMin: px("--korume-chat-min"), handle: px("--korume-handle"),
    margin: px("--space-md"), minW: px("--korume-min-w"), minH: px("--korume-min-h"), breakpoint: px("--korume-breakpoint"),
    small: { w: px("--korume-small-w"), h: px("--korume-small-h") }, large: { w: px("--korume-large-w"), h: px("--korume-large-h") },
  };
}

/** The OS setting and the app's own toggle both land on this attribute (appearance script); the media query covers a late change. */
const reducesMotion = () => document.documentElement.dataset.reduceMotion === "true" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Hit areas on the sheet's own edge; an ember hairline shows on hover and while dragging (corners tint instead). */
const HAIRLINE = "after:absolute after:bg-primary/60 after:opacity-0 hover:after:opacity-100 active:after:opacity-100";
const HANDLES: Record<Edge, string> = {
  n: `inset-x-[--korume-handle] top-0 h-[--korume-handle] cursor-ns-resize ${HAIRLINE} after:inset-x-0 after:top-0 after:h-px`,
  s: `inset-x-[--korume-handle] bottom-0 h-[--korume-handle] cursor-ns-resize ${HAIRLINE} after:inset-x-0 after:bottom-0 after:h-px`,
  w: `inset-y-[--korume-handle] left-0 w-[--korume-handle] cursor-ew-resize ${HAIRLINE} after:inset-y-0 after:left-0 after:w-px`,
  e: `inset-y-[--korume-handle] right-0 w-[--korume-handle] cursor-ew-resize ${HAIRLINE} after:inset-y-0 after:right-0 after:w-px`,
  nw: "left-0 top-0 size-[--korume-handle] cursor-nwse-resize hover:bg-primary/30",
  se: "bottom-0 right-0 size-[--korume-handle] cursor-nwse-resize hover:bg-primary/30",
  ne: "right-0 top-0 size-[--korume-handle] cursor-nesw-resize hover:bg-primary/30",
  sw: "bottom-0 left-0 size-[--korume-handle] cursor-nesw-resize hover:bg-primary/30",
};

/** `rail` is set only for a splitter drag: the rail width it started from. */
interface Drag { id: number; x: number; y: number; start: Rect; edge: Edge | null; wasLarge: boolean; rail?: number }

const RAIL_KEY = "korume.rail";
// Private mode and blocked storage throw; a missing, empty or non-numeric value is no preference.
function storedRail(): number | null {
  try {
    const raw = localStorage.getItem(RAIL_KEY);
    const n = raw === null || raw === "" ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

/**
 * Korume beside the transcript (spec §5.1, §6.2): a non-modal, fixed sheet with an inline rect that the learner drags
 * by the header and resizes by any edge or corner. One sheet, two layouts: below the breakpoint width it is the small
 * chat beside the mascot, at or above it the large one (chat + Learning context) centred in the viewport. The player
 * is never wrapped, resized or remounted, and neither is the thread: a toggle only moves the rect. The anchor is fixed
 * for the life of the draft. Kept mounted while closed, so reopening returns to the thread — but every open starts
 * small beside the mascot, at the last small size used (R1).
 */
export function KorumeSheet({ open, anchor, onClose, onAskCurrent, onReturnFocus, launcherRect, sizes }: {
  open: boolean;
  anchor: DraftAnchor;
  onClose: () => void;
  onAskCurrent: () => void;
  /** Where focus goes when the sheet closes: the mascot that opened it. */
  onReturnFocus: () => void;
  /** The mascot's last rect (it is unmounted while the sheet is open); null before it was ever measured. */
  launcherRect: () => Rect | null;
  /** Last small and large size of this workspace mount; shared with the overlay hook so a new draft keeps them. */
  sizes: MutableRefObject<SheetSizes | null>;
}) {
  const t = useTranslations("companion");
  const { video, lines } = useLesson();
  // Through the unsaved-take guard: leaving for the full chat would otherwise drop an unsaved take silently.
  const navigate = useGuardedNavigation();
  const current = useCurrentSentence();
  const controller = usePlaybackController();
  const thread = useKorumeThread({ anchor });
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  // False at mount: a sheet that mounts already open (the first open) still takes focus.
  const wasOpen = useRef(false);
  const metrics = useRef<Metrics | null>(null);
  const rectRef = useRef<Rect | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [gliding, setGliding] = useState(false);
  const drag = useRef<Drag | null>(null);
  const glideTimer = useRef<ReturnType<typeof setTimeout>>();
  const railId = useId();
  // The width the learner asked for; the one drawn is clamped to the sheet, so widening the sheet again gives it back.
  const [wantedRail, setWantedRail] = useState<number | null>(null);
  const railRef = useRef<number | null>(null);
  const setRail = useCallback((n: number) => { railRef.current = n; setWantedRail(n); }, []);
  const saveRail = () => { try { if (railRef.current !== null) localStorage.setItem(RAIL_KEY, String(railRef.current)); } catch { /* private mode: kept for this open only */ } };

  const commit = useCallback((next: Rect) => { rectRef.current = next; setRect(next); }, []);
  const bounds = useCallback((): SheetBounds => ({ vw: window.innerWidth, vh: window.innerHeight, ...(metrics.current as Metrics) }), []);
  const isLarge = (r: Rect | null) => r !== null && metrics.current !== null && r.w >= metrics.current.breakpoint;
  const beside = useCallback((size: Size): Rect => {
    const b = bounds();
    return besideLauncher(size, launcherRect() ?? { x: b.vw - b.margin, y: b.vh - b.margin, w: 0, h: 0 }, b);
  }, [bounds, launcherRect]);
  /** The first small and large sizes are the tokens; after that, whatever the learner last left them at. */
  const remember = useCallback((r: Rect) => {
    const m = metrics.current;
    if (m) sizes.current = { ...(sizes.current ?? { small: m.small, large: m.large }), [r.w >= m.breakpoint ? "large" : "small"]: { w: r.w, h: r.h } };
  }, [sizes]);
  // A glide is the `data-gliding` transition for one --duration-base; a jump (reduced motion) never sets it.
  const glideTo = useCallback((next: Rect) => {
    clearTimeout(glideTimer.current);
    if (!reducesMotion()) {
      setGliding(true);
      glideTimer.current = setTimeout(() => setGliding(false), parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--duration-base")) || 0);
    }
    commit(next);
  }, [commit]);
  const toggle = useCallback(() => {
    const r = rectRef.current;
    if (!r || !metrics.current) return;
    remember(r);
    glideTo(isLarge(r) ? beside(sizes.current?.small ?? metrics.current.small) : centred(sizes.current?.large ?? metrics.current.large, bounds()));
  }, [beside, bounds, glideTo, remember, sizes]);

  useLayoutEffect(() => {
    if (!open) return;
    metrics.current = resolveMetrics();
    clearTimeout(glideTimer.current);
    setGliding(false);
    commit(beside(sizes.current?.small ?? metrics.current.small));
    const stored = storedRail();
    if (stored !== null) setRail(stored);
  }, [beside, commit, open, setRail, sizes]);
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      metrics.current = resolveMetrics();
      if (rectRef.current) commit(clampRect(rectRef.current, bounds()));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bounds, commit, open]);
  useEffect(() => () => clearTimeout(glideTimer.current), []);
  // A sheet that closes or unmounts mid-drag (a disabled notice, a hidden workspace) must not leave the page unselectable.
  useEffect(() => {
    if (!open) return;
    return () => { drag.current = null; document.body.style.userSelect = ""; };
  }, [open]);

  useEffect(() => {
    if (open && !wasOpen.current) sheetRef.current?.querySelector<HTMLTextAreaElement>("[data-korume-composer]")?.focus();
    if (!open && wasOpen.current) onReturnFocus();
    wasOpen.current = open;
  }, [onReturnFocus, open]);
  useEffect(() => {
    if (thread.notice?.kind === "disabled") onClose();
  }, [onClose, thread.notice]);
  // R7: the rail's memory comes from the thread detail. Refetched only when large, created, and an answer landed since.
  const [memory, setMemory] = useState<SmallMemory | null>(null);
  const answered = thread.messages.filter((message) => message.role === "assistant").length;
  const memoryFor = useRef<number | null>(null);
  const showRail = open && rect !== null && rect.w >= (metrics.current?.breakpoint ?? Infinity);
  useEffect(() => {
    if (!showRail || !thread.created || memoryFor.current === answered) return;
    const abort = new AbortController();
    fetch(`/api/korume/threads/${thread.threadId}`, { cache: "no-store", signal: abort.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const detail = (await response.json()) as { memory?: SmallMemory | null };
        memoryFor.current = answered;
        setMemory(detail.memory ?? null);
      })
      .catch(() => { /* a failed or aborted fetch keeps the last memory */ });
    return () => abort.abort();
  }, [answered, showRail, thread.created, thread.threadId]);
  const entities = useMemo(() => railEntities(thread.messages), [thread.messages]);

  // Pointer capture keeps the drag on the handle or header however fast the pointer leaves it. No selection while it runs.
  const startDrag = (event: ReactPointerEvent<HTMLElement>, edge: Edge | null) => {
    const start = rectRef.current;
    if (event.button !== 0 || !start || (edge === null && (event.target as HTMLElement).closest("button, a"))) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = "none";
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start, edge, wasLarge: isLarge(start) };
  };
  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    // The splitter sits left of the rail: dragging it left grows the rail.
    if (d.rail !== undefined) return setRail(clampRailIn(d.rail - dx, d.start.w, metrics.current as Metrics));
    // Mid-drag the rect only follows the pointer: crossing the breakpoint never re-centres under it.
    commit(d.edge ? resizeRect(d.start, d.edge, dx, dy, bounds()) : clampRect({ ...d.start, x: d.start.x + dx, y: d.start.y + dy }, bounds()));
  };
  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    document.body.style.userSelect = "";
    document.getSelection()?.removeAllRanges();
    if (d.rail !== undefined) return saveRail();
    const r = rectRef.current;
    if (!r) return;
    remember(r);
    // Crossing small → large by dragging a handle glides to the middle, on release only.
    if (d.edge && !d.wasLarge && isLarge(r)) glideTo(centred(r, bounds()));
  };
  const dragProps = { onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: endDrag };
  const m = metrics.current;
  // The splitter column takes its own width out of what the chat and the rail share.
  const clampRailIn = (rail: number, sheetW: number, k: Metrics) => clampRail(rail, sheetW - k.handle, k);
  const railW = m && rect ? clampRailIn(wantedRail ?? m.railDefault, rect.w, m) : 0;
  const splitterDown = (event: ReactPointerEvent<HTMLElement>) => {
    const start = rectRef.current;
    if (event.button !== 0 || !start) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = "none";
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start, edge: null, wasLarge: true, rail: railW };
  };
  const splitterKey = (event: ReactKeyboardEvent<HTMLElement>) => {
    const dir = event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;
    if (!dir || !m || !rect) return;
    event.preventDefault();
    setRail(clampRailIn(railW + dir * m.margin, rect.w, m));
    saveRail();
  };

  const index = lines.findIndex((line) => line.id === anchor.lineId);
  const line = index >= 0 ? lines[index] : undefined;
  const quoted = line ? Array.from(line.textJp) : [];
  const chipText = quoted.length > CHIP_CHARS ? `${quoted.slice(0, CHIP_CHARS).join("")}…` : quoted.join("");
  const currentLineId = current.index === null ? undefined : lines[current.index]?.id;
  const locked = thread.notice !== null && LOCKING_NOTICES.has(thread.notice.kind);
  const large = isLarge(rect);
  // Before the first send there is no thread yet: create it (anchor and all, idempotent by id), then go.
  const openFullChat = async () => {
    if (await thread.ensureThread().catch(() => false)) navigate(`/korume/chat?thread=${thread.threadId}`);
  };
  const iconButton = "flex aspect-square h-control-sm items-center justify-center rounded-md text-muted-foreground hover:bg-muted";
  const chatLink = "flex items-center gap-xs rounded-md px-xs py-2xs text-caption font-medium text-primary-strong hover:bg-primary/10";
  const chatContent = (
    <>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17 17 7M9 7h8v8" /></svg>
      {large ? t("ask.sheet.allChats") : null}
    </>
  );
  // Large shows its own text as the name; small is an icon, so it carries the label.
  const chatLabel = large ? undefined : t("ask.sheet.expand");

  return (
    <div
      ref={sheetRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      hidden={!open}
      data-testid="korume-sheet"
      data-layout={large ? "large" : "small"}
      data-gliding={gliding ? "" : undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        if (large) toggle();
        else onClose();
      }}
      className={`${open ? "flex" : "hidden"} fixed z-40 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-overlay`}
      style={rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined}
    >
      <header
        data-korume-drag
        onPointerDown={(event) => startDrag(event, null)}
        onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button, a")) toggle(); }}
        {...dragProps}
        className="flex cursor-grab touch-none items-center gap-sm border-b border-border px-md py-sm active:cursor-grabbing"
      >
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-body-lg font-semibold text-foreground">{t("ask.sheet.title")}</h2>
          <p className="truncate text-caption text-muted-foreground">{t(large ? "ask.sheet.tagline" : "ask.chat.knowledge")}</p>
        </div>
        {thread.created ? (
          <Link href={`/korume/chat?thread=${thread.threadId}`} aria-label={chatLabel} className={chatLink}>{chatContent}</Link>
        ) : (
          <button type="button" aria-label={chatLabel} onClick={() => void openFullChat()} className={chatLink}>{chatContent}</button>
        )}
        <button type="button" aria-label={t(large ? "ask.sheet.shrink" : "ask.sheet.enlarge")} onClick={toggle} className={iconButton}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={large ? "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"} />
          </svg>
        </button>
        <button type="button" aria-label={t("ask.sheet.close")} onClick={onClose} className={iconButton}>
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>
      <div
        className={large ? "grid min-h-0 flex-1 grid-cols-[minmax(var(--korume-chat-min),1fr)_auto_var(--korume-rail-w)]" : "flex min-h-0 flex-1 flex-col"}
        style={large ? ({ "--korume-rail-w": `${railW}px` } as CSSProperties) : undefined}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {large ? null : (
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
          )}
          {/* A scrollbar sits on the border-box edge, so where this scroller meets the sheet edge (small layout; the rail below) a margin keeps its bar clear of the 10px east resize handle. */}
          <div data-korume-scroll className={`korume-scroll min-h-0 flex-1 space-y-lg overflow-y-auto px-md py-md ${large ? "" : "mr-[--korume-handle]"}`}>
            <ConversationHeader messages={thread.messages} />
            <MessageList messages={thread.messages} pending={thread.pending} onFollowup={locked ? undefined : (text) => void thread.send(text)} onRetry={() => void thread.retry()} />
          </div>
          <div className="flex flex-col gap-sm border-t border-border px-md py-sm">
            {thread.notice ? <TurnNotice notice={thread.notice} /> : null}
            <Composer onSend={(text) => void thread.send(text)} disabled={locked} placeholder={t("ask.composerPlaceholder")} />
          </div>
        </div>
        {large && m ? (
          <div
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={t("ask.sheet.splitter")}
            aria-controls={railId}
            aria-valuenow={Math.round(railW)}
            aria-valuemin={Math.round(m.railMin)}
            aria-valuemax={Math.round(clampRailIn(Infinity, rect?.w ?? 0, m))}
            onPointerDown={splitterDown}
            onKeyDown={splitterKey}
            onDoubleClick={() => { setRail(m.railDefault); saveRail(); }}
            {...dragProps}
            className="relative w-[--korume-handle] cursor-col-resize touch-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:bg-border hover:after:bg-primary/60 focus-visible:after:bg-primary active:after:bg-primary/60 focus-visible:outline-none"
          />
        ) : null}
        {large ? (
          <div id={railId} data-korume-rail className="korume-scroll mr-[--korume-handle] min-h-0 overflow-y-auto p-md">
            <KorumeRail
              anchor={line ? { videoId: video.id, videoTitle: video.title, lineId: line.id, lineText: line.textJp, translation: line.textTranslation, startTime: line.startTime, span: anchor.span } : null}
              entities={entities}
              memory={memory}
            />
          </div>
        ) : null}
      </div>
      {(Object.keys(HANDLES) as Edge[]).map((edge) => (
        <div
          key={edge}
          aria-hidden="true"
          data-korume-handle={edge}
          onPointerDown={(event) => startDrag(event, edge)}
          {...dragProps}
          className={`absolute touch-none ${HANDLES[edge]}`}
        />
      ))}
    </div>
  );
}
