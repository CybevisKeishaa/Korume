import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";
import { fingerprint } from "@/lib/knowledge/canonical";
import { SECTION_REGISTRY } from "@/lib/knowledge/registry";
import { KNOWLEDGE_SECTIONS } from "@/lib/knowledge/types";

/**
 * LIVE AI — spends real money (plan Task 15 step 5). Never part of a normal run: it skips unless
 * LIVE_AI_CONFIRM=1, and the server must run with a real provider (AI_PROVIDER=anthropic + its key):
 *
 *   AI_PROVIDER=anthropic npx next start -p 3000            (in the worktree, after a build)
 *   LIVE_AI_CONFIRM=1 npx playwright test tests/e2e/knowledge.live-ai.spec.ts --workers=1
 *
 * A Plus learner requests all nine sections for a sentence no cache can hold (a run id inside it). Each must
 * leave a NEW ai_generations row for its entry — created after the test started, the expected provider,
 * success, real token counts and a real cost — and a ready entry that validates against its own schema.
 */
const PROVIDER = process.env.LIVE_AI_EXPECT_PROVIDER ?? "anthropic";
test.skip(process.env.LIVE_AI_CONFIRM !== "1", "LIVE AI spends real money: set LIVE_AI_CONFIRM=1 to run it");
test.setTimeout(10 * 60_000);

let data: WorkspaceData;
let plusUserId: string | undefined;
let text: string;
test.beforeAll(async () => {
  data = await seedWorkspaceData();
  text = `明日の朝、駅の前で友達と待ち合わせをします。${randomUUID().slice(0, 8)}`;
  const { error } = await data.admin.from("transcript_lines").update({ text_jp: text }).eq("id", data.lineIds[0]!);
  if (error) throw error;
});
test.afterAll(async () => {
  // Spent money stays on record: ai_generations rows are kept; the run's entries and subscription go.
  await data?.admin.from("knowledge_entries").delete().eq("fingerprint", fingerprint(text));
  if (plusUserId) await data.admin.from("subscriptions").delete().eq("user_id", plusUserId);
  await data?.cleanup();
});

async function requestUntilReady(request: APIRequestContext, section: string, lineId: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await request.post("/api/knowledge/sections", { data: { transcriptLineId: lineId, section, locale: "en" } });
    if (response.status() === 202) {
      const body = await response.json() as { data: { retryAfterMs: number } };
      await new Promise((resolve) => setTimeout(resolve, body.data.retryAfterMs));
      continue;
    }
    return response;
  }
  throw new Error(`${section} never became ready`);
}

test("nine sections, each a real paid generation with a ledger row", async ({ page }) => {
  // The database's own clock: the lesson was seeded just before this test, so every generation must be later.
  const started = await data.admin.from("videos").select("created_at").eq("id", data.videoId).single();
  if (started.error) throw started.error;
  const testStartedAt = started.data.created_at as string;
  await page.goto("/en/register");
  const email = uniqueEmail("e2e_live_ai");
  await registerViaUi(page, { name: "Live AI", email, password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
  plusUserId = await data.userIdByEmail(email);
  const plus = await data.admin.from("subscriptions").upsert({ user_id: plusUserId, plan: "premium_monthly", status: "active" }, { onConflict: "user_id" });
  if (plus.error) throw plus.error;

  const report: Record<string, unknown>[] = [];
  for (const section of KNOWLEDGE_SECTIONS) {
    const response = await requestUntilReady(page.request, section, data.lineIds[0]!);
    expect(response.status(), section).toBe(200);
    const body = await response.json() as { data: { status: string; access: string } };
    expect(body.data, section).toMatchObject({ status: "ready", access: "full" });

    const definition = SECTION_REGISTRY[section];
    const entry = await data.admin.from("knowledge_entries")
      .select("id, content, status")
      .eq("fingerprint", fingerprint(text)).eq("section", section).eq("locale", "en").eq("content_variant", "full")
      .single();
    if (entry.error) throw entry.error;
    expect(entry.data.status, section).toBe("ready");
    expect(() => definition.schema.parse(entry.data.content), section).not.toThrow();

    const generations = await data.admin.from("ai_generations")
      .select("provider, model, outcome, input_tokens, output_tokens, estimated_cost_usd, created_at")
      .eq("knowledge_entry_id", entry.data.id).gte("created_at", testStartedAt);
    if (generations.error) throw generations.error;
    expect(generations.data, section).toHaveLength(1);
    const row = generations.data[0]!;
    expect(row.provider, section).toBe(PROVIDER);
    expect(row.outcome, section).toBe("success");
    expect(row.input_tokens, section).toBeGreaterThan(0);
    expect(row.output_tokens, section).toBeGreaterThan(0);
    expect(Number(row.estimated_cost_usd), section).toBeGreaterThan(0);
    report.push({ section, model: row.model, input: row.input_tokens, output: row.output_tokens, usd: Number(row.estimated_cost_usd) });
  }
  // eslint-disable-next-line no-console -- the run state records these numbers.
  console.log("LIVE AI COST", JSON.stringify(report));
});
