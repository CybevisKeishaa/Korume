"use client";

import { useTranslations } from "@/lib/i18n";
import { Popover } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  PLAYBACK_LOOP_COUNT_OPTIONS, PLAYBACK_RATE_OPTIONS, READING_COLOR_PRESET_OPTIONS, READING_EMPHASIS_OPTIONS,
  READING_FURIGANA_OPTIONS, READING_JP_FONT_OPTIONS, READING_LINE_HEIGHT_OPTIONS, READING_TEXT_SIZE_OPTIONS,
  READING_TRANSLATION_OPTIONS, READING_WIDTH_OPTIONS, RESUME_BEHAVIOR_OPTIONS, type PlaybackLoopCount, type PlaybackRate,
} from "@/lib/preferences/options";
import { HEADER_ICON_BUTTON } from "./lesson-bookmark-button";
import { SlidersGlyph } from "./player-glyphs";
import { usePreferences, useSession, type PreferenceKey } from "./workspace-context";

export const READING_SETTINGS_POPOVER = "reading-settings";

const loopLabel = (count: PlaybackLoopCount) => (count === 0 ? "∞" : `${count}×`);

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2xs">
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/** A short option list as a segmented row; `optionLabel` keeps each message key typed. */
function SegmentedRow<V extends string>({ label, value, options, optionLabel, onChange }: {
  label: string; value: V; options: readonly V[]; optionLabel(value: V): string; onChange(value: V): void;
}) {
  return (
    <Row label={label}>
      <SegmentedControl aria-label={label} value={value} onValueChange={onChange} options={options.map((option) => ({ value: option, label: optionLabel(option) }))} />
    </Row>
  );
}

/**
 * ⚙ Reading Settings (spec §6.1): a non-modal popover, one control per persisted setting; every change is
 * written at once through `setPreference` (no Save). The only place a persisted reading mode changes (§7.8).
 */
export function ReadingSettingsPopover() {
  const t = useTranslations("shadowing");
  const { preferences, setPreference } = usePreferences();
  const [session, dispatch] = useSession();
  const open = session.openPopover === READING_SETTINGS_POPOVER;
  const set = <K extends PreferenceKey>(key: K) => (value: (typeof preferences)[K]) => setPreference(key, value);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => dispatch({ type: "set-popover", id: next ? READING_SETTINGS_POPOVER : null })}
      side="bottom"
      align="end"
      label={t("workspace.settings.open")}
      className="max-h-[--radix-popover-content-available-height] w-80 space-y-sm overflow-y-auto"
      trigger={(
        <button type="button" aria-label={t("workspace.settings.open")} title={t("workspace.settings.open")} aria-expanded={open} className={HEADER_ICON_BUTTON}>
          <SlidersGlyph className="size-icon-sm" />
        </button>
      )}
    >
      <SegmentedRow label={t("workspace.settings.furigana")} value={preferences.readingFurigana} options={READING_FURIGANA_OPTIONS} optionLabel={(v) => t(`workspace.settings.furiganaOptions.${v}`)} onChange={set("readingFurigana")} />
      <SegmentedRow label={t("workspace.settings.translation")} value={preferences.readingTranslation} options={READING_TRANSLATION_OPTIONS} optionLabel={(v) => t(`workspace.settings.translationOptions.${v}`)} onChange={set("readingTranslation")} />
      <SegmentedRow label={t("workspace.settings.jpFont")} value={preferences.readingJpFont} options={READING_JP_FONT_OPTIONS} optionLabel={(v) => t(`workspace.settings.jpFontOptions.${v}`)} onChange={set("readingJpFont")} />
      <SegmentedRow label={t("workspace.settings.textSize")} value={preferences.readingTextSize} options={READING_TEXT_SIZE_OPTIONS} optionLabel={(v) => t(`workspace.settings.textSizeOptions.${v}`)} onChange={set("readingTextSize")} />
      <SegmentedRow label={t("workspace.settings.lineHeight")} value={preferences.readingLineHeight} options={READING_LINE_HEIGHT_OPTIONS} optionLabel={(v) => t(`workspace.settings.lineHeightOptions.${v}`)} onChange={set("readingLineHeight")} />
      <SegmentedRow label={t("workspace.settings.width")} value={preferences.readingWidth} options={READING_WIDTH_OPTIONS} optionLabel={(v) => t(`workspace.settings.widthOptions.${v}`)} onChange={set("readingWidth")} />
      <SegmentedRow label={t("workspace.settings.emphasis")} value={preferences.readingEmphasis} options={READING_EMPHASIS_OPTIONS} optionLabel={(v) => t(`workspace.settings.emphasisOptions.${v}`)} onChange={set("readingEmphasis")} />
      <Row label={t("workspace.settings.colorPreset")}>
        <Select
          aria-label={t("workspace.settings.colorPreset")}
          value={preferences.readingColorPreset}
          onValueChange={(value) => set("readingColorPreset")(value as (typeof READING_COLOR_PRESET_OPTIONS)[number])}
          options={READING_COLOR_PRESET_OPTIONS.map((value) => ({ value, label: t(`workspace.settings.colorPresetOptions.${value}`) }))}
        />
      </Row>
      <Row label={t("workspace.settings.speed")}>
        <Select
          aria-label={t("workspace.settings.speed")}
          value={String(preferences.playbackDefaultRate)}
          onValueChange={(value) => set("playbackDefaultRate")(Number(value) as PlaybackRate)}
          options={PLAYBACK_RATE_OPTIONS.map((rate) => ({ value: String(rate), label: `${rate}×` }))}
        />
      </Row>
      <Row label={t("workspace.settings.loopCount")}>
        <SegmentedControl
          aria-label={t("workspace.settings.loopCount")}
          value={String(preferences.playbackLoopCount)}
          onValueChange={(value) => set("playbackLoopCount")(Number(value) as PlaybackLoopCount)}
          options={PLAYBACK_LOOP_COUNT_OPTIONS.map((count) => ({ value: String(count), label: loopLabel(count) }))}
        />
      </Row>
      <label className="flex items-center justify-between gap-sm text-caption font-medium text-muted-foreground">
        {t("workspace.settings.autoPause")}
        <Switch checked={preferences.playbackAutoPause} onCheckedChange={set("playbackAutoPause")} aria-label={t("workspace.settings.autoPause")} />
      </label>
      <label className="flex items-center justify-between gap-sm text-caption font-medium text-muted-foreground">
        {t("workspace.settings.shortcutHints")}
        <Switch checked={preferences.showShortcutHints} onCheckedChange={set("showShortcutHints")} aria-label={t("workspace.settings.shortcutHints")} />
      </label>
      <SegmentedRow label={t("workspace.settings.resume")} value={preferences.resumeBehavior} options={RESUME_BEHAVIOR_OPTIONS} optionLabel={(v) => t(`workspace.settings.resumeOptions.${v}`)} onChange={set("resumeBehavior")} />
    </Popover>
  );
}
