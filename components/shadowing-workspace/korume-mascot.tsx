"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { useTranslations } from "@/lib/i18n";
import { CompanionSprite } from "@/components/companion/companion-sprite";
import type { DraftAnchor } from "@/components/korume/use-korume-thread";
import { selectionToSpan } from "@/lib/shadowing-workspace/selection-offsets";
import { clampPoint, parseStoredPoint, type Point, type Rect } from "@/lib/korume/sheet-geometry";
import { useCurrentSentence, useLesson } from "./workspace-context";
import { tokenPixels } from "./workspace-divider";
import type { SheetSizes } from "./korume-sheet";

export interface KorumeDraft { key: string; anchor: DraftAnchor }

/**
 * The overlay's state, held by the workspace layout so Escape and `k` can reach it (spec §6.2). A draft lives for
 * this mount only: close + reopen returns to it; a reload starts a new one from the current line. Opening captures
 * the anchor — the open selection's span when there is one, else the active line — and never changes it after.
 */
export function useKorumeOverlay(workspaceRef: RefObject<HTMLElement>, mascotRef: RefObject<HTMLElement>) {
  const { video, lines } = useLesson();
  const current = useCurrentSentence();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<KorumeDraft | null>(null);
  /** The selection as it was when the pointer went down on the mascot — a click can collapse it before `onClick`. */
  const pressedSelection = useRef<ReturnType<typeof selectionToSpan>>(null);
  /** The mascot is unmounted while the sheet is open, so its rect is read before it goes and kept for the sheet. */
  const launcher = useRef<Rect | null>(null);
  /** Last small and large sheet size of this mount (R1): a new draft keeps them. */
  const sizes = useRef<SheetSizes | null>(null);
  const measureLauncher = useCallback(() => {
    const box = mascotRef.current?.getBoundingClientRect();
    if (box) launcher.current = { x: box.x, y: box.y, w: box.width, h: box.height };
  }, [mascotRef]);
  const launcherRect = useCallback(() => launcher.current, []);

  const currentAnchor = useCallback((): DraftAnchor | null => {
    // Before the first line (an intro) the first line is the one about to play — as `nextTarget` reads it — so the
    // mascot and `k` never go dead.
    const line = lines[current.index ?? 0];
    return line ? { videoId: video.id, lineId: line.id, span: null } : null;
  }, [current.index, lines, video.id]);

  const captureAnchor = useCallback((): DraftAnchor | null => {
    const root = workspaceRef.current;
    const picked = pressedSelection.current ?? (root ? selectionToSpan(document.getSelection(), root) : null);
    pressedSelection.current = null;
    if (picked) return { videoId: video.id, lineId: picked.lineId, span: picked.span };
    return currentAnchor();
  }, [currentAnchor, video.id, workspaceRef]);

  const openSheet = useCallback(() => {
    measureLauncher();
    if (!draft) {
      const anchor = captureAnchor();
      if (!anchor) return;
      setDraft({ key: crypto.randomUUID(), anchor });
    }
    setOpen(true);
  }, [captureAnchor, draft, measureLauncher]);

  const askCurrent = useCallback(() => {
    const anchor = currentAnchor();
    if (anchor) setDraft({ key: crypto.randomUUID(), anchor });
  }, [currentAnchor]);

  const rememberSelection = useCallback(() => {
    const root = workspaceRef.current;
    pressedSelection.current = root ? selectionToSpan(document.getSelection(), root) : null;
    measureLauncher();
  }, [measureLauncher, workspaceRef]);

  return { open, draft, openSheet, close: useCallback(() => setOpen(false), []), askCurrent, rememberSelection, measureLauncher, launcherRect, sizes };
}

const LAUNCHER_KEY = "korume.launcher";
/** A press that travels less than this is a click (open), not a drag — as in `PipDragHandle`. */
const DRAG_THRESHOLD = 4;
const KEY_DIRS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
// Private mode and blocked storage throw; garbage is no preference.
const storedPoint = () => { try { return parseStoredPoint(localStorage.getItem(LAUNCHER_KEY)); } catch { return null; } };

/**
 * The floating mascot (spec §5.3): fixed at the learner's remembered spot, else the transcript column's bottom right
 * (never over the video). Dragged by the pointer, nudged by the arrow keys; a drag ends without opening the sheet.
 * Drag listeners sit on window, not the wrapper — pointer capture would retarget the click that opens away from the button.
 */
