"use client";

import { useEffect, useRef } from "react";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";
import { usePlayerWiring } from "./playback-root";
import { usePlaybackController } from "./workspace-context";

/**
 * Practice uses sentence boundaries; returning to Shadowing restores its session loop. Entering a practice mode
 * (a switch, or a fresh load once the player is ready) plays its current sentence once (spec 2026-10-31 D5).
 */
export function usePracticePlayback(mode: PracticeModeId): void {
  const { loop, setLoop, ready } = usePlayerWiring();
  const controller = usePlaybackController();
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const saved = useRef<LoopConfig | null>(null);
  const playedOnEntry = useRef<PracticeModeId | null>(null);
  useEffect(() => {
    if (mode === "shadowing") {
      if (saved.current) setLoop(saved.current);
      saved.current = null;
      return;
    }
    if (saved.current === null) saved.current = loopRef.current;
    setLoop({ enabled: false, autoPause: true });
  }, [mode, setLoop]);
  // After the loop effect, so the entry play already runs with the loop off.
  useEffect(() => {
    if (mode === "shadowing") { playedOnEntry.current = null; return; }
    if (!ready || playedOnEntry.current === mode) return;
    playedOnEntry.current = mode;
    controller.play();
  }, [controller, mode, ready]);
}
