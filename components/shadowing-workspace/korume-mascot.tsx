"use client";

import { useCallback, useRef, useState, type RefObject } from "react";
import { useTranslations } from "@/lib/i18n";
import { CompanionSprite } from "@/components/companion/companion-sprite";
import type { DraftAnchor } from "@/components/korume/use-korume-thread";
import { selectionToSpan } from "@/lib/shadowing-workspace/selection-offsets";
import type { Rect } from "@/lib/korume/sheet-geometry";
import { useCurrentSentence, useLesson } from "./workspace-context";
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

  return { open, draft, openSheet, close: useCallback(() => setOpen(false), []), askCurrent, rememberSelection, launcherRect, sizes };
}

/** The floating mascot at the bottom right of the transcript column — never over the video. */
export function KorumeMascot({ onOpen, onPress, mascotRef }: {
  onOpen: () => void;
  onPress: () => void;
  mascotRef: RefObject<HTMLDivElement>;
}) {
  const t = useTranslations("companion");
  return (
    <div
      ref={mascotRef}
      data-testid="korume-mascot"
      onPointerDown={onPress}
      className="pointer-events-auto absolute bottom-md right-md z-10"
    >
      <CompanionSprite pose="sitting" onActivate={onOpen} label={t("ask.open")} />
    </div>
  );
}
