"use client";

import { useEffect, type ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { locateSentence } from "@/lib/shadowing-workspace/sentence-lookup";
import { useCurrentSentence, useLesson, usePlaybackController, useStartPosition } from "../workspace-context";

export function PracticePanel({ label, header, navigator, feedback, actions, children }: {
  label: string;
  /** Listening's exercise header and toolbar (spec §3.1, §3.2), above the navigator. */
  header?: ReactNode;
  navigator: ReactNode;
  feedback: ReactNode;
  /**
   * Listening's action row (A3 §3.6): the panel's footer. Full-bleed and flush with the panel's bottom edge — owner
   * 2026-10-31: pinned at `bottom-0` it stopped inside the panel's padding, so scrolled content showed through a strip
   * beneath it, and with short content it floated mid-panel. `mt-auto` keeps it at the bottom when content is short.
   */
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    // The scroll padding keeps a focused control from scrolling in under the footer: its whole visible height
    // (Check + pt-sm + pb-md + the border).
    <section aria-label={label} className={`practice-panel flex h-full min-h-0 flex-col gap-md overflow-y-auto p-md${actions ? " scroll-pb-[calc(var(--control-md)+var(--space-sm)+var(--space-md)+1px)]" : ""}`} data-testid="practice-panel">
      {header}
      <div>{navigator}</div>
      <div className="flex flex-col gap-md">{children}</div>
      {/* An empty feedback (`data-empty`, 0 high before any result) gives its gap back: a 20-piece word line fits
          above the listen-only dock with no scroll (case 22, measured 2026-11-03: the gap was 14px of nothing). */}
      <div className="has-[>[data-empty]]:-mt-md">{feedback}</div>
      {actions && <div data-testid="practice-actions" className="sticky bottom-[calc(-1*var(--space-md))] -mx-md -mb-md mt-auto flex flex-wrap items-center justify-center gap-sm border-t border-border bg-card/90 px-md pb-md pt-sm backdrop-blur">{actions}</div>}
    </section>
  );
}

/**
 * A practice mode opened before any line is current lands on the line at the start position. It only moves: the one
 * entry play is `usePracticePlayback`'s, once the player is ready (spec 2026-10-31 D5).
 */
export function useFirstPracticeSentence(): void {
  const { lines, video } = useLesson();
  const { index } = useCurrentSentence();
  const start = useStartPosition();
  const controller = usePlaybackController();
  useEffect(() => {
    if (index === null && lines.length) controller.seekToSentence(locateSentence(lines, start, video.durationSeconds).index ?? 0, { play: false });
  }, [controller, index, lines, start, video.durationSeconds]);
}

/** What a practice mode shows for a lesson with no transcript. */
export function PracticeEmptyTranscript() {
  const t = useTranslations("shadowing");
  const router = useRouter();
  return <section aria-label={t("workspace.regionLabel")}>
    <h2>{t("workspace.emptyTranscript.title")}</h2>
    <button type="button" onClick={() => router.refresh()}>{t("workspace.emptyTranscript.retry")}</button>
    <Link href="/shadowing">{t("workspace.emptyTranscript.backToHub")}</Link>
  </section>;
}
