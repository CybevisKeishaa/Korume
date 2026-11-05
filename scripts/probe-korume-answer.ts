/**
 * Live probe: sends the Ask Korume answer schema v2 to the real Gemini model (one paid call per run).
 * Usage: npx vite-node --config vitest.config.ts scripts/probe-korume-answer.ts -- [--tier free|plus] [--runs N] [--question "..."] [--line "..."]
 * The default line is RECONSTRUCTED from spec section 7; the real line is not in the local DB.
 * Each run is a real turn minus retrieval/DB: planner (fast, 512 tokens) -> kind (error -> explain) -> answer at that kind and tier.
 * `--line ""` = no anchor. Output per run: run i · kind · ok|invalid|error · blocks · n · out=<used>/<max> · h1 · table · check · numbered · followups.
 * Exits 1 if any run is an HTTP 400.
 */
import { AiError } from "@/lib/ai/errors";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { answerV2Schema, capBlocks, MAX_ANSWER_BLOCKS } from "@/lib/korume/answer";
import { readKnowledgeConfig } from "@/lib/knowledge/config";
import type { PlanTier } from "@/lib/knowledge/types";
import { planKind, planSchema, type AnswerKind } from "@/lib/korume/plan";
import { answerPrompt, plannerPrompt } from "@/lib/korume/prompts";

process.loadEnvFile(".env.local");

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const tier = arg("tier", "free") as PlanTier;
// turn.ts imports server-only + Supabase, so PLAN_MAX_TOKENS is repeated here.
const PLAN_MAX_TOKENS = 512;
const { maxBlocks, maxTokens } = readKnowledgeConfig(process.env).askKorumeAnswer[tier];
const runs = Number(arg("runs", "1"));
const question = arg("question", "Phân tích câu này giúp mình");
const lineText = arg("line", "間違った使い方のまま、間違った発音のまま、間違った文法のまま、そのまま覚えてしまうっていうのが一番良くないんですね。");

const provider = createGeminiProvider({
  apiKey: process.env.GEMINI_API_KEY!,
  fastModel: process.env.GEMINI_MODEL_FAST!,
  deepModel: process.env.GEMINI_MODEL_DEEP!,
});
const anchor = lineText ? { lineText, videoTitle: "probe" } : null;
const planner = plannerPrompt({ question, anchor, recent: [] });

let http400 = false;
for (let i = 1; i <= runs; i++) {
  let status = "ok", types = "", out: number | string = "n/a", kind: AnswerKind = "explain";
  let n = 0, h1 = 0, table = false, check = false, numbered = false, followups = false;
  try {
    try {
      const plan = await provider.generateStructured(
        { tier: "fast", system: planner.system, messages: [{ role: "user", content: planner.user }], maxTokens: PLAN_MAX_TOKENS, reasoning: false },
        planSchema,
      );
      kind = planKind(plan.parsed);
    } catch { /* planner failure never fails a turn: explain */ }
    const { system, user } = answerPrompt({
      question, locale: "vi", anchor, recent: [], retrieval: [], entities: [], depth: { tier, kind, maxBlocks },
    });
    const res = await provider.generateStructured(
      { tier: "deep", system, messages: [{ role: "user", content: user }], maxTokens, reasoning: false },
      answerV2Schema,
    );
    const blocks = capBlocks(res.parsed, MAX_ANSWER_BLOCKS).blocks;
    types = blocks.map((b) => b.type).join(",");
    n = blocks.length;
    out = res.usage?.outputTokens ?? "n/a";
    h1 = blocks.filter((b) => b.type === "heading" && b.level === 1).length;
    table = blocks.some((b) => b.type === "table");
    check = blocks.some((b) => b.type === "list" && b.style === "check");
    numbered = blocks.some((b) => b.type === "list" && b.style === "number");
    followups = blocks.at(-1)?.type === "followups";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof AiError && e.kind === "invalid_output") status = "invalid";
    else {
      status = "error";
      if (/400|INVALID_ARGUMENT/.test(msg)) http400 = true;
    }
    types = msg.slice(0, 300);
  }
  console.log(`run ${i} · kind=${kind} · ${status} · blocks: ${types} · n=${n} · out=${out}/${maxTokens} · h1=${h1} · table=${table} · check=${check} · numbered=${numbered} · followups=${followups}`);
}
if (http400) process.exit(1);
