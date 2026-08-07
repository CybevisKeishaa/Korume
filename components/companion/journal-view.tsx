"use client";

import { useFormatter, useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { memoryTitleFor, refFromDedupeKey, type CompanionMemory } from "@/lib/companion";
import { CompanionAnchor } from "./companion-anchor";

/**
 * The market is VN-only and the app already treats one fixed offset as "the"
 * user timezone (`vnDateString`, lib/gamification/streak.ts) — a memory dated
 * "yesterday" on the streak card must not read as "today" here.
 *
 * Passing it explicitly is also required, not cosmetic: there is no global
 * `timeZone` in `lib/i18n/request.ts`, so next-intl would fall back to the
 * ENVIRONMENT's zone — the server's on the first paint, the browser's after
 * hydration — which raises an `ENVIRONMENT_FALLBACK` IntlError and can render
 * two different dates for the same instant.
 */
const VN_TIME_ZONE = "Asia/Ho_Chi_Minh";

/**
 * The one title a memory shows, in the reader's own locale.
 *
 * A GIFTED memory's title is the learner's own words — rendered verbatim,
 * never translated and never replaced by a descriptor (spec §4.4). A
 * DISCOVERED memory stores no title at all: `memoryTitleFor` maps its type
 * (plus whatever ICU values survive in the dedupe key) to a catalog
 * descriptor, resolved here at READ time. A gifted pin the learner left
 * untitled has neither, and falls back to `journal.untitledGifted` —
 * `memoryTitleFor` returns null for `pinned_line` by design.
 *
 * `t` is passed in rather than called here because a hook can't be called
 * outside a component (same shape as `scenarioLabel`).
 */
function resolvedTitle(
  m: CompanionMemory,
  t: ReturnType<typeof useTranslations<"companion">>,
): string {
  if (m.title) return m.title;
  const descriptor = memoryTitleFor(m.memoryType, refFromDedupeKey(m.memoryType, m.dedupeKey));
  // The descriptor's key is a runtime string (it is built per memory type and,
  // for `companion_grew`, per phase), so it needs the cast the typed catalog
  // otherwise forbids — the keys themselves are pinned by
  // `messages/en/companion.pin.test.ts`.
  if (descriptor) return t(descriptor.key as Parameters<typeof t>[0], descriptor.values);
  return t("journal.untitledGifted");
}

/**
 * The learner's book (spec §5) — a keepsake, never a log. It renders exactly
 * what it is handed, in the order it is handed: `listJournal` already sorts by
 * `occurred_at`, and re-sorting here by anything else (recency of capture,
 * anchor-first, type) would quietly editorialize the learner's own history.
 */
export function JournalView({ memories }: { memories: CompanionMemory[] }) {
  const t = useTranslations("companion");
  const format = useFormatter();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard"
        className="mb-lg inline-flex items-center gap-2xs text-caption text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true">←</span> {t("backToDashboard")}
      </Link>
      <header className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">{t("journal.title")}</h1>
        {/* The Journal is where the Companion belongs: a reflective surface,
            never a learning loop (spec 1 §5.4). */}
        <CompanionAnchor surface="journal" pose="reading" />
      </header>

      {memories.length === 0 ? (
        // D9: looks forward, never apologizes for the empty present.
        <p className="mt-8 text-muted-foreground">{t("journal.empty")}</p>
      ) : (
        <ol className="mt-8 space-y-6">
          {memories.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-4">
              <p className="font-medium">{resolvedTitle(m, t)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {format.dateTime(new Date(m.occurredAt), {
                  dateStyle: "long",
                  timeZone: VN_TIME_ZONE,
                })}
                {/* Provenance is carried visually by the ✎ mark, which is
                    decorative — assistive tech gets the words instead. */}
                <span className="sr-only">
                  {m.kind === "gifted" ? t("journal.giftedMarker") : t("journal.discoveredMarker")}
                </span>
                {m.kind === "gifted" ? <span aria-hidden="true"> ✎</span> : null}
              </p>
              {m.lineTextJp ? <p className="mt-2 font-jp">{m.lineTextJp}</p> : null}
              {m.note ? <p className="mt-2 text-sm">{m.note}</p> : null}
              {m.videoId && m.transcriptLineId ? (
                <Link
                  href={`/shadowing/${m.videoId}?line=${m.transcriptLineId}`}
                  className="mt-3 inline-block text-sm text-primary underline"
                >
                  {t("journal.returnToMoment")}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
