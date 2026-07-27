"use client";

import { useTranslations } from "@/lib/i18n";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/utils";

export type CompanionPose = "sitting" | "standing" | "reading";

/**
 * Placeholder sprite (spec D2 + spec 1 §7): a neutral creature-shaped SVG
 * leaning on MASCOT.md's visual direction — cream body, pale-teal ear-leaves,
 * amber memory orb — with NO name anywhere. It holds the anchor contract
 * (size + pose); Character Identity (Spec 2) later swaps the art with zero
 * logic change. Randomless markup: any idle variation is CSS-only.
 *
 * The whole creature is one <button>: it is the door to the journal, so it
 * must be reachable by Tab and activated by Enter/Space for free. The
 * focus-visible ring comes from the global `:focus-visible` rule in
 * globals.css, same as every other control.
 */
const POSE_CLASS: Record<CompanionPose, string> = {
  sitting: "translate-y-0.5",
  standing: "",
  reading: "-rotate-3",
};

export function CompanionSprite({ pose, onActivate }: { pose: CompanionPose; onActivate: () => void }) {
  const t = useTranslations("companion");
  const { reduceMotion } = useTheme();
  return (
    <button
      type="button"
      onClick={onActivate}
      aria-label={t("a11y.sprite")}
      className={cn(
        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
        POSE_CLASS[pose],
        // Belt and braces: globals.css also kill-switches the animation under
        // the OS/app reduce-motion setting, but the class is not applied at
        // all when the app toggle is on (CLAUDE.md §2.4).
        !reduceMotion && "companion-breathe",
      )}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className="h-12 w-12">
        {/* body: cream */}
        <ellipse cx="24" cy="30" rx="13" ry="11" fill="#F3ECD9" stroke="#D9CFB4" />
        {/* head: oversized (MASCOT.md), cream */}
        <circle cx="24" cy="16" r="10" fill="#F5EFE0" stroke="#D9CFB4" />
        {/* leaf/wing ears: pale teal */}
        <path d="M15 9 C 11 3, 19 2, 19 8 Z" fill="#BFE3DC" />
        <path d="M33 9 C 37 3, 29 2, 29 8 Z" fill="#BFE3DC" />
        {/* minimal expressive eyes */}
        <circle cx="20.5" cy="15.5" r="1.4" fill="#4A4A44" />
        <circle cx="27.5" cy="15.5" r="1.4" fill="#4A4A44" />
        {/* tail: light ribbon */}
        <path d="M36 33 C 44 30, 44 22, 39 20" fill="none" stroke="#BFE3DC" strokeWidth="2" strokeLinecap="round" />
        {/* memory orb: amber, always nearby */}
        <circle cx="40" cy="12" r="3" fill="#E8B84B" opacity="0.9" />
      </svg>
    </button>
  );
}
