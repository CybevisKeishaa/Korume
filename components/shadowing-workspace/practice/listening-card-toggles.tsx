"use client";

import { CaseSensitive, Languages, Volume2, type LucideIcon } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n";
import { usePlaybackController } from "../workspace-context";
import { useListeningReveal } from "./listening-reveal-context";
import { TOOL } from "./listening-toolbar";

/**
 * The card toggles (spec §3.5): 🔊 plays the current sentence once; Bản dịch and Romaji show the line's translation
 * and romaji under the sentence, remembered for the page visit (reveal provider). In Chép chính tả both are answer
 * surfaces (D4): until Check or 💡 their buttons are `aria-disabled` (focusable, so the tooltip says why) and their
 * text is not in the DOM at all. Bản dịch is not rendered for a line without a translation.
 */
export function ListeningCardToggles({ index, translation, romaji, answerSurfacesAllowed }: {
  index: number;
  translation: string | null;
  romaji: string;
  /** Điền từ, or Chép chính tả once the answer is visible (D4). */
  answerSurfacesAllowed: boolean;
}) {
  const tl = useTranslations("shadowing.workspace.practice.listening.toggles");
  const controller = usePlaybackController();
  const { showTranslation, setShowTranslation, showRomaji, setShowRomaji } = useListeningReveal();
  // A press on a disabled toggle is cancelled, so Radix (which closes the tooltip on pointerdown and click) keeps the
  // reason on screen at the moment the learner asks for it.
  const toggle = (label: string, Icon: LucideIcon, on: boolean, set: (on: boolean) => void) =>
    <Tooltip content={answerSurfacesAllowed ? label : tl("afterCheck", { label })}>
      <button type="button" aria-label={label} aria-pressed={on} aria-disabled={!answerSurfacesAllowed || undefined}
        onPointerDown={(event) => { if (!answerSurfacesAllowed) event.preventDefault(); }}
        onClick={(event) => { if (answerSurfacesAllowed) set(!on); else event.preventDefault(); }} className={TOOL}><Icon aria-hidden className="size-icon-sm" /></button>
    </Tooltip>;

  return <div className="flex flex-col gap-xs">
    <div className="flex items-center gap-xs">
      <Tooltip content={tl("audio")}>
        <button type="button" aria-label={tl("audio")} onClick={() => controller.seekToSentence(index, { play: true })} className={TOOL}>
          <Volume2 aria-hidden className="size-icon-sm" />
        </button>
      </Tooltip>
      {translation !== null && toggle(tl("translation"), Languages, showTranslation, setShowTranslation)}
      {toggle(tl("romaji"), CaseSensitive, showRomaji, setShowRomaji)}
    </div>
    {answerSurfacesAllowed && showTranslation && translation !== null && <p data-testid="listening-translation" className="text-body text-muted-foreground">{translation}</p>}
    {answerSurfacesAllowed && showRomaji && romaji !== "" && <p data-testid="listening-romaji" lang="ja-Latn" className="text-body text-muted-foreground">{romaji}</p>}
  </div>;
}
