import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { listPlaylists, listPublicPlaylists } from "@/lib/data/playlists";
import { Container } from "@/components/ui/container";
import { PlaylistsPage as PlaylistsPageView } from "@/components/community/playlists-page";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "playlists" });
  return { title: t("page.heading") };
}
export const dynamic = "force-dynamic";

export default async function PlaylistsRoutePage() {
  const t = await getTranslations("playlists");
  const [mineResult, publicPage] = await Promise.all([listPlaylists(), listPublicPlaylists({ limit: 20 })]);

  const initialMine = mineResult.ok ? mineResult.data : [];

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold">{t("page.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("page.subtitle")}</p>

      <div className="mt-6">
        <PlaylistsPageView initialMine={initialMine} initialPublic={publicPage} />
      </div>
    </Container>
  );
}
