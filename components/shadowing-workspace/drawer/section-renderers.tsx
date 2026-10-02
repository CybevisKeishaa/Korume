"use client";

import { useState } from "react";
import { TtsButton } from "@/components/speech/tts-button";
import { useTranslations } from "@/lib/i18n";
import type { SectionView } from "@/lib/knowledge/types";
import { cn } from "@/lib/utils";

/*
 * Every field below is model output (spec §5.6): it is read defensively and rendered as React text only —
 * never as HTML, never through Markdown. Numbers the schema could not range-check (a quiz answer, a turn's
 * speaker) are validated here.
 */
type Fields = Record<string, unknown>;
const record = (value: unknown): Fields => (value && typeof value === "object" && !Array.isArray(value) ? (value as Fields) : {});
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const list = (value: unknown): Fields[] => (Array.isArray(value) ? value.map(record) : []);
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item !== "") : []);
const validIndex = (value: unknown, length: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) < length;

const JP = "font-jp text-body text-foreground";
const MUTED = "text-caption text-muted-foreground";

function Line({ jp, reading, translation }: { jp: string; reading?: string; translation?: string }) {
  return (
    <div>
      {jp && <p lang="ja" className={JP}>{jp}</p>}
      {reading && <p lang="ja" className={cn("font-jp", MUTED)}>{reading}</p>}
      {translation && <p className="text-body text-foreground">{translation}</p>}
    </div>
  );
}

