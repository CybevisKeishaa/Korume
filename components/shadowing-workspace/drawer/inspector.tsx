"use client";

import { useEffect, useRef } from "react";
import type { AnalysisToken } from "@/lib/analysis/types";
import type { KanjiCommonWord } from "@/lib/dictionary/types";
import { KanjiQuickInspect } from "@/components/kanji/kanji-quick-inspect";
import { useTranslations } from "@/lib/i18n";
import { BackGlyph } from "../player-glyphs";
import { useDrawer } from "./drawer-context";
import { WordCard } from "./word-card";

export const INSPECTOR_HEADING_ID = "workspace-drawer-inspector-title";

const BACK = "inline-flex h-control-sm items-center gap-2xs rounded-md px-xs text-caption text-muted-foreground hover:bg-muted hover:text-foreground";

function commonWordToken(word: KanjiCommonWord): AnalysisToken {
  return {
    index: -1, surface: word.headword, base: word.headword, reading: null, pos: "", span: { start: 0, end: 0 },
    entries: [{ entSeq: word.entSeq, headword: word.headword, reading: word.reading, glossEn: word.glossEn, jlpt: null }], vocabId: null,
  };
}

export function Inspector() {
  const t = useTranslations("shadowing");
  const { state, dispatch } = useDrawer();
  const heading = useRef<HTMLHeadingElement>(null);
  const depth = state.inspector?.stack.length ?? 0;
  // Every push and pop replaces the body (and the button just pressed): focus moves to the new entry's title.
  useEffect(() => { if (depth > 0) heading.current?.focus(); }, [depth]);
  const entry = state.inspector?.stack.at(-1);
  if (!entry) return null;
  const title = entry.kind === "kanji" ? entry.literal : entry.word.headword;
  return (
    <section aria-label={t("workspace.inspector.label", { title })} className="space-y-xs">
      <div className="flex items-center gap-xs">
        <button type="button" onClick={() => dispatch({ type: "inspector-back" })} className={BACK}><BackGlyph className="size-icon-xs" />{t("workspace.inspector.back")}</button>
        <h3 ref={heading} id={INSPECTOR_HEADING_ID} tabIndex={-1} lang="ja" className="min-w-0 flex-1 truncate font-jp text-body font-semibold text-foreground outline-none">{title}</h3>
        <button type="button" onClick={() => dispatch({ type: "inspector-close" })} className={BACK}>{t("workspace.inspector.close")}</button>
      </div>
      {entry.kind === "kanji"
        ? <KanjiQuickInspect key={entry.literal} literal={entry.literal} onOpenWord={(word) => dispatch({ type: "inspect", entry: { kind: "word", word } })} />
        : <WordCard key={entry.word.entSeq} token={commonWordToken(entry.word)} onOpenKanji={(literal) => dispatch({ type: "inspect", entry: { kind: "kanji", literal } })} />}
    </section>
  );
}
