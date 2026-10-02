"use client";

import { useEffect, useRef, type RefObject } from "react";

type Offset = { x: number; y: number };
type Box = { left: number; top: number; right: number; bottom: number };

const KEY_STEP = 16;
/** A press that travels less than this is a click (play/pause on the video), not a drag. */
const DRAG_THRESHOLD = 4;
const KEY_DELTAS: Record<string, Offset> = {
  ArrowLeft: { x: -KEY_STEP, y: 0 }, ArrowRight: { x: KEY_STEP, y: 0 }, ArrowUp: { x: 0, y: -KEY_STEP }, ArrowDown: { x: 0, y: KEY_STEP },
};

/** Limits a move of `box` by (dx, dy) so the box stays inside a `width` × `height` viewport. */
export function clampPipDelta(box: Box, dx: number, dy: number, width: number, height: number): Offset {
  return {
    x: Math.min(Math.max(dx, -box.left), width - box.right),
    y: Math.min(Math.max(dy, -box.top), height - box.bottom),
  };
}

/**
 * Makes the whole Full Transcript PiP draggable: a press anywhere on the pane except a control, moved past
 * DRAG_THRESHOLD, moves the pane by a transform (the player's surface covers the iframe, so it never steals
 * the press) and swallows the click that ends it. For the keyboard it renders a focusable, pointer-transparent button over
 * the pane that moves it with the arrow keys. Mounted only in Full Transcript; unmounting clears the transform,
 * so the player goes back with no inline style. The iframe is never remounted.
 */
export function PipDragHandle({ paneRef, label }: { paneRef: RefObject<HTMLElement | null>; label: string }) {
  const offset = useRef<Offset>({ x: 0, y: 0 });

  const moveBy = (pane: HTMLElement, dx: number, dy: number, from: Offset, box: Box) => {
    const clamped = clampPipDelta(box, dx, dy, window.innerWidth, window.innerHeight);
    offset.current = { x: from.x + clamped.x, y: from.y + clamped.y };
    pane.style.transform = `translate(${offset.current.x}px, ${offset.current.y}px)`;
  };

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;
    let drag: { id: number; x: number; y: number; from: Offset; box: Box; moved: boolean } | null = null;
    let swallowClick = false;
    let swallowReset: ReturnType<typeof setTimeout> | undefined;
    // Moves and the release are read on window, not the pane: a fast drag leaves the pane on its first move.
    // No pointer capture either — it would retarget a plain click away from the video surface.
    const move = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.moved = true;
      }
      moveBy(pane, dx, dy, drag.from, drag.box);
    };
    const up = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      // The click a drag ends with is dispatched right after this pointerup; one released off the pane never
      // reaches it, so the flag clears on the next task instead of eating a later keyboard click.
      swallowClick = drag.moved;
      clearTimeout(swallowReset);
      swallowReset = setTimeout(() => { swallowClick = false; }, 0);
      drag = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, input, a, [role='slider']"))) return;
      event.preventDefault(); // no text selection while dragging
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from: offset.current, box: pane.getBoundingClientRect(), moved: false };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    const click = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.stopPropagation();
      event.preventDefault();
    };
    // A viewport that shrinks (window resize, leaving workspace fullscreen) must not strand the pane off-screen.
    const reclamp = () => moveBy(pane, 0, 0, offset.current, pane.getBoundingClientRect());
    pane.addEventListener("pointerdown", down);
    pane.addEventListener("click", click, true);
    window.addEventListener("resize", reclamp);
    return () => {
      clearTimeout(swallowReset);
      window.removeEventListener("resize", reclamp);
      pane.removeEventListener("pointerdown", down);
      pane.removeEventListener("click", click, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      pane.style.transform = "";
    };
  }, [paneRef]);

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="pointer-events-none absolute inset-0 z-20 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onKeyDown={(event) => {
        const delta = KEY_DELTAS[event.key];
        const pane = paneRef.current;
        if (!delta || !pane) return;
        event.preventDefault();
        moveBy(pane, delta.x, delta.y, offset.current, pane.getBoundingClientRect());
      }}
    />
  );
}
