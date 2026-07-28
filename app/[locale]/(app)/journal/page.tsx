import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { listJournal, recordFirstMeeting } from "@/lib/data/companion";
import { JournalView } from "@/components/companion/journal-view";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "companion" });
  return { title: t("journal.metaTitle") };
}
export const dynamic = "force-dynamic";

export default async function JournalPage() {
  // ONE auth round-trip for the whole render: the guard, the first-meeting
  // capture and the read all share this resolved pair. Going through
  // `getJournal()` (which resolves the caller itself) would cost a second
  // `supabase.auth.getUser()` on every open for no added safety.
  const supabase = createClient();
  const user = await requireUser(supabase);
  // The (app) layout already redirects signed-out visitors; this is defence in
  // depth, exactly as on the videos page.
  if (!user) redirect({ href: "/login", locale: await getLocale() });

  // Opening the Journal IS the first-meeting domain event (spec D8):
  // idempotent and best-effort — the first open writes the first page, and a
  // failure here can only mean it appears on the next open, never a blank page.
  await recordFirstMeeting({ supabase, user });

  // Owner-scoped client, so RLS returns only this learner's memories (§12.4),
  // already ordered newest-first by `occurred_at`.
  const memories = await listJournal(supabase, user.id);

  return <JournalView memories={memories} />;
}
