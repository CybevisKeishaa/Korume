"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { usePracticeStats } from "./practice-stats-context";

const CONTROL = "relative flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-full text-caption font-bold tabular-nums aria-disabled:opacity-50";
const REVIEW_TONE = "bg-muted text-accent-strong ring-1 ring-accent";
const TONES = {
  none: "bg-muted text-muted-foreground",
  scored: "bg-muted text-success-strong ring-1 ring-success",
  needs_review: REVIEW_TONE,
  unscored: "bg-muted text-muted-foreground ring-1 ring-border",
  // P4: a shown answer reads as review.
  revealed: REVIEW_TONE,
  // Spec §3.8: correct with help reads as success, drawn dashed so it never passes for self-done.
  helped: "bg-muted text-success-strong outline-dashed outline-1 -outline-offset-1 outline-success",
};

/**
 * The sentence chip rail (spec §3.8): every sentence as a chip in one horizontal scroller; the current chip is
 * scrolled to the centre whenever the shared sentence moves; ‹ › page by the rail's visible width; a vertical wheel
 * scrolls it sideways while it overflows; its thin scrollbar shows only on hover or keyboard focus (`.sentence-rail`).
 * A sentence with an unsent Listening draft carries a dot and "in progress" in its name (§3.9).
 */
export function SentenceNavigator({ disabled = false, disabledHint, draftLineIds }: {
  disabled?: boolean;
  disabledHint?: string;
  draftLineIds?: ReadonlySet<string>;
}) {
  const t = useTranslations("shadowing.workspace.practice");
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const controller = usePlaybackController();
  const { stats } = usePracticeStats();
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 0, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    if (index === null) return;
    rail.current?.querySelector<HTMLElement>(`[data-sentence-index='${index}']`)?.scrollIntoView?.({ inline: "center", block: "nearest" });
    measure();
  }, [index, lines.length, measure]);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;
    // Native and non-passive: React's wheel listener is passive, so it could not keep the page from scrolling.
    const onWheel = (event: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("wheel", onWheel); window.removeEventListener("resize", measure); };
  }, [measure]);

  const earlierDisabled = disabled || edges.start;
  const laterDisabled = disabled || edges.end;
  const hint = disabled ? disabledHint : undefined;
  const page = (direction: -1 | 1) => {
    const el = rail.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  return (
    <nav aria-label={t("navigator.label")} className="flex items-center gap-sm">
      <span className="shrink-0 text-caption font-bold uppercase tracking-wide text-primary-strong">{t("navigator.label")}</span>
      <div className="flex min-w-0 flex-1 items-center gap-2xs">
        <button type="button" aria-label={t("navigator.earlier")} aria-disabled={earlierDisabled} title={hint}
          className={cn(CONTROL, "text-muted-foreground")}
          onClick={() => { if (!earlierDisabled) page(-1); }}>
          <ChevronLeft aria-hidden="true" className="size-icon-sm" />
        </button>
        <div ref={rail} data-testid="sentence-rail" onScroll={measure} className="sentence-rail -mb-2xs min-w-0 flex-1 overflow-x-auto">
          {/* p-2xs: room for a chip's focus ring (ring-2 + offset-2), which the scroller would clip. */}
          <ol className="flex w-max gap-2xs p-2xs">
            {lines.map((line, sentenceIndex) => {
              const entry = stats?.lines[line.id];
              const state = entry?.state ?? "none";
              const stateLabel = state === "scored"
                ? t("navigator.state.scored", { score: entry?.score ?? 0 })
                : t(`navigator.state.${state}`);
              const draft = draftLineIds?.has(line.id) ?? false;
              const label = t("navigator.chip", { number: sentenceIndex + 1, state: stateLabel });
              return (
                <li key={line.id}>
                  <button type="button" aria-current={sentenceIndex === index ? "true" : undefined} aria-disabled={disabled}
                    title={hint} aria-label={draft ? `${label}, ${t("navigator.draft")}` : label}
                    onClick={() => { if (!disabled) controller.seekToSentence(sentenceIndex); }} data-state={state} data-sentence-index={sentenceIndex}
                    className={cn(CONTROL, sentenceIndex === index ? "bg-primary text-primary-foreground" : TONES[state])}>
                    {sentenceIndex + 1}
                    {draft && <span data-draft-dot aria-hidden="true" className="absolute right-0 top-0 size-2xs rounded-full bg-accent-strong" />}
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <button type="button" aria-label={t("navigator.later")} aria-disabled={laterDisabled} title={hint}
          className={cn(CONTROL, "text-muted-foreground")}
          onClick={() => { if (!laterDisabled) page(1); }}>
          <ChevronRight aria-hidden="true" className="size-icon-sm" />
        </button>
      </div>
    </nav>
  );
}
