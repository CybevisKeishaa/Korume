import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

/**
 * Search data for the pronunciation search e2e spec. The seed holds two
 * lessons, far too few to page or to fill a preview row, so this inserts its
 * own under a unique prefix with the SERVICE ROLE — in the test process only,
 * never in a browser bundle — and deletes it by that prefix afterwards.
 */
export async function seedSearchData(lessonCount = 30): Promise<{ prefix: string; cleanup(): Promise<void> }> {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("seedSearchData needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const prefix = `e2e-search-${randomUUID().slice(0, 8)}`;

  const cleanup = async () => {
    // Collections first: their memberships cascade, then the lessons can go.
    const collections = await admin.from("collections").delete().like("slug", `${prefix}%`);
    const videos = await admin.from("videos").delete().like("youtube_video_id", `${prefix}%`);
    if (collections.error) throw collections.error;
    if (videos.error) throw videos.error;
  };

  try {
    const { data: videos, error: videoError } = await admin.from("videos").insert(
      Array.from({ length: lessonCount }, (_, index) => ({
        youtube_video_id: `${prefix}-${index}`,
        title: `${prefix} Ramen ${String(index + 1).padStart(2, "0")}`,
        library_access: "FREE",
        duration_seconds: 120 + index * 30,
      })),
    ).select("id");
    if (videoError) throw videoError;

    const { data: path, error: pathError } = await admin.from("collections")
      .insert({ slug: `${prefix}-path`, title: `${prefix} Ramen Path`, kind: "path", display_order: 990 })
      .select("id").single();
    if (pathError) throw pathError;

    const { error: memberError } = await admin.from("lesson_collections")
      .insert({ collection_id: path.id, lesson_id: videos[0]!.id, position: 0 });
    if (memberError) throw memberError;
  } catch (error) {
    await cleanup();
    throw error;
  }

  return { prefix, cleanup };
}
