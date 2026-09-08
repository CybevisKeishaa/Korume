import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getShadowingHub } from "@/lib/data/shadowing-hub";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubShelves } from "@/components/shadowing/hub-shelves";
import { HubImportSection } from "@/components/shadowing/hub-import-section";
import { HubLibrarySection } from "@/components/shadowing/hub-library-section";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "videos" });
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const [t, tCommon, tHub, result] = await Promise.all([
    getTranslations("videos"),
    getTranslations("common"),
    getTranslations("shadowing"),
    getShadowingHub(),
  ]);
  if (!result.ok) redirect({ href: "/login", locale: await getLocale() });

  const hub = result.data;
  return (
    <TwoColumnShell railLabel={tHub("hub.railLabel")} className="py-2xl">
      <div className="space-y-2xl">
        <header>
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{tHub("hub.eyebrow")}</p>
          <h1 className="mt-xs text-title font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-sm text-body text-muted-foreground">{t("subtitle")}</p>
        </header>
        <HubImportSection used={hub.quota.used} limit={hub.quota.limit} tier={hub.quota.tier} />
        <HubLibrarySection
          items={hub.library}
          labels={{
            title: t("yourVideos"),
            readyAction: tCommon("actions.next"),
            unavailable: tHub("noTranscript.title"),
            retry: tCommon("actions.retry"),
            retryPending: t("retryPending"),
            retryFailed: t("retryFailed"),
            noThumbnail: tCommon("noThumbnail"),
          }}
        />
        <HubShelves
          featured={hub.featured}
          continueLearning={hub.continueLearning}
          recentlyAdded={hub.recentlyAdded}
          popular={hub.popular}
          recommendations={hub.recommendations}
          labels={{
            featured: tHub("hub.featured"),
            recentlyAdded: tHub("hub.recentlyAdded"),
            popular: tHub("hub.popular"),
            continueLearning: tHub("hub.continueLearning"),
            recommended: tCommon("recommendations.heading"),
            start: tHub("hub.start"),
            continue: tHub("hub.continue"),
            noThumbnail: tCommon("noThumbnail"),
          }}
        />
      </div>
    </TwoColumnShell>
  );
}
