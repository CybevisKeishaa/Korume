"use client";

import { useEffect, useState } from "react";
import { Link, useTranslations } from "@/lib/i18n";
import type { KanjiCommonWord, KanjiData } from "@/lib/dictionary/types";
import { StrokeOrder } from "@/components/motion/stroke-order";
import { TtsButton } from "@/components/speech/tts-button";
import { DictionaryAttribution } from "./dictionary-attribution";

type Loaded = { status: "loading" } | { status: "ready"; kanji: KanjiData } | { status: "error" };

// One GET per literal for the tab's lifetime: a snapshot's kanji never changes.
const cache = new Map<string, Promise<KanjiData>>();

export function resetKanjiCacheForTests(): void {
  cache.clear();
}

function loadKanji(literal: string): Promise<KanjiData> {
  let pending = cache.get(literal);
  if (!pending) {
    pending = fetch(`/api/dictionary/kanji/${encodeURIComponent(literal)}`).then(async (response) => {
      if (!response.ok) throw new Error(`kanji ${response.status}`);
      return ((await response.json()) as { data: KanjiData }).data;
    });
    pending.catch(() => cache.delete(literal));
    cache.set(literal, pending);
  }
  return pending;
}

function Readings({ label, readings, listen, unavailable }: { label: string; readings: string[]; listen(reading: string): string; unavailable: string }) {
  if (readings.length === 0) return null;
  return (
    <div className="space-y-2xs">
      <p className="text-caption font-medium text-muted-foreground">{label}</p>
      <ul className="flex flex-wrap gap-x-sm gap-y-2xs">
        {readings.map((reading) => (
          <li key={reading} className="flex items-center gap-2xs">
            <span lang="ja" className="font-jp text-body text-foreground">{reading}</span>
            {/* Okurigana is marked with a dot in KANJIDIC2 (た.べる): speak the plain reading. */}
            <TtsButton text={reading.replace(/[.\-]/g, "")} label={listen(reading)} unavailableLabel={unavailable} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * KanjiQuickInspect (spec §6.5): the active snapshot's kanji in the drawer — glyph and stroke order with
 * Replay, On/Kun with TTS, meanings (+ the curated Vietnamese meaning and mnemonic when they exist), stats,
 * up to five common words, a link to the full page, and the dictionary attribution.
 */
export function KanjiQuickInspect({ literal, onOpenWord }: { literal: string; onOpenWord(word: KanjiCommonWord): void }) {
  const t = useTranslations("kanji");
  const [loaded, setLoaded] = useState<{ literal: string; value: Loaded } | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  useEffect(() => {
    let live = true;
    loadKanji(literal).then(
      (kanji) => { if (live) setLoaded({ literal, value: { status: "ready", kanji } }); },
      () => { if (live) setLoaded({ literal, value: { status: "error" } }); },
    );
    return () => { live = false; };
  }, [literal]);
  const state: Loaded = loaded?.literal === literal ? loaded.value : { status: "loading" };

  if (state.status === "loading") return <p role="status" className="text-body text-muted-foreground">{t("quickInspect.loading")}</p>;
  if (state.status === "error") return <p className="text-body text-muted-foreground">{t("quickInspect.failed")}</p>;
  const { kanji } = state;
  const listen = (reading: string) => t("quickInspect.listen", { reading });
  const unavailable = t("quickInspect.ttsUnavailable");

  return (
    <article aria-label={t("quickInspect.label", { literal: kanji.literal })} className="space-y-sm">
      <div className="flex gap-md">
        <div className="w-[--kanji-quick-glyph] shrink-0 space-y-2xs">
          <StrokeOrder character={kanji.literal} paths={kanji.strokePaths} replayKey={replayKey} />
          <button
            type="button"
            onClick={() => setReplayKey((key) => key + 1)}
            className="flex h-control-sm w-full items-center justify-center rounded-md border border-border text-caption text-foreground hover:bg-muted"
          >
            {t("quickInspect.replay")}
          </button>
        </div>
        <div className="min-w-0 flex-1 space-y-xs">
          <p className="text-body text-foreground">{kanji.meaningsEn.join(", ")}</p>
          {kanji.meaningVi && <p className="text-body text-foreground">{kanji.meaningVi}</p>}
          <Readings label={t("onReading")} readings={kanji.onReadings} listen={listen} unavailable={unavailable} />
          <Readings label={t("kunReading")} readings={kanji.kunReadings} listen={listen} unavailable={unavailable} />
          <p className="text-caption text-muted-foreground">
            {[
              t("strokeCount", { count: kanji.strokeCount }),
              kanji.frequency !== null ? t("frequency", { rank: kanji.frequency }) : null,
              kanji.grade !== null ? t("grade", { grade: kanji.grade }) : null,
              kanji.jlpt ? t("quickInspect.jlpt", { level: kanji.jlpt }) : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      {kanji.mnemonic && (
        <div className="space-y-2xs">
          <p className="text-caption font-medium text-muted-foreground">{t("mnemonic")}</p>
          <p className="text-body text-foreground">{kanji.mnemonic}</p>
        </div>
      )}
      {kanji.commonWords.length > 0 && (
        <div className="space-y-2xs">
          <p className="text-caption font-medium text-muted-foreground">{t("commonWords")}</p>
          <ul className="space-y-2xs">
            {kanji.commonWords.slice(0, 5).map((word) => (
              <li key={word.entSeq}>
                <button type="button" onClick={() => onOpenWord(word)} className="flex w-full items-baseline gap-sm rounded-md px-xs py-2xs text-left hover:bg-muted">
                  <span lang="ja" className="font-jp text-body font-medium text-foreground">{word.headword}</span>
                  <span lang="ja" className="font-jp text-caption text-muted-foreground">{word.reading}</span>
                  <span className="min-w-0 truncate text-caption text-muted-foreground">{word.glossEn}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link href={`/kanji/${encodeURIComponent(kanji.literal)}`} className="inline-flex text-caption font-medium text-primary-strong underline-offset-2 hover:underline">
        {t("quickInspect.viewFullDetails")}
      </Link>
      <DictionaryAttribution label={t("dictionarySources")} attribution={kanji.attribution} />
    </article>
  );
}
