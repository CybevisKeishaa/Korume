"use client";

import { useTranslations } from "@/lib/i18n";
import { useThemeOrNull } from "@/components/providers/theme-provider";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MASCOT_POSES, type MascotPoseName } from "@/components/mascot/mascot-poses";

export type CompanionPose = "sitting" | "standing" | "reading";

/**
 * The Companion's art (spec 1 §7): each CompanionPose is a real pose from MASCOT_POSES, the one home of pose
 * files. It still holds the anchor contract — callers pick a pose and a size, never a file.
 *
 * The whole creature is one <button>: it is the door to the journal, so it
 * must be reachable by Tab and activated by Enter/Space for free. The
 * focus-visible ring comes from the global `:focus-visible` rule in
 * globals.css, same as every other control.
 */
const POSE_ART: Record<CompanionPose, MascotPoseName> = {
  sitting: "companion-sitting",
  standing: "companion-standing",
  reading: "companion-reading",
};
/** `sm` is the inline anchor (48px); `lg` is a panel that hosts the Companion, like the Dashboard's Korume card. */
const SIZE_CLASS = { sm: "h-12", lg: "h-28" } as const;

/** `label` names what activating it does where the sprite is not the journal door (Ask Korume's mascot). */
export function CompanionSprite({ pose, onActivate, label, size = "sm" }: { pose: CompanionPose; onActivate: () => void; label?: string; size?: keyof typeof SIZE_CLASS }) {
  const t = useTranslations("companion");
  // No provider (outside the app shell) → hold still: the reduce-motion-safe default.
  const reduceMotion = useThemeOrNull()?.reduceMotion ?? true;
  const art = MASCOT_POSES[POSE_ART[pose]];
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={label ?? t("a11y.sprite")}
      data-companion-pose={pose}
      className={cn(
        "inline-flex shrink-0 items-end justify-center rounded-lg",
        SIZE_CLASS[size],
        // Belt and braces: globals.css also kill-switches the animation under
        // the OS/app reduce-motion setting, but the class is not applied at
        // all when the app toggle is on (CLAUDE.md §2.4).
        !reduceMotion && "companion-breathe",
      )}
    >
      <Image src={`/mascot/poses/${art.file}`} alt="" aria-hidden="true" width={art.width} height={art.height} unoptimized
        className="h-full w-auto select-none" draggable={false} />
    </button>
  );
}
