"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import type { LessonMiningCard } from "@/lib/data/mining";
import { cn } from "@/lib/utils";
import { useLesson, usePlaybackController } from "../workspace-context";
import { useDrawer } from "./drawer-context";

type Loaded = { status: "loading" } | { status: "ready"; cards: LessonMiningCard[] } | { status: "error" };

/** Mining (spec §6.4): the learner's cards from this lesson, by time; the target's cards highlighted; a card seeks. */
export function MiningTab() {
  const t = useTranslations("shadowing");
  const { target } = useDrawer();
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  // Read once when the learner opens the tab; a card mined meanwhile shows on the next open.
  useEffect(() => {
    let live = true;
    fetch(`/api/videos/${video.id}/mining-cards`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const cards = ((await response.json()) as { data: LessonMiningCard[] }).data;
        if (live) setLoaded({ status: "ready", cards });
      })
      .catch(() => { if (live) setLoaded({ status: "error" }); });
    return () => { live = false; };
  }, [video.id]);

  if (loaded.status === "loading") return <p role="status" className="text-body text-muted-foreground">{t("workspace.mining.loading")}</p>;
  if (loaded.status === "error") return <p className="text-body text-muted-foreground">{t("workspace.mining.failed")}</p>;
  if (loaded.cards.length === 0) return <p className="text-body text-muted-foreground">{t("workspace.mining.none")}</p>;

  const seek = (card: LessonMiningCard) => {
    const index = card.lineId ? lines.findIndex((line) => line.id === card.lineId) : -1;
    if (index >= 0) controller.seekToSentence(index);
    else if (card.startTime !== null) controller.seekTo(card.startTime);
  };
  return (
    <ul className="space-y-2xs">
      {loaded.cards.map((card) => {
        const ofTarget = target !== null && card.lineId === target.lineId;
        return (
          <li key={card.id}>
            <button
              type="button"
              aria-current={ofTarget ? "true" : undefined}
              onClick={() => seek(card)}
              className={cn("flex w-full flex-col items-start gap-2xs rounded-md border px-sm py-xs text-left hover:bg-muted", ofTarget ? "border-primary bg-muted/60" : "border-transparent")}
            >
              <span className="flex items-baseline gap-sm">
                <span lang="ja" className="font-jp text-body font-semibold text-foreground">{card.targetWord}</span>
                {card.reading && <span lang="ja" className="font-jp text-caption text-muted-foreground">{card.reading}</span>}
              </span>
              <span lang="ja" className="font-jp text-caption text-muted-foreground">{card.sentenceJp}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
