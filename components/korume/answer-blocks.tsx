"use client";

import { useTranslations } from "@/lib/i18n";
import { FuriganaText } from "@/components/video-player/furigana-text";
import type { AnswerV1, Block, Run } from "@/lib/korume/answer";
import type { GroundedEntity } from "@/lib/korume/types";
import { ListenButton } from "./listen-button";

/**
 * Renders an `AnswerV1` (spec §6.1) as plain React text nodes — React escapes every string, so a `<script>` the
 * model wrote is shown as characters, never parsed. There is no HTML or Markdown path in this component.
 */
export function AnswerBlocks({ answer, grounding, onFollowup }: {
  answer: AnswerV1;
  grounding: GroundedEntity[];
  onFollowup?: (text: string) => void;
}) {
  const entities = new Map(grounding.map((e) => [e.id, e]));
  return (
    <div className="flex flex-col gap-md text-body-lg leading-relaxed">
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
    return <span lang="ja" className="mx-2xs rounded-sm bg-muted px-2xs font-jp text-foreground">{run.jp}</span>;
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
        <figure className="rounded-lg border border-primary/20 bg-primary/5 px-md py-sm">
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
        <aside className="flex items-start gap-sm rounded-lg border border-border bg-card px-md py-sm">
          <span lang="ja" className="flex size-icon-lg shrink-0 items-center justify-center rounded-full bg-muted font-jp text-body-lg text-foreground">
            {Array.from(entity.label)[0]}
          </span>
          <div className="min-w-0">
            <p className="text-body font-medium text-foreground">
              <span lang="ja" className="font-jp">{entity.label}</span>
              {entity.reading ? <span lang="ja" className="ms-xs font-jp text-caption text-muted-foreground">{entity.reading}</span> : null}
            </p>
            <p className="text-caption text-muted-foreground">
              {[entity.jlpt, seen].filter(Boolean).join(" · ")}
            </p>
            {block.note ? <p className="mt-2xs text-body text-foreground/80">{block.note}</p> : null}
          </div>
        </aside>
      );
    }
    case "followups":
      return (
        <ul aria-label={t("ask.followups")} className="flex flex-wrap gap-xs">
          {block.chips.map((chip) => (
            <li key={chip}>
              <button
                type="button"
                onClick={() => onFollowup?.(chip)}
                disabled={!onFollowup}
                className="min-h-hit-target rounded-full border border-primary/30 px-sm text-caption text-primary-strong hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                {chip}
              </button>
            </li>
          ))}
        </ul>
      );
  }
}