function Labeled({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return <p className="text-body text-foreground"><span className="font-medium">{label}: </span>{value}</p>;
}

export function SectionContent({ view, content, preview }: { view: SectionView; content: unknown; preview: boolean }) {
  const t = useTranslations("shadowing");
  const data = record(content);
  const label = (key: "literal" | "register" | "whenToUse" | "whenNotTo") => t(`workspace.ai.fields.${key}`);
  switch (view) {
    case "summary":
      return (
        <div className="space-y-2xs">
          {text(data.summary) && <p className="text-body text-foreground">{text(data.summary)}</p>}
          <Labeled label={label("literal")} value={text(data.literal)} />
          {strings(data.keyPoints).length > 0 && (
            <ul className="list-disc space-y-3xs pl-md text-body text-foreground">
              {strings(data.keyPoints).map((point, i) => <li key={i}>{point}</li>)}
            </ul>
          )}
        </div>
      );
    case "patterns":
      return (
        <ul className="space-y-xs">
          {list(data.items).map((item, i) => (
            <li key={i} className="space-y-3xs">
              <p lang="ja" className={JP}><span className="font-semibold">{text(item.surface)}</span>{text(item.pattern) && <span className={cn("ml-xs", MUTED)}>{text(item.pattern)}</span>}</p>
              {text(item.meaning) && <p className="text-body text-foreground">{text(item.meaning)}</p>}
              {text(item.explanation) && <p className={MUTED}>{text(item.explanation)}</p>}
            </li>
          ))}
        </ul>
      );
    case "notes":
      return (
        <ul className="space-y-xs">
          {list(data.notes).map((note, i) => (
            <li key={i}>
              {text(note.title) && <p className="text-body font-medium text-foreground">{text(note.title)}</p>}
              {text(note.body) && <p className="text-body text-foreground">{text(note.body)}</p>}
            </li>
          ))}
        </ul>
      );
    case "mistakes":
      return (
        <ul className="space-y-xs">
          {list(data.items).map((item, i) => (
            <li key={i} className="space-y-3xs">
              <p lang="ja" className={cn(JP, "line-through decoration-destructive")}>{text(item.mistake)}</p>
              <p lang="ja" className={JP}>{text(item.correction)}</p>
              {text(item.why) && <p className={MUTED}>{text(item.why)}</p>}
            </li>
          ))}
        </ul>
      );
    case "expressions":
      return (
        <ul className="space-y-xs">
          {list(data.items).map((item, i) => (
            <li key={i} className="space-y-3xs">
              <Line jp={text(item.jp)} reading={text(item.reading)} translation={text(item.translation)} />
              {text(item.difference) && <p className={MUTED}>{text(item.difference)}</p>}
            </li>
          ))}
        </ul>
      );
    case "nuance":
      return (
        <div className="space-y-2xs">
          <Labeled label={label("register")} value={text(data.register)} />
          {text(data.nuance) && <p className="text-body text-foreground">{text(data.nuance)}</p>}
          <Labeled label={label("whenToUse")} value={text(data.whenToUse)} />
          <Labeled label={label("whenNotTo")} value={text(data.whenNotTo)} />
        </div>
      );
    case "examples":
      return (
        <ul className="space-y-xs">
          {list(data.examples).map((example, i) => (
            <li key={i}><Line jp={text(example.jp)} reading={text(example.reading)} translation={text(example.translation)} /></li>
          ))}
        </ul>
      );
    case "quiz":
      return <Quiz questions={list(data.questions)} preview={preview} />;
    case "dialogue":
      return <Dialogue context={text(data.context)} roles={strings(data.roles)} turns={list(data.turns)} />;
    case "phrase":
      return (
        <div className="space-y-2xs">
          {text(data.phrase) && <p lang="ja" className={cn(JP, "font-semibold")}>{text(data.phrase)}</p>}
          <ul className="space-y-3xs">
            {list(data.breakdown).map((part, i) => (
              <li key={i} className="text-body text-foreground">
                <span lang="ja" className="font-jp font-medium">{text(part.part)}</span>
                {text(part.role) && <span className={cn("ml-xs", MUTED)}>{text(part.role)}</span>}
                {text(part.meaning) && <span className="ml-xs">{text(part.meaning)}</span>}
              </li>
            ))}
          </ul>
          {text(data.nuance) && <p className="text-body text-foreground">{text(data.nuance)}</p>}
        </div>
      );
  }
}

/** Graded on the client, kept for this view only (spec §6.4). A preview carries no answers: nothing to grade. */
function Quiz({ questions, preview }: { questions: Fields[]; preview: boolean }) {
  const t = useTranslations("shadowing");
  const [picked, setPicked] = useState<Record<number, number>>({});
  return (
    <ol className="space-y-sm">
      {questions.map((question, q) => {
        const choices = strings(question.choices);
        // An answer outside the choices cannot be graded: the question is shown without grading.
        const answer = !preview && validIndex(question.answerIndex, choices.length) ? question.answerIndex : null;
        const choice = picked[q];
        return (
          <li key={q} className="space-y-2xs">
            <p className="text-body font-medium text-foreground">{text(question.prompt)}</p>
            <div role="group" aria-label={text(question.prompt)} className="flex flex-wrap gap-2xs">
              {choices.map((option, c) => {
                const graded = choice !== undefined && answer !== null;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={answer === null || choice !== undefined}
                    aria-pressed={choice === c}
                    onClick={() => setPicked((current) => ({ ...current, [q]: c }))}
                    className={cn(
                      "rounded-md border border-border px-sm py-3xs text-left text-body text-foreground disabled:cursor-default",
                      graded && c === answer && "border-success bg-success/10",
                      graded && choice === c && c !== answer && "border-destructive bg-destructive/10",
                    )}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {choice !== undefined && answer !== null && (
              <p role="status" className="text-caption text-foreground">
                <span className="font-medium">{t(choice === answer ? "workspace.ai.quiz.correct" : "workspace.ai.quiz.incorrect")}</span>
                {text(question.explanation) && <> <span>{text(question.explanation)}</span></>}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Dialogue({ context, roles, turns }: { context: string; roles: string[]; turns: Fields[] }) {
  const t = useTranslations("shadowing");
  return (
    <div className="space-y-xs">
      {context && <p className={MUTED}>{context}</p>}
      <ol className="space-y-xs">
        {turns.map((turn, i) => {
          const jp = text(turn.jp);
          // A speaker index outside the roles names nobody: the turn is shown without a speaker.
          const speaker = validIndex(turn.role, roles.length) ? roles[turn.role] : null;
          return (
            <li key={i} className="flex items-start gap-xs">
              <div className="min-w-0 flex-1">
                {speaker && <p className="text-caption font-medium text-primary-strong">{speaker}</p>}
                <Line jp={jp} reading={text(turn.reading)} translation={text(turn.translation)} />
              </div>
              {jp && <TtsButton text={jp} label={t("workspace.ai.playTurn", { number: i + 1 })} unavailableLabel={t("workspace.ai.ttsUnavailable")} />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
