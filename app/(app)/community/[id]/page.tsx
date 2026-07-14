import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getForumPost } from "@/lib/data/forum";
import { Container } from "@/components/ui/container";
import { ForumThread } from "@/components/community/forum-thread";

export const dynamic = "force-dynamic";

export default async function ForumPostPage({ params }: { params: { id: string } }) {
  const post = await getForumPost(params.id);
  if (!post) notFound();

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <Container className="py-8">
      <Link href="/community" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← Back to community
      </Link>

      <div className="mt-4">
        <ForumThread post={post} currentUserId={user?.id ?? null} />
      </div>
    </Container>
  );
}
