"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/** One tooltip per AppNav for the rail (spec 3.6). position: fixed, so the scroll region cannot clip it (plan P3);
 * shown on hover and keyboard focus, hidden on leave, blur, Escape and on a scroll that moved its item. */
export function useNavTooltip(enabled: boolean) {
  const id = useId();
  const [tip, setTip] = useState<{ label: string; left: number; top: number; owner: string } | null>(null);
  const hide = useCallback(() => setTip(null), []);
  // The item the tip is anchored to and its top when placed. Chrome scrolls a Tab-focused item into view BEFORE the
  // focus event (so the tip is placed right) but dispatches that scroll's event a frame later: hiding on every scroll
  // erased the tip of any item below the fold (Task 9 R10). A scroll hides it only if it moved the item.
  const anchor = useRef<{ element: HTMLElement; top: number } | null>(null);

  useEffect(() => {
    if (!tip) return;
    const onScroll = () => {
      const placed = anchor.current;
      if (!placed || !placed.element.isConnected || Math.abs(placed.element.getBoundingClientRect().top - placed.top) > 0.5) hide();
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [tip, hide]);
  useEffect(() => { if (!enabled) setTip(null); }, [enabled]);

  const bind = (label: string) => {
    const show = (event: React.SyntheticEvent<HTMLElement>) => {
      if (!enabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
      anchor.current = { element: event.currentTarget, top: rect.top };
      setTip({ label, left: rect.right + 10, top: rect.top + rect.height / 2, owner: label });
    };
    return {
      onPointerEnter: show,
      onPointerLeave: hide,
      onFocus: show,
      onBlur: hide,
      onKeyDown: (event: React.KeyboardEvent) => { if (event.key === "Escape") hide(); },
      "aria-describedby": enabled && tip?.owner === label ? id : undefined,
    };
  };

  const tooltip = enabled && tip
    ? <span role="tooltip" id={id} className="nav-tooltip" style={{ left: tip.left, top: tip.top }}>{tip.label}</span>
    : null;
  return { tooltip, bind };
}
