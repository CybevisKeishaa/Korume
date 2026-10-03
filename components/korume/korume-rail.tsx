import { Link, useTranslations } from "@/lib/i18n";
import type { GroundedEntity, KorumeAnchorView } from "@/lib/korume/types";

export interface SmallMemory {
  title: string | null;
  lineTextJp: string | null;
  occurredAt: string;
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
          <h2 className="text-caption font-semibold tracking-widest text-primary-strong">
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
          <Link
            href={`/shadowing/${anchor.videoId}?line=${anchor.lineId}`}
            className="mt-sm inline-block text-caption font-medium text-primary-strong hover:underline"
          >
            {anchor.videoTitle}
          </Link>
        </section>
      ) : null}
      {entities.length ? (
        <section className={anchor ? "border-t border-border pt-lg" : ""}>
          <h2 className="text-caption font-semibold tracking-widest text-muted-foreground">
            {t("ask.chat.inConversation")}
          </h2>
          <ul className="mt-sm flex flex-col gap-sm">
            {entities.map((entity) => (
              <li
                key={entity.id}
                className="rounded-lg border border-border px-md py-sm"
              >
                <p className="font-medium text-foreground">{entity.label}</p>
                {entity.seenCount !== undefined ? (
                  <p className="text-caption text-muted-foreground">
                    {entity.seenCapped
                      ? t("ask.seenCapped", { count: entity.seenCount })
                      : t("ask.seen", { count: entity.seenCount })}
                  </p>
                ) : null}
                {entity.lessonLink ? (
                  <Link
                    href={`/shadowing/${entity.lessonLink.videoId}${entity.lessonLink.lineId ? `?line=${entity.lessonLink.lineId}` : ""}`}
                    className="text-caption text-primary-strong hover:underline"
                  >
                    {t("ask.chat.openLesson")}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {memory ? (
        <section className="border-t border-border pt-lg">
          <h2 className="text-caption font-semibold tracking-widest text-muted-foreground">
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
