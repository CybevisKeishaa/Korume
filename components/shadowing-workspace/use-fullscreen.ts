"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FullscreenTarget } from "@/lib/shadowing-workspace/workspace-view";

type SetFullscreen = (target: FullscreenTarget) => void;

/** Nesting depth: the player can go fullscreen from inside the fullscreen workspace. */
const LEVEL: Record<FullscreenTarget, number> = { none: 0, workspace: 1, player: 2 };

/** Keeps the session's desired fullscreen target aligned with the browser's Fullscreen API. */
export function useFullscreen(
  rootRef: RefObject<HTMLElement>,
  playerRef: RefObject<HTMLElement>,
  setFullscreen: SetFullscreen,
): { requestFullscreen(target: Exclude<FullscreenTarget, "none">, trigger: HTMLElement): void; supported: boolean } {
  // One trigger per target: player fullscreen can be entered from inside workspace fullscreen, and each exit
  // returns focus to the button that entered THAT level.
  const triggersRef = useRef<Partial<Record<Exclude<FullscreenTarget, "none">, HTMLElement>>>({});
  const fullscreenRef = useRef<FullscreenTarget>("none");
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(document.fullscreenEnabled);
    const onChange = () => {
      const element = document.fullscreenElement;
      const target = playerRef.current?.contains(element) ? "player" : rootRef.current?.contains(element) ? "workspace" : "none";
      setFullscreen(target);
      const previous = fullscreenRef.current;
      if (previous !== "none" && LEVEL[target] < LEVEL[previous]) {
        triggersRef.current[previous]?.focus({ preventScroll: true });
        delete triggersRef.current[previous];
      }
      fullscreenRef.current = target;
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [playerRef, rootRef, setFullscreen]);

  const requestFullscreen = useCallback((target: Exclude<FullscreenTarget, "none">, trigger: HTMLElement) => {
    triggersRef.current[target] = trigger;
    const element = target === "workspace" ? rootRef.current : playerRef.current;
    if (!element || typeof element.requestFullscreen !== "function") return;
    if (document.fullscreenElement === element) {
      void document.exitFullscreen().catch(() => setFullscreen(fullscreenRef.current));
      return;
    }
    setFullscreen(target);
    // A refused request leaves the browser where it was (e.g. still in workspace fullscreen), not at "none".
    void element.requestFullscreen().catch(() => setFullscreen(fullscreenRef.current));
  }, [playerRef, rootRef, setFullscreen]);
  return { requestFullscreen, supported };
}
