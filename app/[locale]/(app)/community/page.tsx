import { getTranslations } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { listForumPosts } from "@/lib/data/forum";
import { Container } from "@/components/ui/container";
import { CommunityTabs } from "@/components/community/community-tabs";
import { ForumBoard } from "@/components/community/forum-board";

export const metadata = { title: "Community" };
export const dynamic = "force-dynamic";

export default async function CommunityPage() {
  const t = await getTranslations("community");
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const initialPage = await listForumPosts({ limit: 20 });

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold">{t("page.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("page.subtitle")}</p>

      <div className="mt-6">
        <CommunityTabs />
      </div>

      <div className="mt-6">
        {user ? <ForumBoard initialPage={initialPage} /> : <p className="text-sm text-muted-foreground">{t("page.signInPrompt")}</p>}
      </div>
    </Container>
  );
}
