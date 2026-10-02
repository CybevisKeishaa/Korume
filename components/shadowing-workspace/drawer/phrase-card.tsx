"use client";

import { useTranslations } from "@/lib/i18n";
import { SparklesGlyph } from "../player-glyphs";

/** Several tokens (spec §6.3): the selected text and ✨ Analyze, which opens AI on this phrase. */
export function PhraseCard({ text, onAnalyze }: { text: string; onAnalyze(): void }) {
  const t = useTranslations("shadowing");
  return (
    <div className="space-y-xs">
      <p lang="ja" className="font-jp text-heading font-semibold text-foreground">{text}</p>
      <button
        type="button"
        onClick={onAnalyze}
        className="inline-flex h-control-sm items-center gap-2xs rounded-md bg-primary px-sm text-caption font-medium text-primary-foreground hover:bg-primary/90"
      >
        <SparklesGlyph className="size-icon-sm" />
        {t("workspace.selection.analyze")}
      </button>
    </div>
  );
}
