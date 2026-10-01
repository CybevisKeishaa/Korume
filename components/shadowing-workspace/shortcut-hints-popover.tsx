"use client";

import { useTranslations } from "@/lib/i18n";
import { Popover } from "@/components/ui/popover";
import { HEADER_ICON_BUTTON } from "./lesson-bookmark-button";
import { KeyboardGlyph } from "./player-glyphs";
import { SHORTCUT_HINTS_POPOVER, useSession } from "./workspace-context";

/** The keys `shortcutFor` (lib/shadowing-workspace/shortcuts.ts) maps, in the order a learner meets them. */
const HINTS = [
  ["Space", "togglePlay"], ["←", "previous"], ["→", "next"], ["Shift + ←", "rewind"], ["L", "loop"], ["F", "focus"],
] as const;

/**
 * The shortcut hint sheet (spec §6.1). Its open state is session-only; it starts open only when the
 * `show_shortcut_hints` preference is on (the session reducer's initial state). It holds no control, so
 * opening it never moves focus: Space still plays straight after the page loads.
 */
export function ShortcutHintsPopover() {
  const t = useTranslations("shadowing");
  const [session, dispatch] = useSession();
  const open = session.openPopover === SHORTCUT_HINTS_POPOVER;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => dispatch({ type: "set-popover", id: next ? SHORTCUT_HINTS_POPOVER : null })}
      onOpenAutoFocus={(event) => event.preventDefault()}
      side="bottom"
      align="end"
      label={t("workspace.shortcuts.open")}
      trigger={(
        <button type="button" aria-label={t("workspace.shortcuts.open")} title={t("workspace.shortcuts.open")} aria-expanded={open} className={HEADER_ICON_BUTTON}>
          <KeyboardGlyph className="size-icon-sm" />
        </button>
      )}
    >
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-md gap-y-2xs text-caption">
        {HINTS.map(([key, action]) => (
          <div key={action} className="contents">
            <dt><kbd className="rounded-sm border border-border bg-muted px-xs py-2xs font-mono">{key}</kbd></dt>
            <dd className="text-muted-foreground">{t(`workspace.shortcuts.${action}`)}</dd>
          </div>
        ))}
      </dl>
    </Popover>
  );
}
