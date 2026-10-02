"use client";

import { Link, useTranslations } from "@/lib/i18n";
import { AI_GRAMMAR_SHORTCUT } from "@/lib/knowledge/types";
import { SparklesGlyph } from "../player-glyphs";
import { useLineAnalysis } from "../use-line-analysis";
import { useDrawer } from "./drawer-context";

/**
 * Grammar (spec §6.4): the deterministic matches of `grammar_points` in the target, each with its structure,
 * explanation and examples and a link to the grammar page — plus the explicit "AI Grammar Breakdown →".
 */
export function GrammarTab() {
  const t = useTranslations("shadowing");
  const { dispatch, target } = useDrawer();
  const analysis = useLineAnalysis(target?.lineId ?? null);
  if (!target) return null;
  const matches = analysis?.status === "ready"
    ? analysis.analysis.grammar.filter((match) => !target.span || (match.span.start < target.span.end && match.span.end > target.span.start))
    : [];

  return (
    <div className="space-y-sm">
      <button
        type="button"
        onClick={() => dispatch({ type: "open", tab: "ai", target, section: AI_GRAMMAR_SHORTCUT })}
        className="inline-flex h-control-sm items-center gap-2xs rounded-md border border-border px-sm text-caption font-medium text-foreground hover:bg-muted"
      >
        <SparklesGlyph className="size-icon-xs text-primary-strong" />
        {t("workspace.grammar.aiBreakdown")}
      </button>
      {(!analysis || analysis.status === "loading") && <p role="status" className="text-body text-muted-foreground">{t("workspace.grammar.loading")}</p>}
      {analysis?.status === "error" && <p className="text-body text-muted-foreground">{t("workspace.grammar.failed")}</p>}
      {analysis?.status === "ready" && matches.length === 0 && <p className="text-body text-muted-foreground">{t("workspace.grammar.none")}</p>}
      {matches.map((match) => (
        <article key={`${match.grammarPointId}:${match.span.start}`} aria-label={match.title} className="space-y-2xs rounded-md border border-border p-sm">
          <h3 lang="ja" className="font-jp text-body font-semibold text-foreground">{match.title}</h3>
          {match.structure && <p lang="ja" className="font-jp text-caption text-primary-strong">{match.structure}</p>}
          {match.explanation && <p className="text-body text-foreground">{match.explanation}</p>}
          {match.examples.length > 0 && (
            <ul className="space-y-2xs border-l-2 border-border pl-sm">
              {match.examples.map((example) => (
                <li key={example.jp} className="text-caption">
                  <span lang="ja" className="font-jp text-foreground">{example.jp}</span>
                  {example.en && <span className="ml-xs text-muted-foreground">{example.en}</span>}
                </li>
              ))}
            </ul>
          )}
          <Link href={`/grammar#grammar-${match.grammarPointId}`} className="inline-flex text-caption font-medium text-primary-strong underline-offset-2 hover:underline">
            {t("workspace.grammar.open")}
          </Link>
        </article>
      ))}
    </div>
  );
}
