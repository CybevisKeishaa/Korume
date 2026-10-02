"use client";

import { useTranslations } from "@/lib/i18n";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { completedModes, shouldRenderModeNav, type LearningMode } from "@/lib/shadowing-workspace/learning-modes";
import { cn } from "@/lib/utils";

export function modeHref(videoId: string, mode: LearningMode): string {
  return mode.segment === "" ? `/shadowing/${videoId}` : `/shadowing/${videoId}/${mode.segment}`;
}

/**
 * The learning-mode bar (spec §7.2, Q1). Renders nothing until two modes are complete: no disabled tab and no
 * "coming soon". `modes` exists so a test can inject a registry; the app always uses `LEARNING_MODES`.
 */
export function ModeNav({ videoId, modes }: { videoId: string; modes?: readonly LearningMode[] }) {
  // Checked before any hook: with one mode the bar costs nothing, not even a pathname subscription.
  return shouldRenderModeNav(modes) ? <ModeNavBar videoId={videoId} modes={completedModes(modes)} /> : null;
}

function ModeNavBar({ videoId, modes }: { videoId: string; modes: readonly LearningMode[] }) {
  const t = useTranslations("shadowing");
  const pathname = usePathname();
  return (
    <nav aria-label={t("workspace.header.modeNav")}>
      <ul className="flex items-center gap-2xs">
        {modes.map((mode) => {
          const href = modeHref(videoId, mode);
          const active = pathname === href;
          return (
            <li key={mode.id}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-sm py-2xs text-caption font-medium",
                  active ? "bg-primary/10 text-primary-strong" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(`workspace.header.modes.${mode.id}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
