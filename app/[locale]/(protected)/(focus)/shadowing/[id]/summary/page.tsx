import { notFound } from "next/navigation";
import { toSummaryProps } from "@/components/lesson-summary/props";
import { SummaryPage } from "@/components/lesson-summary/summary-page";
import { redirect } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";
import { loadLessonSummary } from "@/lib/summary/load-snapshot";
import { getSummaryNavigation } from "@/lib/summary/navigation";

export const dynamic = "force-dynamic";

/** `/shadowing/[id]/summary` (spec §7.1): outside the workspace route group, so no workspace context is mounted. */
export default async function LessonSummaryRoute({ params }: { params: { locale: Locale; id: string } }) {
  const result = await loadLessonSummary(params.id);
  if (!result.ok) {
    if (result.status === 401) redirect({ href: "/login", locale: params.locale });
    notFound();
  }
  const navigation = await getSummaryNavigation(params.id, result.data.lines);
  return <SummaryPage {...toSummaryProps(result.data, navigation)} locale={params.locale} />;
}
