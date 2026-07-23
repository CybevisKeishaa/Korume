"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { PeerReviewQueue } from "./peer-review-queue";
import { PeerReviewMine } from "./peer-review-mine";
import type { MyShareWithReviews } from "@/lib/peer-review-types";
import type { PeerReviewQueuePage } from "@/lib/peer-review-types";

export interface PeerReviewTabsProps {
  initialQueue: PeerReviewQueuePage;
  initialMine: MyShareWithReviews[];
}

type Tab = "queue" | "mine";

/** "Queue" (others' shares to review) vs. "Mine" (my shares + reviews received) sub-tabs. */
export function PeerReviewTabs({ initialQueue, initialMine }: PeerReviewTabsProps) {
  const t = useTranslations("community");
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div>
      <div role="tablist" aria-label={t("peerReviewTabs.tablistAriaLabel")} className="flex gap-2">
        <button
          type="button"
          role="tab"
          id="peer-review-tab-queue"
          aria-selected={tab === "queue"}
          aria-controls="peer-review-panel-queue"
          onClick={() => setTab("queue")}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            tab === "queue" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {t("peerReviewTabs.queue")}
        </button>
        <button
          type="button"
          role="tab"
          id="peer-review-tab-mine"
          aria-selected={tab === "mine"}
          aria-controls="peer-review-panel-mine"
          onClick={() => setTab("mine")}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            tab === "mine" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {t("peerReviewTabs.mine")}
        </button>
      </div>

      <div
        role="tabpanel"
        id="peer-review-panel-queue"
        aria-labelledby="peer-review-tab-queue"
        hidden={tab !== "queue"}
        className="mt-4"
      >
        <PeerReviewQueue initialPage={initialQueue} />
      </div>
      <div
        role="tabpanel"
        id="peer-review-panel-mine"
        aria-labelledby="peer-review-tab-mine"
        hidden={tab !== "mine"}
        className="mt-4"
      >
        <PeerReviewMine shares={initialMine} />
      </div>
    </div>
  );
}
