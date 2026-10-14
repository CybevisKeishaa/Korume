import type { Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "../fixtures/auth";
import { seedDashboardData, seedDashboardWorkspaceData } from "../fixtures/dashboard-data";
import { seedPrintLesson } from "../fixtures/print-data";
import type { WorkspaceData } from "../fixtures/workspace-data";

export interface Learner {
  lesson: WorkspaceData;
  userId: string;
  ids: { forumPost: string; playlist: string; printLesson: string };
  cleanup(): Promise<void>;
}

/**
 * Spec P2: one learner with enough data for every P1 route, signed in on `page`'s context. Registers through
 * the UI in `en` (the fixture's labels are English); the session cookie is locale-independent, so the caller
 * then visits `/vi/...`.
 */
export async function seedLearner(page: Page): Promise<Learner> {
  const lesson = await seedDashboardWorkspaceData();
  let userId: string | undefined;
  let evidence: { cleanup(): Promise<void> } | undefined;
  const removeUser = async () => {
    if (!userId) return;
    await lesson.admin.from("forum_posts").delete().eq("user_id", userId);
    await lesson.admin.from("user_playlists").delete().eq("user_id", userId);
    const deleted = await lesson.admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
  };
  try {
    const email = uniqueEmail("e2e_typography");
    await page.goto("/en/register");
    await registerViaUi(page, { name: "Typography Learner", email, password: "password123" });
    await page.waitForURL(/\/en\/dashboard$/, { timeout: 15_000 });
    userId = await lesson.userIdByEmail(email);
    // Pause prefetch while seeding: a dashboard render must not freeze a half-seeded mission cycle.
    await page.goto("about:blank");
    evidence = await seedDashboardData(lesson.admin, userId, lesson);
    const post = await lesson.admin.from("forum_posts")
      .insert({ user_id: userId, title: "Bài viết đo chữ", content: "Một đoạn để đo chữ. 日本語の文です。" })
      .select("id").single();
    if (post.error) throw post.error;
    const playlist = await lesson.admin.from("user_playlists")
      .insert({ user_id: userId, name: "Danh sách đo chữ" }).select("id").single();
    if (playlist.error) throw playlist.error;
    const print = await seedPrintLesson(lesson.admin, lesson.prefix);
    const ids = { forumPost: post.data.id as string, playlist: playlist.data.id as string, printLesson: print.videoId };
    const id = userId;
    return {
      lesson, userId: id, ids,
      cleanup: async () => { await evidence?.cleanup(); await removeUser(); await lesson.cleanup(); },
    };
  } catch (error) {
    await evidence?.cleanup();
    await removeUser();
    await lesson.cleanup();
    throw error;
  }
}
