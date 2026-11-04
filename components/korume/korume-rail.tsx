"use client";

import { Link, useTranslations } from "@/lib/i18n";
import { useVietnameseGloss } from "@/components/shadowing-workspace/drawer/word-card";
import type { GroundedEntity, KorumeAnchorView } from "@/lib/korume/types";

export interface SmallMemory {
  title: string | null;
  lineTextJp: string | null;
  occurredAt: string;
}

export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** One row: glyph tile (decorative, first three characters), the full label then its meaning (Vietnamese when ready, R6), `JLPT Nx · seen N`, and a chevron to the lesson when there is one. */
function EntityRow({ entity }: { entity: GroundedEntity }) {
  const t = useTranslations("companion");
  // A collapsed homograph row joins glosses with " · " and keeps the stored English.
  const seq = entity.id.startsWith("ent:") && !entity.gloss?.includes(" · ") ? Number(entity.id.slice(4)) : NaN;
  const vi = useVietnameseGloss(Number.isFinite(seq) ? seq : null);
  const meaning = (vi?.status === "done" && vi.gloss.glossesVi.length ? vi.gloss.glossesVi.join(", ") : null) ?? entity.gloss;
  const glyph = Array.from(entity.label);
  const seen = entity.seenCount === undefined ? null
    : entity.seenCount === 0 ? t("ask.unseen")
    : entity.seenCapped ? t("ask.seenCapped", { count: entity.seenCount }) : t("ask.seen", { count: entity.seenCount });
  const meta = [entity.jlpt ? `JLPT ${entity.jlpt}` : null, seen].filter(Boolean).join(" · ");
  const lesson = entity.lessonLink;
  return (
    <li className="flex items-center gap-md rounded-full border border-border bg-card px-md py-sm">
      <span aria-hidden="true" lang="ja" className={`flex h-control-md aspect-square shrink-0 items-center justify-center rounded-full bg-muted font-jp ${glyph.length > 2 ? "text-caption" : "text-body"} text-foreground`}>
        {glyph.slice(0, 3).join("")}
      </span>
      <div className="min-w-0 flex-1">
        {/* The label is never clamped: only the meaning gives way to a narrow rail. */}
        <p lang="ja" className="break-words font-jp text-body text-foreground">{entity.label}</p>
        {meaning ? <p className="line-clamp-2 text-caption text-muted-foreground">{meaning}</p> : null}
        {meta ? <p className="text-caption text-muted-foreground">{meta}</p> : null}
      </div>
      {lesson ? (
        <Link
          href={`/shadowing/${lesson.videoId}${lesson.lineId ? `?line=${lesson.lineId}` : ""}`}
          aria-label={t("ask.chat.openLessonFor", { label: entity.label })}
          className="shrink-0 rounded-sm text-muted-foreground hover:text-primary-strong"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-icon-sm" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      ) : null}
    </li>
  );
}

/** Context that belongs to this thread, rather than a generic learner profile. */
export function KorumeRail({
  anchor,
  entities,
  memory,
}: {
  anchor: KorumeAnchorView | null;
  entities: GroundedEntity[];
  memory: SmallMemory | null;
}) {
  const t = useTranslations("companion");
  if (!anchor && !entities.length && !memory) return null;
  return (
    <aside
      aria-label={t("ask.chat.learningContext")}
      className="flex flex-col gap-lg rounded-lg border border-border bg-card p-lg"
    >
      {anchor ? (
        <section>
          <h2 className="text-caption font-semibold uppercase tracking-widest text-primary-strong">
            {t("ask.chat.learningContext")}
          </h2>
          <p lang="ja" className="mt-sm font-jp text-body-lg text-foreground">
            {anchor.lineText}
          </p>
          {anchor.translation ? (
            <p className="mt-xs text-body text-muted-foreground">
              {anchor.translation}
            </p>
          ) : null}
          <div className="mt-sm flex items-center gap-sm border-t border-border pt-sm text-caption">
            <span className="tabular-nums text-primary-strong">{clock(anchor.startTime)}</span>
            <Link
              href={`/shadowing/${anchor.videoId}?line=${anchor.lineId}`}
              className="min-w-0 truncate text-muted-foreground hover:underline"
            >
              {anchor.videoTitle}
            </Link>
          </div>
        </section>
      ) : null}
      {entities.length ? (
        <section className={anchor ? "border-t border-border pt-lg" : ""}>
          <h2 className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
            {t("ask.chat.inConversation")}
          </h2>
          <ul className="mt-sm flex flex-col gap-sm">
            {entities.map((entity) => <EntityRow key={entity.id} entity={entity} />)}
          </ul>
        </section>
      ) : null}
      {memory ? (
        <section className="border-t border-border pt-lg">
          <h2 className="text-caption font-semibold uppercase tracking-widest text-muted-foreground">
            {t("ask.chat.smallMemory")}
          </h2>
          {memory.title ? (
            <p className="mt-sm text-body font-medium text-foreground">
              {memory.title}
            </p>
          ) : null}
          {memory.lineTextJp ? (
            <p
              lang="ja"
              className="mt-xs font-jp text-body text-muted-foreground"
            >
              {memory.lineTextJp}
            </p>
          ) : null}
          <Link
            href="/companion"
            className="mt-sm inline-block text-caption font-medium text-primary-strong hover:underline"
          >
            {t("ask.chat.openMemory")}
          </Link>
        </section>
      ) : null}
    </aside>
  );
}
