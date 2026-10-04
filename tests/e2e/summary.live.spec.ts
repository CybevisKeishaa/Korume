import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";
import type { AnalysisResponse } from "@/lib/summary/analysis/view";
import type { ReflectionResponse } from "@/lib/summary/reflection/view";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedSummaryEvidence } from "./fixtures/summary-data";

/** Opt-in, real Gemini on the locally seeded Ep.729 lesson. Evidence rows are synthetic. */
test.skip(process.env.SUMMARY_LIVE !== "1", "set SUMMARY_LIVE=1 for the live Gemini smoke");
test.setTimeout(300_000);
loadEnvConfig(process.cwd());
const videoId = process.env.EP729_VIDEO_ID;
const youtubeId = "Fwj3tH4Uls8";
let admin: SupabaseClient;
let lineIds: string[];
const lines = new Map<string, string>();

test.beforeAll(async () => {
  if (!videoId) throw new Error("seed Ep.729 and set EP729_VIDEO_ID");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url)) throw new Error("live smoke needs local Supabase service credentials");
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const video = await admin.from("videos").select("youtube_video_id").eq("id", videoId).single();
  if (video.error || video.data.youtube_video_id !== youtubeId) throw new Error("EP729_VIDEO_ID is not the seeded Ep.729");
  const transcript = await admin.from("transcripts").select("id").eq("video_id", videoId).single();
  if (transcript.error) throw transcript.error;
  const rows = await admin.from("transcript_lines").select("id, text_jp")
    .eq("transcript_id", transcript.data.id).order("start_time").order("id");
  if (rows.error) throw rows.error;
  lineIds = rows.data.map((row) => row.id);
  if (lineIds.length < 4) throw new Error("Ep.729 needs four lines for evidence");
  for (const row of rows.data) lines.set(row.id, row.text_jp);
});

async function generationCount(section: "lesson_analysis" | "lesson_reflection"): Promise<number> {
  const result = await admin.from("ai_generations").select("id", { count: "exact", head: true }).eq("section", section);
  if (result.error) throw result.error;
  return result.count ?? 0;
}

async function registeredPage(browser: Browser, locale: "vi" | "en", name: string): Promise<{ page: Page; userId: string; close(): Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = uniqueEmail(`e2e_summary_live_${name}`);
  await page.goto("/en/register");
  await registerViaUi(page, { name: `Summary ${name}`, email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 20_000 });
  const user = await admin.from("users").select("id").eq("email", email).single();
  if (user.error) throw user.error;
  await page.goto(`/${locale}/shadowing/${videoId}/summary`);
  return { page, userId: user.data.id, close: () => context.close() };
}

function collectBodies(page: Page): { analyses: AnalysisResponse[]; reflections: ReflectionResponse[] } {
  const analyses: AnalysisResponse[] = [];
  const reflections: ReflectionResponse[] = [];
  page.on("response", (response) => {
    if (!response.url().includes("lesson-analysis") && !response.url().includes("lesson-reflection")) return;
    void response.json().then((body: AnalysisResponse | ReflectionResponse) => {
      if (response.url().includes("lesson-analysis")) analyses.push(body as AnalysisResponse);
      else reflections.push(body as ReflectionResponse);
    }).catch(() => undefined);
  });
  return { analyses, reflections };
}

test("Ep.729: vi then en analysis is grounded and shared while reflections stay per learner", async ({ browser }) => {
  for (const locale of ["vi", "en"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const bodies = collectBodies(page);
    const email = uniqueEmail(`e2e_summary_live_a_${locale}`);
    await page.goto("/en/register");
    await registerViaUi(page, { name: "Summary A", email, password: "password123" });
    await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 20_000 });
    const user = await admin.from("users").select("id").eq("email", email).single();
    if (user.error) throw user.error;
    const seeded = await seedSummaryEvidence(admin, { userId: user.data.id, videoId: videoId!, lineIds });
    try {
      await page.goto(`/${locale}/shadowing/${videoId}/summary`);
      await expect.poll(() => bodies.analyses.find((body) => body.status === "ready"), { timeout: 90_000, intervals: [1_000] }).toBeTruthy();
      const ready = bodies.analyses.find((body) => body.status === "ready");
      if (!ready || ready.status !== "ready") throw new Error("analysis never reached ready");
      expect(ready.data.words.length).toBeGreaterThan(0);
      for (const word of ready.data.words) {
        const text = lines.get(word.source.lineId);
        expect(text).toBeTruthy();
        expect(text).toContain(word.surface);
      }
      for (const expression of ready.data.expressions) {
        const text = lines.get(expression.source.lineId);
        expect(text).toBeTruthy();
        expect(text).toContain(expression.expression);
      }
      await expect.poll(() => bodies.reflections.some((body) => body.state === "ready"), { timeout: 90_000, intervals: [1_000] }).toBe(true);
      const analysisBefore = await generationCount("lesson_analysis");
      await page.reload();
      await expect(page.locator('[data-summary-area="words"] li').first()).toBeVisible();
      expect(await generationCount("lesson_analysis")).toBe(analysisBefore);

      const reflectionBefore = await generationCount("lesson_reflection");
      const b = await registeredPage(browser, locale, `b_${locale}`);
      const bSeeded = await seedSummaryEvidence(admin, { userId: b.userId, videoId: videoId!, lineIds });
      try {
        const bBodies = collectBodies(b.page);
        await b.page.reload();
        await expect.poll(() => bBodies.reflections.some((body) => body.state === "ready"), { timeout: 90_000, intervals: [1_000] }).toBe(true);
        expect(await generationCount("lesson_analysis")).toBe(analysisBefore);
        expect(await generationCount("lesson_reflection")).toBe(reflectionBefore + 1);
      } finally {
        await bSeeded.cleanup();
        await b.close();
      }
    } finally {
      await seeded.cleanup();
      await context.close();
    }
  }
});
