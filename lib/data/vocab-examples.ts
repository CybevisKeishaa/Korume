import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { AiError, generateExamples, isAiConfigured, type JlptLevel } from "@/lib/ai";
import { aiErrorStatus } from "@/lib/http-status";
import { shouldGenerateMoreExamples } from "@/lib/validation/vocab-examples";

const EXAMPLES_LIMIT = { limit: 5, windowMs: 60_000 };
const EXAMPLE_COLUMNS = "id, vocab_id, sentence_jp, sentence_translation, source";

export interface VocabExampleRow {
  id: string;
  vocab_id: string;
  sentence_jp: string;
  sentence_translation: string | null;
  source: "curated" | "ai_generated";
}

export type GenerateVocabExamplesResult =
  | { ok: true; data: VocabExampleRow[]; cached: boolean; model?: string }
  | { ok: false; status: 401 | 404 }
  // See PostConversationMessageResult (lib/data/conversation.ts) for why this
  // is one merged variant rather than a separate literal-429 member.
  | { ok: false; status: number; retryAfter?: number };

/**
 * Generates (or returns already-generated) AI example sentences for a vocab
 * word. Capped at `MAX_AI_EXAMPLES_PER_VOCAB` (6) — once reached, returns the
 * existing rows instead of calling Claude again (guards against unbounded
 * duplicate generations for a popular word). Inserts go through the
 * service-role client: `vocab_examples` is reference content with no
 * `authenticated` write grant.
 */
export async function generateVocabExamples(
  vocabId: string,
  levelOverride?: JlptLevel,
): Promise<GenerateVocabExamplesResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`vocab:examples:${user.id}`, EXAMPLES_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: vocab, error: vocabError } = await supabase
    .from("vocab")
    .select("id, word, reading, meaning_en, jlpt_level")
    .eq("id", vocabId)
    .maybeSingle();
  if (vocabError) throw vocabError;
  if (!vocab) return { ok: false, status: 404 };

  const vocabRow = vocab as {
    id: string;
    word: string;
    reading: string | null;
    meaning_en: string | null;
    jlpt_level: JlptLevel | null;
  };

  const { data: existingRows, error: existingError } = await supabase
    .from("vocab_examples")
    .select(EXAMPLE_COLUMNS)
    .eq("vocab_id", vocabId)
    .eq("source", "ai_generated");
  if (existingError) throw existingError;
  const existing = (existingRows as VocabExampleRow[]) ?? [];

  if (!shouldGenerateMoreExamples(existing.length)) {
    return { ok: true, data: existing, cached: true };
  }

  if (!isAiConfigured()) return { ok: false, status: 503 };

  const level = levelOverride ?? vocabRow.jlpt_level ?? "N5";

  let generated;
  try {
    generated = await generateExamples({
      word: vocabRow.word,
      reading: vocabRow.reading ?? "",
      meaning: vocabRow.meaning_en ?? "",
      level,
    });
  } catch (err) {
    if (err instanceof AiError) return { ok: false, status: aiErrorStatus(err.kind) };
    throw err;
  }

  const service = createServiceClient();
  const { data: inserted, error: insertError } = await service
    .from("vocab_examples")
    .insert(
      generated.examples.map((example) => ({
        vocab_id: vocabId,
        sentence_jp: example.sentenceJp,
        sentence_translation: example.sentenceTranslation,
        source: "ai_generated" as const,
      })),
    )
    .select(EXAMPLE_COLUMNS);
  if (insertError) throw insertError;

  return {
    ok: true,
    data: [...existing, ...((inserted as VocabExampleRow[]) ?? [])],
    cached: false,
    model: generated.model,
  };
}
