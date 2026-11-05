/**
 * Live probe: sends the Ask Korume answer schema v2 to the real Gemini model (one paid call per run).
 * Usage: npx vite-node --config vitest.config.ts scripts/probe-korume-answer.ts -- [--tier free|plus] [--runs N] [--question "..."] [--line "..."]
 * The default line is RECONSTRUCTED from spec section 7; the real line is not in the local DB.
 * Output per run: run i · ok|invalid|error · blocks · out=<outputTokens> · table=<bool> · check=<bool> (a check-style list).
 * Exits 1 if any run is an HTTP 400.
 */
import { AiError } from "@/lib/ai/errors";
import { createGeminiProvider } from "@/lib/ai/providers/gemini";
import { answerV2Schema, capBlocks, MAX_ANSWER_BLOCKS } from "@/lib/korume/answer";
import { answerPrompt } from "@/lib/korume/prompts";

process.loadEnvFile(".env.local");

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1]! : fallback;
};
const tier = arg("tier", "free");
const runs = Number(arg("runs", "1"));
const question = arg("question", "Phân tích câu này giúp mình");
const lineText = arg("line", "間違った使い方のまま、間違った発音のまま、間違った文法のまま、そのまま覚えてしまうっていうのが一番良くないんですね。");

const provider = createGeminiProvider({
  apiKey: process.env.GEMINI_API_KEY!,
  fastModel: process.env.GEMINI_MODEL_FAST!,
  deepModel: process.env.GEMINI_MODEL_DEEP!,
});
const { system, user } = answerPrompt({
  question, locale: "vi", anchor: { lineText, videoTitle: "probe" }, recent: [], retrieval: [], entities: [],
});

let http400 = false;
for (let i = 1; i <= runs; i++) {
  let status = "ok", types = "", out: number | string = "n/a", table = false, check = false;
  try {
    const res = await provider.generateStructured(
      { tier: "deep", system, messages: [{ role: "user", content: user }], maxTokens: tier === "plus" ? 4096 : 2048, reasoning: false },
      answerV2Schema,
    );
    const blocks = capBlocks(res.parsed, MAX_ANSWER_BLOCKS).blocks;
    types = blocks.map((b) => b.type).join(",");
    out = res.usage?.outputTokens ?? "n/a";
    table = blocks.some((b) => b.type === "table");
    check = blocks.some((b) => b.type === "list" && b.style === "check");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof AiError && e.kind === "invalid_output") status = "invalid";
    else {
      status = "error";
      if (/\b400\b|INVALID_ARGUMENT/.test(msg)) http400 = true;
    }
    types = msg.slice(0, 300);
  }
  console.log(`run ${i} · ${status} · blocks: ${types} · out=${out} · table=${table} · check=${check}`);
}
if (http400) process.exit(1);
