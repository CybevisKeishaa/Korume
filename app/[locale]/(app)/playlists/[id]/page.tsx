import { notFound } from "next/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { Link } from "@/lib/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPlaylist } from "@/lib/data/playlists";
import { Container } from "@/components/ui/container";
import { PlaylistDetail } from "@/components/community/playlist-detail";

export const dynamic = "force-dynamic";

export default async function PlaylistDetailPage({ params }: { params: { id: string } }) {
  const t = await getTranslations("playlists");
  const playlist = await getPlaylist(params.id);
  if (!playlist) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = user?.id !== undefined && playlist.owner?.id === user.id;

  return (
    <Container className="py-8">
      <Link href="/playlists" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        {t("detailPage.back")}
      </Link>

      <div className="mt-4">
        <PlaylistDetail playlist={playlist} isOwner={isOwner} />
      </div>
    </Container>
  );
}
