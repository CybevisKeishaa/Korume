"use client";

import { useState } from "react";
import { HEADER_ICON_BUTTON } from "@/components/shadowing-workspace/lesson-header-frame";
import { BookmarkGlyph } from "@/components/shadowing-workspace/player-glyphs";
import { useTranslations } from "@/lib/i18n";
import { normalizeRef } from "@/lib/summary/refs";
import type { SavedCard } from "@/lib/summary/snapshot";

/**
 * Spec §6.3: saves a word or expression as a sentence card from its source line, and removes it again. Initial
 * state matches `kind|lineId|normalizeRef(word)`, so a width variant of a saved word shows as saved.
 */
export function SaveToggle({ sourceKind, lineId, targetWord, savedCards }: {
  sourceKind: "vocabulary" | "expression";
  lineId: string;
  targetWord: string;
  savedCards: SavedCard[];
}) {
  const t = useTranslations("shadowing.lessonSummary");
  const ref = normalizeRef(targetWord);
  const [cardId, setCardId] = useState<string | null>(
    () => savedCards.find((card) => card.kind === sourceKind && card.lineId === lineId && normalizeRef(card.ref) === ref)?.cardId ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      if (cardId) {
        const response = await fetch(`/api/mining/${cardId}`, { method: "DELETE" });
        if (!response.ok) throw new Error(String(response.status));
        setCardId(null);
      } else {
        const response = await fetch("/api/mining", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lineId, targetWord, sourceKind }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const created = (await response.json()) as { data: { id: string } };
        setCardId(created.data.id);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const saved = cardId !== null;
  const label = sourceKind === "vocabulary"
    ? t(saved ? "words.unsave" : "words.save", { word: targetWord })
    : t(saved ? "expressions.unsave" : "expressions.save", { expression: targetWord });
  return (
    <div className="flex shrink-0 flex-col items-end gap-2xs">
      <button
        type="button"
        aria-label={label}
        aria-pressed={saved}
        aria-busy={busy || undefined}
        onClick={() => void toggle()}
        className={HEADER_ICON_BUTTON}
      >
        <BookmarkGlyph className="size-4" filled={saved} />
      </button>
      {failed && <p role="alert" className="text-caption text-danger-strong">{t("saveFailed")}</p>}
    </div>
  );
}
