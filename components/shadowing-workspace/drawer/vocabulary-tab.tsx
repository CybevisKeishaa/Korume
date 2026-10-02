"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import type { AnalysisToken, LessonVocabularyItem, LessonVocabularyPage } from "@/lib/analysis/types";
import type { KanjiCommonWord } from "@/lib/dictionary/types";
import { cn } from "@/lib/utils";
import { KanjiQuickInspect } from "@/components/kanji/kanji-quick-inspect";
import { BackGlyph } from "../player-glyphs";
import { useLineAnalysis } from "../use-line-analysis";
import { useLesson, usePlaybackController } from "../workspace-context";
import { useDrawer } from "./drawer-context";
import { WordCard } from "./word-card";

const PAGE = 50;
const ROW = "flex w-full items-baseline gap-sm rounded-md px-xs py-2xs text-left hover:bg-muted";
const BACK = "inline-flex h-control-sm items-center gap-2xs rounded-md px-xs text-caption text-muted-foreground hover:bg-muted hover:text-foreground";

/** A common word from QuickInspect as a word card's token: it is not in the line, so it has no span. */
function commonWordToken(word: KanjiCommonWord): AnalysisToken {
  return {
    index: -1, surface: word.headword, base: word.headword, reading: null, pos: "", span: { start: 0, end: 0 },
    entries: [{ entSeq: word.entSeq, headword: word.headword, reading: word.reading, glossEn: word.glossEn, jlpt: null }], vocabId: null,
  };
}

/**
 * Vocabulary (spec §6.4): the target's words as buttons — the keyboard path to the word card — each with its
 * reading, a short English gloss and the learner's SRS stage; word card → kanji → QuickInspect, with Back.
 * Whole lesson pages the server-aggregated vocabulary. Rendering the list never requests a gloss.
 */
