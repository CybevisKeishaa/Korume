"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePlaybackController, usePreferences, useSession } from "./workspace-context";

const POPOVER_ID = "speed";
const rateLabel = (rate: number) => `${rate}×`;

/** Playback speed for this session; the list is what this video's player actually offers (T0). */
export function SpeedControl() {
  const t = useTranslations("shadowing");
  const controller = usePlaybackController();
  const { preferences } = usePreferences();
  const [session, dispatch] = useSession();
  const [rate, setRate] = useState<number>(preferences.playbackDefaultRate);
  const open = session.openPopover === POPOVER_ID;
  const rates = open ? controller.availableRates() : [];

  function choose(next: number) {
    controller.setRate(next);
    setRate(next);
    dispatch({ type: "set-popover", id: null });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => dispatch({ type: "set-popover", id: next ? POPOVER_ID : null })}
      side="top"
      label={t("workspace.player.speed")}
      trigger={(
        <button
          type="button"
          aria-label={t("workspace.player.speedValue", { rate: rateLabel(rate) })}
          className="rounded-md px-xs py-2xs text-caption font-medium text-muted-foreground hover:text-foreground"
        >
          {rateLabel(rate)}
        </button>
      )}
    >
      <div role="radiogroup" aria-label={t("workspace.player.speed")} className="flex flex-col gap-2xs">
        {rates.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={rate === option}
            onClick={() => choose(option)}
            className={cn(
              "rounded-md px-sm py-2xs text-left text-caption",
              rate === option ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {rateLabel(option)}
          </button>
        ))}
      </div>
    </Popover>
  );
}