export function KorumeMascot({ onOpen, onPress, onMove, mascotRef, workspaceRef }: {
  onOpen: () => void;
  onPress: () => void;
  /** Called after the mascot has moved, so the sheet's launcher rect follows it. */
  onMove: () => void;
  mascotRef: RefObject<HTMLDivElement>;
  /** The workspace root: the mascot stays inside it, as the sheet does. */
  workspaceRef: RefObject<HTMLElement>;
}) {
  const t = useTranslations("companion");
  const hintId = useId();
  const [pos, setPos] = useState<Point | null>(null);
  const posRef = useRef<Point | null>(null);
  const swallowClick = useRef(false);
  const stopDrag = useRef<(() => void) | null>(null);

  /** Clamps into the viewport, shows it, and optionally remembers it. */
  const place = useCallback((wanted: Point, save = false) => {
    const el = mascotRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    // Inside the workspace, not the bare viewport: the app's side navigation is above the mascot and would hide it
    // where it could no longer be grabbed.
    const area = workspaceRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
    const inside = clampPoint({ x: wanted.x - area.left, y: wanted.y - area.top }, { w: box.width, h: box.height }, { vw: Math.min(area.width || window.innerWidth, window.innerWidth), vh: Math.min(area.height || window.innerHeight, window.innerHeight), margin: tokenPixels(document.body, "--space-md") });
    const next = { x: inside.x + area.left, y: inside.y + area.top };
    posRef.current = next;
    setPos(next);
    if (save) try { localStorage.setItem(LAUNCHER_KEY, JSON.stringify(next)); } catch { /* private mode: kept for this mount only */ }
  }, [mascotRef, workspaceRef]);

  // Remembered spot, else the old one: the transcript cell's bottom right. A stored value is only ever clamped for
  // display, so a window that grows again gives it back.
  useLayoutEffect(() => {
    const el = mascotRef.current;
    const cell = el?.parentElement;
    if (!el || !cell) return;
    const settle = () => {
      const home = cell.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const margin = tokenPixels(document.body, "--space-md");
      place(storedPoint() ?? { x: home.right - box.width - margin, y: home.bottom - box.height - margin });
    };
    settle();
    // The root, not the window: a nav collapse or expand resizes the workspace without a window resize.
    const root = workspaceRef.current;
    if (!root) return;
    const observer = new ResizeObserver(settle);
    observer.observe(root);
    return () => observer.disconnect();
  }, [mascotRef, place, workspaceRef]);
  useLayoutEffect(() => { if (pos) onMove(); }, [onMove, pos]);
  useEffect(() => () => stopDrag.current?.(), []);

  const onPointerDown = (event: ReactPointerEvent) => {
    onPress();
    const from = posRef.current;
    if (event.button !== 0 || !from) return;
    const { pointerId, clientX, clientY } = event;
    let moved = false;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const dx = e.clientX - clientX;
      const dy = e.clientY - clientY;
      if (!moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        moved = true;
        document.body.style.userSelect = "none";
      }
      place({ x: from.x + dx, y: from.y + dy });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.userSelect = "";
      stopDrag.current = null;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      stop();
      if (!moved) return;
      if (posRef.current) place(posRef.current, true);
      // The click a drag ends with follows this pointerup at once; one released off the button never gets it.
      swallowClick.current = true;
      setTimeout(() => { swallowClick.current = false; }, 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    stopDrag.current = stop;
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const dir = KEY_DIRS[event.key];
    const from = posRef.current;
    if (!dir || !from) return;
    event.preventDefault();
    const step = tokenPixels(document.body, "--space-md");
    place({ x: from.x + dir[0] * step, y: from.y + dir[1] * step }, true);
  };

  return (
    <div
      ref={mascotRef}
      data-testid="korume-mascot"
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
      // Unplaced for one layout pass only. Not `visibility: hidden`: a hidden button cannot take the focus the sheet returns on close.
      style={pos ? { left: pos.x, top: pos.y } : { opacity: 0 }}
      className="pointer-events-auto fixed z-10 touch-none"
    >
      <CompanionSprite pose="sitting" onActivate={onOpen} label={t("ask.open")} describedBy={hintId} />
      <span id={hintId} className="sr-only">{t("ask.sheet.moveMascot")}</span>
    </div>
  );
}
