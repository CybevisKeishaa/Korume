"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { usePreferences } from "@/components/providers/preferences-provider";
import { REDUCE_MOTION_QUERY } from "@/lib/motion/motion-enabled";
import { DISPLAY_SCALE_OPTIONS, type DisplayScale } from "@/lib/preferences/options";
import { SettingsSection } from "./settings-section";
import { SettingsRow } from "./settings-row";
import { usePreferenceSave } from "./use-preference-save";

/**
 * Display Scale and Reduced Motion (spec §4.5). Theme and Accent Color are
 * deferred (§1.3), so this band has two rows, not four.
 */
export function AppearanceSection() {
  const t = useTranslations("settings");
  const { preferences } = usePreferences();
  const scale = usePreferenceSave("displayScale");
  const motion = usePreferenceSave("reduceMotion");
  const motionId = useId();
  const noteId = useId();
  const [osReduces, setOsReduces] = useState(false);

  /**
   * Read in an effect, never during render: `matchMedia` does not exist on the
   * server, and a value read during render would be baked into the HTML for
   * whichever machine prerendered it. Subscribed rather than sampled once,
   * because a user can change the OS setting with this page open — and the
   * note below would then be telling them the opposite of the truth.
   */
  useEffect(() => {
    const query = window.matchMedia(REDUCE_MOTION_QUERY);
    const sync = () => setOsReduces(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Spec §4.5: Korume may ADD reduction, never remove the OS's. When the OS
  // asks for it, the account switch being off changes nothing — so the note
  // says so plainly instead of leaving a switch that appears to do nothing.
  const showOsNote = osReduces && !preferences.reduceMotion;

  return (
    <SettingsSection title={t("page.appearance.title")} subtitle={t("page.appearance.subtitle")}>
      <SettingsRow
        icon="scale"
        label={t("page.displayScale.label")}
        description={t("page.displayScale.description")}
        control={
          <SegmentedControl<DisplayScale>
            value={preferences.displayScale}
            onValueChange={(value) => void scale.save({ displayScale: value }, { displayScale: value })}
            options={DISPLAY_SCALE_OPTIONS.map((value) => ({
              value,
              label: t(`page.displayScale.${value}`),
            }))}
            aria-label={t("page.displayScale.label")}
          />
        }
      />

      <SettingsRow
        icon="motion"
        label={t("page.reducedMotion.label")}
        description={t("page.reducedMotion.description")}
        htmlFor={motionId}
        control={
          <Switch
            id={motionId}
            checked={preferences.reduceMotion}
            onCheckedChange={(checked) =>
              void motion.save({ reduceMotion: checked }, { reduceMotion: checked })
            }
            aria-describedby={showOsNote ? noteId : undefined}
          />
        }
      >
        {showOsNote ? (
          <p id={noteId} className="mt-xs ps-lg text-caption text-muted-foreground">
            {t("page.reducedMotion.osOverrides")}
          </p>
        ) : null}
      </SettingsRow>
    </SettingsSection>
  );
}
