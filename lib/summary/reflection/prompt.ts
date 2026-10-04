import type { SystemBlock } from "@/lib/ai/port";
import { dataBlocks, sectionSystem } from "@/lib/knowledge/sections/prompt";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import type { LessonAnalysisView } from "../analysis/view";
import type { ReflectionEvidence } from "./evidence";

export interface ReflectionPromptInput {
  system: SystemBlock[];
  user: string;
  /** `R<n>` → the real line, so finalize can resolve the highlight. Request-local; never stored. */
  lines: Map<string, { id: string; textJp: string }>;
}

const INSTRUCTION = [
  "You are Korume, a calm study companion, writing a short one-way reflection on ONE lesson the learner just studied.",
  "Use only these blocks: <lesson_title>, <lesson_overview>, <practice> (each skill: not_started, practiced, strong or needs_work), <saved> (yes or no), <lines> (\"id: text\" for the best line and the lines worth another pass), <lesson_points> (what the lesson teaches).",
  "text: two or three warm, specific sentences of plain prose. Do not ask the learner anything and do not invite a reply.",
  "Never mention numbers, counts, scores or percentages. Never mention other lessons, earlier days, goals, or anything about the learner beyond these blocks.",
  "Never quote Japanese inside text. To point at one line, put its id in highlight_line_id and copy the exact words from that line into highlight_span; otherwise set both to empty strings.",
].join("\n");

export function buildReflectionInput(
  evidence: ReflectionEvidence,
  analysis: LessonAnalysisView,
  lessonTitle: string,
  locale: KnowledgeLocale,
): ReflectionPromptInput {
  const lines = new Map<string, { id: string; textJp: string }>();
  const listed = [evidence.bestLine, ...evidence.targets].filter((line): line is NonNullable<typeof line> => line !== null);
  for (const line of listed) {
    if ([...lines.values()].some((known) => known.id === line.lineId)) continue;
    lines.set(`R${lines.size + 1}`, { id: line.lineId, textJp: line.lineText });
  }
  const keyOf = (lineId: string) => [...lines.entries()].find(([, line]) => line.id === lineId)?.[0] ?? "";
  return {
    lines,
    system: sectionSystem(locale, INSTRUCTION),
    user: dataBlocks({
      lesson_title: lessonTitle,
      lesson_overview: analysis.overview,
      practice: Object.entries(evidence.modes).map(([mode, quality]) => `${mode}: ${quality}`).join("\n"),
      saved: evidence.savedAnything ? "yes" : "no",
      lines: [
        ...(evidence.bestLine ? [`${keyOf(evidence.bestLine.lineId)} (said well): ${evidence.bestLine.lineText}`] : []),
        ...evidence.targets.map((target) => `${keyOf(target.lineId)} (worth another pass, ${target.reason}): ${target.lineText}`),
      ].join("\n"),
      lesson_points: [
        ...analysis.words.map((word) => word.surface),
        ...analysis.expressions.map((item) => item.expression),
        ...analysis.grammar.map((item) => item.title),
      ].join("\n"),
    }),
  };
}
