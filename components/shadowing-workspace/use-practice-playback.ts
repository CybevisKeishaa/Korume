"use client";

import { useEffect, useRef } from "react";
import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";
import { usePlayerWiring } from "./playback-root";

/** Practice uses sentence boundaries; returning to Shadowing restores its session loop. */
export function usePracticePlayback(mode: PracticeModeId): void {
  const { loop, setLoop } = usePlayerWiring();
  const loopRef = useRef(loop);
  loopRef.current = loop;
  const saved = useRef<LoopConfig | null>(null);
  useEffect(() => {
    if (mode === "shadowing") {
      if (saved.current) setLoop(saved.current);
      saved.current = null;
      return;
    }
    if (saved.current === null) saved.current = loopRef.current;
    setLoop({ enabled: false, autoPause: true });
  }, [mode, setLoop]);
}
