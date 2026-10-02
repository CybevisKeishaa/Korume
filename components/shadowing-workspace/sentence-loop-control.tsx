"use client";

import { useTranslations } from "@/lib/i18n";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PLAYBACK_LOOP_COUNT_OPTIONS, type PlaybackLoopCount } from "@/lib/preferences/options";
import { useSession } from "./workspace-context";
import { usePlayerWiring } from "./playback-root";

export const POPOVER_ID = "sentence-loop";
const countLabel = (count: PlaybackLoopCount) => (count === 0 ? "∞" : `${count}×`);

/**
 * "Sentence" pill: loops the current sentence. Pressed = loop on; its popover picks the plays per cycle
 * (1/3/5/∞) for this session — the persisted default lives in Reading Settings (Task 10).
 */
export function SentenceLoopControl() {
  const t = useTranslations("shadowing");
  const { loop, setLoop } = usePlayerWiring();
  const [session, dispatch] = useSession();
  const open = session.openPopover === POPOVER_ID;

  function choose(count: PlaybackLoopCount) {
    // Choosing a count is choosing to loop; 1× is "play once", i.e. loop off.
    const next = { count, enabled: count !== 1 };
    setLoop(next);
    dispatch({ type: "set-popover", id: null });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => dispatch({ type: "set-popover", id: next ? POPOVER_ID : null })}
      side="top"
      label={t("workspace.player.loopCount")}
      trigger={(
        <button
          type="button"
          aria-pressed={loop.enabled}
          aria-label={t("workspace.player.loopToggle")}
          className={cn(
            "rounded-full px-sm py-2xs text-caption font-medium transition-colors",
            loop.enabled ? "bg-primary/15 text-primary-strong" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("workspace.player.loop")}
        </button>
      )}
    >
      <div role="radiogroup" aria-label={t("workspace.player.loopCount")} className="flex gap-xs">
        {PLAYBACK_LOOP_COUNT_OPTIONS.map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={loop.count === count}
            onClick={() => choose(count)}
            className={cn(
              "rounded-md px-sm py-2xs text-caption",
              loop.count === count ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {countLabel(count)}
          </button>
        ))}
      </div>
    </Popover>
  );
}
