"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { AnalysisToken, GlossDto } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

type GlossState = { status: "loading" } | { status: "done"; gloss: GlossDto } | { status: "unavailable" };

// One generation request per entry for the tab's lifetime, however often its card opens (spec §6.3).
const generationRequests = new Map<number, Promise<GlossDto | null>>();

export function resetGlossRequestsForTests(): void {
  generationRequests.clear();
}

async function readGloss(entSeq: number): Promise<GlossDto | null> {
  const response = await fetch(`/api/dictionary/gloss?entryId=${entSeq}`);
  return response.ok ? ((await response.json()) as { data: GlossDto }).data : null;
}

function requestGloss(entSeq: number): Promise<GlossDto | null> {
  let pending = generationRequests.get(entSeq);
  if (!pending) {
    pending = fetch("/api/dictionary/gloss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryId: entSeq }),
    }).then(async (response) => (response.ok ? ((await response.json()) as { data: GlossDto }).data : null), () => null);
    generationRequests.set(entSeq, pending);
  }
  return pending;
}

/**
 * The Vietnamese gloss of one entry: read first; only when nothing exists is a system-funded generation
 * requested — from this card being open, an explicit learner action, never from playback.
 */
export function useVietnameseGloss(entSeq: number | null, { request = true }: { request?: boolean } = {}): GlossState | null {
  const locale = useLocale();
  const enabled = entSeq !== null && locale === "vi";
  const [state, setState] = useState<{ entSeq: number; value: GlossState } | null>(null);
  useEffect(() => {
    if (!enabled || entSeq === null) return;
    let live = true;
    const settle = (value: GlossState) => { if (live) setState({ entSeq, value }); };
    readGloss(entSeq)
      .then((gloss) => (request && gloss && gloss.status === "missing" ? requestGloss(entSeq) : gloss))
      .then((gloss) => settle(gloss ? { status: "done", gloss } : { status: "unavailable" }), () => settle({ status: "unavailable" }));
    return () => { live = false; };
  }, [enabled, entSeq, request]);
  if (!enabled || entSeq === null) return null;
  return state?.entSeq === entSeq ? state.value : { status: "loading" };
}

const isKanji = (character: string) => /\p{Script=Han}/u.test(character);

/**
 * One token as a word card (spec §6.3): headword (each kanji a button to QuickInspect), reading, part of
 * speech, up to three English senses and the Vietnamese gloss. Shared by the popover and the Vocabulary tab.
 */
export function WordCard({ token, onOpenKanji, requestGloss: request = true }: {
  token: AnalysisToken;
  onOpenKanji(literal: string): void;
  /** False for words the learner did not pick from a sentence (QuickInspect's common words): read, never generate. */
  requestGloss?: boolean;
}) {
  const t = useTranslations("shadowing");
  const best = token.entries[0] ?? null;
  const headword = best?.headword ?? token.base;
  const gloss = useVietnameseGloss(best?.entSeq ?? null, { request });

  return (
    <div className="space-y-xs">
      <div className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs">
        <p lang="ja" className="font-jp text-heading font-semibold text-foreground">
          {Array.from(headword).map((character, index) => (isKanji(character) ? (
            <button
              // eslint-disable-next-line react/no-array-index-key -- characters of one fixed headword.
              key={index}
              type="button"
              aria-label={t("workspace.selection.kanji", { literal: character })}
              onClick={() => onOpenKanji(character)}
              className="rounded-sm underline decoration-primary/40 decoration-dotted underline-offset-4 hover:bg-muted hover:decoration-primary"
            >
              {character}
            </button>
          ) : (
            // eslint-disable-next-line react/no-array-index-key -- characters of one fixed headword.
            <span key={index}>{character}</span>
          )))}
        </p>
        {best?.reading && best.reading !== headword && <p lang="ja" className="font-jp text-body text-muted-foreground">{best.reading}</p>}
        <p lang="ja" className="font-jp text-caption text-muted-foreground">{token.pos}</p>
      </div>
      {token.entries.length > 0 ? (
        <ol className="list-decimal space-y-2xs pl-md text-body text-foreground">
          {token.entries.map((entry) => <li key={entry.entSeq}>{entry.glossEn}</li>)}
        </ol>
      ) : (
        <p className="text-body text-muted-foreground">{t("workspace.selection.noEntry")}</p>
      )}
      {gloss && <VietnameseGloss state={gloss} />}
    </div>
  );
}

function VietnameseGloss({ state }: { state: GlossState }) {
  const t = useTranslations("shadowing");
  if (state.status === "loading") return <p role="status" className="text-caption text-muted-foreground">{t("workspace.selection.glossLoading")}</p>;
  if (state.status === "unavailable" || state.gloss.status === "missing") {
    return <p className="text-caption text-muted-foreground">{t("workspace.selection.glossUnavailable")}</p>;
  }
  if (state.gloss.status === "pending") return <p role="status" className="text-caption text-muted-foreground">{t("workspace.selection.glossPending")}</p>;
  return (
    <div className="space-y-2xs rounded-md bg-muted/60 px-sm py-xs">
      <p className="text-body text-foreground">{state.gloss.glossesVi.join("; ")}</p>
      {state.gloss.note && <p className="text-caption text-muted-foreground">{state.gloss.note}</p>}
      {state.gloss.source === "ai" && (
        <p className={cn("text-caption font-medium text-primary-strong")}>{t("workspace.selection.aiGenerated")}</p>
      )}
    </div>
  );
}