export function VocabularyTab() {
  const t = useTranslations("shadowing");
  const { state, dispatch, target } = useDrawer();
  const [scope, setScope] = useState<"sentence" | "lesson">("sentence");
  const [commonWords, setCommonWords] = useState(new Map<number, AnalysisToken>());
  const analysis = useLineAnalysis(target?.lineId ?? null);
  if (!target) return null;

  const back = (
    <button type="button" onClick={() => dispatch({ type: "back" })} className={BACK}>
      <BackGlyph className="size-icon-xs" />
      {t("workspace.vocabulary.back")}
    </button>
  );

  if (state.kanji) {
    return (
      <div className="space-y-xs">
        {back}
        <KanjiQuickInspect
          literal={state.kanji}
          onOpenWord={(word) => {
            setCommonWords((words) => new Map(words).set(word.entSeq, commonWordToken(word)));
            dispatch({ type: "open-word", entSeq: word.entSeq, target });
          }}
        />
      </div>
    );
  }

  const tokens = analysis?.status === "ready" ? analysis.analysis.tokens : [];
  if (state.wordEntSeq !== null) {
    const fromLine = tokens.find((token) => token.entries[0]?.entSeq === state.wordEntSeq);
    const token = fromLine ?? commonWords.get(state.wordEntSeq);
    return (
      <div className="space-y-xs">
        {back}
        {token && (
          <WordCard
            token={token}
            requestGloss={Boolean(fromLine)}
            onOpenKanji={(literal) => dispatch({ type: "open-kanji", literal, target })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-sm">
      <div role="group" aria-label={t("workspace.vocabulary.scope")} className="flex gap-2xs">
        {(["sentence", "lesson"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={scope === value}
            onClick={() => setScope(value)}
            className={cn("h-control-sm rounded-md px-sm text-caption", scope === value ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            {t(value === "sentence" ? "workspace.vocabulary.thisSentence" : "workspace.vocabulary.wholeLesson")}
          </button>
        ))}
      </div>
      {scope === "lesson" ? <LessonVocabulary /> : (
        <SentenceVocabulary
          state={analysis}
          tokens={tokens.filter((token) => token.entries.length > 0 && (!target.span || (token.span.start >= target.span.start && token.span.end <= target.span.end)))}
          mastery={analysis?.status === "ready" ? analysis.analysis.mastery : {}}
          onOpen={(entSeq) => dispatch({ type: "open-word", entSeq, target })}
        />
      )}
    </div>
  );
}

function MasteryBadge({ stage }: { stage: number | undefined | null }) {
  const t = useTranslations("shadowing");
  if (stage === undefined || stage === null) return null;
  return <span className="ml-auto shrink-0 rounded-sm bg-muted px-2xs text-caption text-muted-foreground">{t("workspace.vocabulary.mastery", { stage })}</span>;
}

function SentenceVocabulary({ state, tokens, mastery, onOpen }: {
  state: ReturnType<typeof useLineAnalysis>;
  tokens: AnalysisToken[];
  mastery: Record<string, number>;
  onOpen(entSeq: number): void;
}) {
  const t = useTranslations("shadowing");
  if (!state || state.status === "loading") return <p role="status" className="text-body text-muted-foreground">{t("workspace.vocabulary.loading")}</p>;
  if (state.status === "error") return <p className="text-body text-muted-foreground">{t("workspace.vocabulary.failed")}</p>;
  if (tokens.length === 0) return <p className="text-body text-muted-foreground">{t("workspace.vocabulary.noWords")}</p>;
  return (
    <ul className="space-y-2xs">
      {tokens.map((token) => {
        const entry = token.entries[0];
        if (!entry) return null;
        return (
          <li key={token.index}>
            <button type="button" onClick={() => onOpen(entry.entSeq)} className={ROW}>
              <span lang="ja" className="font-jp text-body font-medium text-foreground">{token.surface}</span>
              <span lang="ja" className="font-jp text-caption text-muted-foreground">{entry.reading}</span>
              <span className="min-w-0 truncate text-caption text-muted-foreground">{entry.glossEn}</span>
              <MasteryBadge stage={token.vocabId ? mastery[token.vocabId] : null} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The lesson's words, page by page from the server aggregate; a word opens the sentences it occurs in. */
function LessonVocabulary() {
  const t = useTranslations("shadowing");
  const { video, lines } = useLesson();
  const controller = usePlaybackController();
  const [pages, setPages] = useState<{ items: LessonVocabularyItem[]; nextCursor: string | null; total: number } | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "error">("loading");
  const [opened, setOpened] = useState<number | null>(null);

  const load = (cursor: string | null) => {
    setStatus("loading");
    fetch(`/api/videos/${video.id}/vocabulary?limit=${PAGE}${cursor ? `&cursor=${cursor}` : ""}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const page = ((await response.json()) as { data: LessonVocabularyPage }).data;
        setPages((previous) => ({ items: [...(cursor ? previous?.items ?? [] : []), ...page.items], nextCursor: page.nextCursor, total: page.total }));
        setStatus("idle");
      })
      .catch(() => setStatus("error"));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the first page loads once, when the learner switches to Whole lesson.
  useEffect(() => load(null), [video.id]);

  return (
    <div className="space-y-xs">
      {pages && <p className="text-caption text-muted-foreground">{t("workspace.vocabulary.total", { count: pages.total })}</p>}
      <ul className="space-y-2xs">
        {pages?.items.map((item) => (
          <li key={item.entSeq}>
            <button type="button" aria-expanded={opened === item.entSeq} onClick={() => setOpened(opened === item.entSeq ? null : item.entSeq)} className={ROW}>
              <span lang="ja" className="font-jp text-body font-medium text-foreground">{item.headword}</span>
              <span lang="ja" className="font-jp text-caption text-muted-foreground">{item.reading}</span>
              <span className="min-w-0 truncate text-caption text-muted-foreground">{item.glossEn}</span>
              <span className="shrink-0 text-caption tabular-nums text-muted-foreground">{t("workspace.vocabulary.occurrences", { count: item.occurrences })}</span>
              <MasteryBadge stage={item.mastery} />
            </button>
            {opened === item.entSeq && (
              <ul aria-label={t("workspace.vocabulary.sentences", { word: item.headword })} className="ml-md space-y-2xs border-l border-border pl-sm">
                {item.exampleLineIds.map((lineId) => {
                  const index = lines.findIndex((line) => line.id === lineId);
                  const line = lines[index];
                  return line ? (
                    <li key={lineId}>
                      <button type="button" onClick={() => controller.seekToSentence(index)} className={cn(ROW, "font-jp text-body text-foreground")}>
                        <span className="text-caption tabular-nums text-muted-foreground">{index + 1}</span>
                        <span lang="ja">{line.textJp}</span>
                      </button>
                    </li>
                  ) : null;
                })}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {status === "loading" && <p role="status" className="text-body text-muted-foreground">{t("workspace.vocabulary.loading")}</p>}
      {status === "error" && (
        <p className="text-body text-muted-foreground">
          {t("workspace.vocabulary.failed")}{" "}
          <button type="button" onClick={() => load(pages?.nextCursor ?? null)} className="font-medium text-primary-strong underline-offset-2 hover:underline">{t("workspace.vocabulary.retry")}</button>
        </p>
      )}
      {status === "idle" && pages?.nextCursor && (
        <button type="button" onClick={() => load(pages.nextCursor)} className="h-control-sm rounded-md border border-border px-sm text-caption text-foreground hover:bg-muted">
          {t("workspace.vocabulary.showMore")}
        </button>
      )}
    </div>
  );
}
