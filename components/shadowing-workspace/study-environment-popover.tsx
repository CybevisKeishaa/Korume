"use client";

import { useTranslations } from "@/lib/i18n";
import { Popover } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
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
        <button type="button" className="h-control-sm rounded-md px-sm text-caption font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          {t("workspace.environment.open")}
        </button>
      )}
    >
      {/* The radiogroup pattern (one tab stop, arrows move and select), laid out as a vertical list of places. */}
      <SegmentedControl
        aria-label={t("workspace.environment.open")}
        value={preferences.studyAtmosphere}
        onValueChange={(atmosphere) => setPreference("studyAtmosphere", atmosphere)}
        options={STUDY_ATMOSPHERE_OPTIONS.map((atmosphere) => ({ value: atmosphere, label: t(`workspace.environment.options.${atmosphere}`) }))}
        className="flex w-full flex-col items-stretch rounded-md [&>button]:rounded-md [&>button]:text-left"
      />
    </Popover>
  );
}
