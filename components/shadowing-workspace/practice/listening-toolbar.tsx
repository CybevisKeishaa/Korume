"use client";

import { Puzzle } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n";
import { HideTextGlyph, KeyboardGlyph } from "../player-glyphs";
import { useListeningReveal } from "./listening-reveal-context";
import { ListeningShortcuts } from "./listening-shortcuts";

const TOOL = "inline-flex h-control-sm items-center gap-xs rounded-full border border-border px-sm text-caption font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary-strong aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * The exercise toolbar (spec §3.2): Ẩn video and Chế độ dễ are switches remembered for the page visit (reveal
 * provider), Phím tắt opens the shortcut list. On a line the chunker cannot cut reliably (D9) Chế độ dễ is
 * unavailable: `aria-disabled`, not `disabled`, so it still takes focus and hover and its tooltip can say why.
 */
export function ListeningToolbar({ easyDisabled }: { easyDisabled: boolean }) {
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const { listenOnly, setListenOnly, easy, setEasy } = useListeningReveal();
  const easyButton = (
    <button type="button" aria-pressed={easy} aria-disabled={easyDisabled || undefined} onClick={() => { if (!easyDisabled) setEasy(!easy); }} className={TOOL}>
      <Puzzle aria-hidden className="size-icon-sm" />{tl("toolbar.easy")}
    </button>
  );
  return (
    <div role="group" aria-label={tl("toolbar.label")} className="flex flex-wrap items-center gap-xs">
      <button type="button" aria-pressed={listenOnly} onClick={() => setListenOnly(!listenOnly)} className={TOOL}>
        <HideTextGlyph className="size-icon-sm" />{tl("toolbar.hideVideo")}
      </button>
      <ListeningShortcuts trigger={<button type="button" className={TOOL}><KeyboardGlyph className="size-icon-sm" />{tl("toolbar.shortcuts")}</button>} />
      {easyDisabled ? <Tooltip content={tl("unreliable")} side="bottom">{easyButton}</Tooltip> : easyButton}
    </div>
  );
}
