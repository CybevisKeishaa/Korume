import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { getShadowingHub } from "@/lib/data/shadowing-hub";
import { TwoColumnShell } from "@/components/layout/two-column-shell";
import { HubShelves } from "@/components/shadowing/hub-shelves";
import { VideoImportForm } from "@/components/video/video-import-form";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "videos" });
  return { title: t("title") };
}

export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const [t, tCommon, result] = await Promise.all([
    getTranslations("videos"),
    getTranslations("common"),
    getShadowingHub(),
  ]);
  if (!result.ok) redirect({ href: "/login", locale: await getLocale() });

  const hub = result.data;
  return (
    <TwoColumnShell railLabel="Companion" className="py-2xl">
      <div className="space-y-2xl">
        <header>
          <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">Shadowing</p>
          <h1 className="mt-xs text-title font-semibold text-foreground">{t("title")}</h1>
          <p className="mt-sm text-body text-muted-foreground">{t("subtitle")}</p>
        </header>
        <section aria-label={t("import")} className="rounded-xl border border-border bg-card p-md-lg">
          <VideoImportForm />
        </section>
        <HubShelves
          featured={hub.featured}
          continueLearning={hub.continueLearning}
          recentlyAdded={hub.recentlyAdded}
          popular={hub.popular}
          recommendations={hub.recommendations}
          labels={{
            featured: "Featured",
            recentlyAdded: "Recently added",
            popular: "Popular",
            continueLearning: "Continue learning",
            recommended: tCommon("recommendations.heading"),
            start: "Start",
            continue: "Continue",
            noThumbnail: tCommon("noThumbnail"),
          }}
        />
      </div>
    </TwoColumnShell>
  );
}
