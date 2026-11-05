"use client";

import { Check, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { FuriganaText } from "@/components/video-player/furigana-text";
import type { Answer, Block, Run } from "@/lib/korume/answer";
import type { GroundedEntity } from "@/lib/korume/types";
import { ListenButton } from "./listen-button";

/**
 * Renders an `Answer` (spec §6.1) as plain React text nodes — React escapes every string, so a `<script>` the
 * model wrote is shown as characters, never parsed. There is no HTML or Markdown path in this component.
 */
export function AnswerBlocks({ answer, grounding, onFollowup }: {
  answer: Answer;
  grounding: GroundedEntity[];
  onFollowup?: (text: string) => void;
}) {
  const entities = new Map(grounding.map((e) => [e.id, e]));
  return (
    <div className="flex flex-col gap-md text-body-lg">
      {answer.blocks.map((block, i) => <AnswerBlock key={i} block={block} entities={entities} onFollowup={onFollowup} />)}
    </div>
  );
}

/** Ruby only when its bases spell the sentence exactly; otherwise the plain sentence, never a partial one. */
export function exampleSegments(block: Extract<Block, { type: "example" }>): { text: string; reading?: string }[] {
  const spelled = block.ruby.map((r) => r.base).join("");
  if (!block.ruby.length || spelled !== block.jp) return [{ text: block.jp }];
  return block.ruby.map((r) => (r.reading ? { text: r.base, reading: r.reading } : { text: r.base }));
}

function RunText({ run }: { run: Run }) {
  if ("jp" in run) {
    return <span lang="ja" className="mx-2xs rounded-sm bg-primary/10 px-2xs font-jp text-primary-strong">{run.jp}</span>;
  }
  return run.strong ? <strong className="font-semibold text-foreground">{run.text}</strong> : <>{run.text}</>;
}

function AnswerBlock({ block, entities, onFollowup }: {
  block: Block;
  entities: Map<string, GroundedEntity>;
  onFollowup?: (text: string) => void;
}) {
  const t = useTranslations("companion");
  switch (block.type) {
    case "paragraph":
      return <p className="text-foreground/90">{block.runs.map((run, i) => <RunText key={i} run={run} />)}</p>;
    case "example":
      return (
        <figure className="rounded-lg border border-primary/15 bg-primary/5 px-md py-sm">
          <div className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs">
            <FuriganaText className="font-jp text-body-lg text-foreground" segments={exampleSegments(block)} />
            <ListenButton text={block.jp} />
          </div>
          {block.translation ? <figcaption className="mt-2xs text-caption text-muted-foreground">{block.translation}</figcaption> : null}
        </figure>
      );
    case "context_card": {
      const entity = entities.get(block.entityRef);
      if (!entity) return null;
      const seen = entity.seenCount === undefined ? null
        : t(entity.seenCapped ? "ask.seenCapped" : "ask.seen", { count: entity.seenCount });
      return (
        <aside className="rounded-lg border border-border bg-background px-md py-sm">
          <div className="flex items-center justify-between gap-sm">
            <p className="text-caption font-semibold uppercase tracking-widest text-primary-strong">{t(`ask.kind.${entity.kind}`)}</p>
            {entity.jlpt ? <span className="rounded-full bg-primary/10 px-xs text-caption font-bold text-primary-strong">{`JLPT ${entity.jlpt}`}</span> : null}
          </div>
          <p className="mt-xs text-body-lg font-medium text-foreground">
            <span lang="ja" className="font-jp">{entity.label}</span>
            {entity.reading ? <span lang="ja" className="ms-xs font-jp text-caption text-muted-foreground">{entity.reading}</span> : null}
          </p>
          {seen ? <p className="text-caption text-muted-foreground">{seen}</p> : null}
          {block.note ? <p className="mt-2xs text-body text-foreground/80">{block.note}</p> : null}
        </aside>
      );
    }
    case "heading": {
      const [first, ...rest] = block.runs;
      const numeral = block.level === 1 && first && "text" in first ? /^(\d+[.)]|[①-⑳])(\s*)/.exec(first.text) : null;
      const runs: Run[] = numeral && first && "text" in first ? [{ ...first, text: first.text.slice(numeral[1]?.length) }, ...rest] : block.runs;
      return (
        <h3 className={block.level === 1 ? "text-body-lg font-semibold text-foreground" : "text-body font-semibold text-foreground"}>
          {numeral ? <span className="text-primary-strong">{numeral[1]}</span> : null}
          {runs.map((run, i) => <RunText key={i} run={run} />)}
        </h3>
      );
    }
    case "list": {
      const Tag = block.style === "number" ? "ol" : "ul";
      return (
        <Tag className={`flex flex-col gap-2xs ${block.style === "number" ? "list-decimal ps-md" : block.style === "bullet" ? "list-disc ps-md" : ""}`}>
          {block.items.map((item, i) => (
            <li key={i} className={block.style === "check" ? "flex items-baseline gap-xs" : undefined}>
              {block.style === "check" && item.mark ? (
                <>
                  {item.mark === "good" ? <Check aria-hidden className="size-4 shrink-0 self-center text-success" /> : <X aria-hidden className="size-4 shrink-0 self-center text-danger" />}
                  <span className="sr-only">{t(`ask.mark.${item.mark}`)}</span>
                </>
              ) : null}
              <span>{item.runs.map((run, j) => <RunText key={j} run={run} />)}</span>
            </li>
          ))}
        </Tag>
      );
    }
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="min-w-max border-collapse text-body">
            <thead>
              <tr>
                {block.header.map((cell, i) => (
                  <th key={i} scope="col" className="border border-border bg-muted px-sm py-2xs text-start font-semibold text-foreground">
                    {cell.map((run, j) => <RunText key={j} run={run} />)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="border border-border px-sm py-2xs text-foreground/90">{cell.map((run, k) => <RunText key={k} run={run} />)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "followups":
      return (
        <ul aria-label={t("ask.followups")} className="flex flex-wrap gap-xs">
          {block.chips.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                onClick={() => onFollowup?.(chip)}
                disabled={!onFollowup}
                className="min-h-hit-target rounded-full border border-primary/20 bg-primary/10 px-sm text-caption font-medium text-primary-strong hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {chip}
              </button>
            </li>
          ))}
        </ul>
      );
  }
}
