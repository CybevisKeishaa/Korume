"use client";

import type { ReactElement } from "react";
import { Popover } from "@/components/ui/popover";
import { useTranslations } from "@/lib/i18n";
import { HINTS } from "../shortcut-hints-popover";

/** The keys Listening adds to the workspace's own (spec §3.2): Enter in the typing box, Alt+Arrow on a placed piece, Alt+H. */
const LISTENING_HINTS = [["Enter", "check"], ["Alt + ← / →", "movePiece"], ["Alt + H", "showAll"]] as const;

/**
 * Phím tắt (spec §3.2): the Listening shortcuts that exist, in a popover. Radix moves focus into it on open, and
 * Escape closes it and gives focus back to the button.
 */
export function ListeningShortcuts({ trigger }: { trigger: ReactElement }) {
  const t = useTranslations("shadowing.workspace.shortcuts");
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const rows = [...HINTS.map(([key, action]) => [key, t(action)]), ...LISTENING_HINTS.map(([key, action]) => [key, tl(`shortcuts.${action}`)])];
  return (
    <Popover trigger={trigger} side="bottom" align="end" label={tl("toolbar.shortcuts")}>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-md gap-y-2xs text-caption">
        {rows.map(([key, label]) => (
          <div key={key} className="contents">
            <dt><kbd className="rounded-sm border border-border bg-muted px-xs py-2xs font-mono">{key}</kbd></dt>
            <dd className="text-muted-foreground">{label}</dd>
          </div>
        ))}
      </dl>
    </Popover>
  );
}
