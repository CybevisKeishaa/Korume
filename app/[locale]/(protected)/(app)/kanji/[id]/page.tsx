import { redirect } from "@/lib/i18n/navigation";
import { getLocale } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { getKanjiById, getKanjiList } from "@/lib/data/content";
import { listKanjiFavorites } from "@/lib/data/kanji-learner";
import { jlptLevelSchema } from "@/lib/validation/content";
import type { KanjiExplore } from "@/lib/kanji/learner-types";
import { getKanjiInspectPayload } from "@/lib/dictionary/kanji-data-service";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import { KanjiInspect } from "@/components/kanji/kanji-inspect";
import { StudyPresence } from "@/components/study-time/study-presence";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The canonical kanji URL is the literal (`/kanji/緑`, spec §6.5). A legacy curated UUID redirects to it, and
 * a kanji that is only in the dictionary still gets a page, so no "View full details" link is ever dead.
 */
export default async function KanjiDetailPage({ params }: { params: { id: string } }) {
  if (UUID.test(params.id)) {
    const curated = await getKanjiById(params.id);
    if (!curated) notFound();
    redirect({ href: `/kanji/${encodeURIComponent(curated.character)}`, locale: await getLocale() });
  }

  const literal = parseKanjiLiteral(params.id);
  if (!literal) notFound();
  const payload = await getKanjiInspectPayload(literal);
  if (!payload) notFound();
  const level = jlptLevelSchema.safeParse(payload.data.jlpt).data;
  const [levelList, favorites] = await Promise.all([level ? getKanjiList(level) : null, listKanjiFavorites()]);
  const explore: KanjiExplore = {
    level: level && levelList ? { level, literals: levelList.map((item) => item.character) } : null,
    favorites,
  };

  // One viewport, no page scroll, and the card fills it (owner 2026-11-06, K14; L-051): its blocks fit inside.
  return (
    <div className="flex h-dvh flex-col p-md">
      <StudyPresence surface="kanji" contextId={payload.data.curatedKanjiId} enabled={payload.data.curatedKanjiId !== null} />
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-card">
        <KanjiInspect payload={payload} variant="page" explore={explore} />
      </div>
    </div>
  );
}
