import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getLearningPaths } from "@/lib/data/collections";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubPathShelf } from "@/components/shadowing/hub-path-shelf";
import { pathCardLabels, pathCards } from "../path-card-copy";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "pronunciation" });
  return { title: t("hub.paths.pageTitle") };
}

export const dynamic = "force-dynamic";

/** "View all" for Popular Learning Paths: the learner's saved paths, then every path. */
export default async function LearningPathsPage() {
  const [t, { paths }] = await Promise.all([getTranslations("pronunciation"), getLearningPaths()]);
  const labels = pathCardLabels(t);

  return (
    <TwoColumnShell railLabel={t("hub.paths.pageTitle")} className="py-2xl">
      <Link href="/pronunciation" className="text-body text-primary-strong hover:underline">{t("hub.backToPronunciation")}</Link>
      <header className="mt-md">
        <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{t("hub.paths.pageEyebrow")}</p>
        <h1 className="mt-xs text-title font-semibold text-foreground">{t("hub.paths.pageTitle")}</h1>
        <p className="mt-sm text-body text-muted-foreground">{t("hub.paths.pageSubtitle")}</p>
      </header>
      <div className="mt-2xl space-y-3xl">
        <HubPathShelf
          title={t("hub.paths.saved")}
          paths={pathCards(paths.filter((path) => path.saved), t)}
          labels={labels}
          empty={{ title: t("hub.paths.savedEmptyTitle"), body: t("hub.paths.savedEmptyBody") }}
        />
        <HubPathShelf
          title={t("hub.paths.all")}
          paths={pathCards(paths, t)}
          labels={labels}
          empty={{ title: t("hub.paths.emptyTitle"), body: t("hub.paths.emptyBody") }}
        />
      </div>
    </TwoColumnShell>
  );
}
