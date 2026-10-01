"use client";

import { useTranslations } from "@/lib/i18n";
import { Popover } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { STUDY_ATMOSPHERE_OPTIONS } from "@/lib/preferences/options";
import { usePreferences, useSession } from "./workspace-context";

export const STUDY_ENVIRONMENT_POPOVER = "study-environment";

/**
 * Study Environment (spec §6.2): None + the six documented places, persisted as `study_atmosphere`. The
 * learner chooses a place to study, not a theme — so it is a radio list of names, not swatches.
 */
export function StudyEnvironmentPopover() {
  const t = useTranslations("shadowing");
  const { preferences, setPreference } = usePreferences();
  const [session, dispatch] = useSession();
  const open = session.openPopover === STUDY_ENVIRONMENT_POPOVER;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => dispatch({ type: "set-popover", id: next ? STUDY_ENVIRONMENT_POPOVER : null })}
      side="bottom"
      align="end"
      label={t("workspace.environment.open")}
      trigger={(
        <button type="button" aria-expanded={open} className="h-control-sm rounded-md px-sm text-caption font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {t("workspace.environment.open")}
        </button>
      )}
    >
      <div role="radiogroup" aria-label={t("workspace.environment.open")} className="flex flex-col gap-2xs">
        {STUDY_ATMOSPHERE_OPTIONS.map((atmosphere) => (
          <button
            key={atmosphere}
            type="button"
            role="radio"
            aria-checked={preferences.studyAtmosphere === atmosphere}
            onClick={() => setPreference("studyAtmosphere", atmosphere)}
            className={cn(
              "rounded-md px-sm py-2xs text-left text-caption",
              preferences.studyAtmosphere === atmosphere ? "bg-primary/15 text-primary-strong" : "hover:bg-muted",
            )}
          >
            {t(`workspace.environment.options.${atmosphere}`)}
          </button>
        ))}
      </div>
    </Popover>
  );
}
