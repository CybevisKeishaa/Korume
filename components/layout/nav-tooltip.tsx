"use client";

import { useCallback, useEffect, useId, useState } from "react";

/** One tooltip per AppNav for the rail (spec 3.6). position: fixed, so the scroll region cannot clip it (plan P3);
 * shown on hover and keyboard focus, hidden on leave, blur, Escape and any scroll. */
export function useNavTooltip(enabled: boolean) {
  const id = useId();
  const [tip, setTip] = useState<{ label: string; left: number; top: number; owner: string } | null>(null);
  const hide = useCallback(() => setTip(null), []);

  useEffect(() => {
    if (!tip) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [tip, hide]);
  useEffect(() => { if (!enabled) setTip(null); }, [enabled]);

  const bind = (label: string) => {
    const show = (event: React.SyntheticEvent<HTMLElement>) => {
      if (!enabled) return;
      const rect = event.currentTarget.getBoundingClientRect();
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
