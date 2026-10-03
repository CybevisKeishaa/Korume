"use client";

import { useEffect } from "react";
import { shortcutFor } from "@/lib/shadowing-workspace/shortcuts";

export interface WorkspaceShortcutActions {
  togglePlay(): void;
  previousSentence(): void;
  nextSentence(): void;
  rewind(seconds: number): void;
  toggleLoop(): void;
  toggleFocus(): void;
  /** Absent when Korume is turned off: then `k` does nothing at all (Ask Korume spec §6.2). */
  askKorume?: () => void;
}

/** Global workspace keys deliberately delegate to the same controller/setters as visible controls. */
export function useWorkspaceShortcuts(actions: WorkspaceShortcutActions): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const shortcut = shortcutFor(event);
      if (event.repeat && (shortcut === "toggle-play" || shortcut === "toggle-loop" || shortcut === "toggle-focus")) return;
      switch (shortcut) {
        case "toggle-play": event.preventDefault(); actions.togglePlay(); break;
        case "previous-sentence": actions.previousSentence(); break;
        case "next-sentence": actions.nextSentence(); break;
        case "rewind-5": actions.rewind(5); break;
        case "toggle-loop": actions.toggleLoop(); break;
        case "toggle-focus": actions.toggleFocus(); break;
        case "ask-korume": if (actions.askKorume && !event.repeat) { event.preventDefault(); actions.askKorume(); } break;
        default: break;
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [actions]);
}
