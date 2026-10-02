import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveSnapshotId, getDictionaryAttribution } from "@/lib/dictionary/snapshot";
import { fingerprint } from "@/lib/knowledge/canonical";
import { getOrGenerateSection, readCachedSection, type GenerateDeps } from "@/lib/knowledge/orchestrator";
import { SECTION_REGISTRY, contextKeyFor } from "@/lib/knowledge/registry";
import type { GlossDto } from "@/lib/analysis/types";

const READ_LIMIT = { limit: 60, windowMs: 60_000 };
const GENERATE_LIMIT = { limit: 20, windowMs: 60_000 };
/** The card glosses the first sense; the key names it, so a reordered JMdict sense never serves an old gloss. */
const SENSE_INDEX = 0;

interface EntryForGloss {
  entSeq: number;
  headword: string;
  reading: string;
  glossesEn: string[];
  /** `${ent_seq}:${sense}:${jmdict version}` — the gloss cache's context dimension (spec §4.2). */
  senseKey: string;
}

type Refusal = { kind: "unauthorized" } | { kind: "rate_limited"; retryAfter: number } | { kind: "not_found" };
export type GlossResult = Refusal | { kind: "unavailable" } | { kind: "ok"; gloss: GlossDto };

async function entryForGloss(supabase: ReturnType<typeof createClient>, entSeq: number): Promise<EntryForGloss | null> {
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return null;
  const { data, error } = await supabase
    .from("dict_entries")
    .select("ent_seq, kanji_forms, kana_forms, senses")
    .eq("snapshot_id", snapshotId)
    .eq("ent_seq", entSeq)
    .maybeSingle();
  if (error) throw error;
  const row = data as { ent_seq: number; kanji_forms: string[]; kana_forms: string[]; senses: { gloss?: string[] }[] } | null;
  if (!row) return null;
  const jmdict = (await getDictionaryAttribution(snapshotId)).find((source) => source.source === "jmdict");
  return {
    entSeq: row.ent_seq,
    headword: row.kanji_forms[0] ?? row.kana_forms[0] ?? "",
    reading: row.kana_forms[0] ?? "",
    glossesEn: row.senses[SENSE_INDEX]?.gloss ?? [],
    senseKey: `${row.ent_seq}:${SENSE_INDEX}:${jmdict?.version ?? snapshotId}`,
  };
}

/** A hand-written Vietnamese meaning from `vocab` always wins over a generated one. */
async function curatedGloss(supabase: ReturnType<typeof createClient>, entry: EntryForGloss): Promise<GlossDto | null> {
  const { data, error } = await supabase
    .from("vocab")
    .select("meaning_vi, reading")
    .eq("word", entry.headword)
    .order("id", { ascending: true })
    .limit(5);
  if (error) throw error;
  const rows = (data ?? []) as { meaning_vi: string | null; reading: string | null }[];
  const match = rows.find((row) => row.meaning_vi && (!row.reading || row.reading === entry.reading));
  if (!match?.meaning_vi) return null;
  const glossesVi = match.meaning_vi.split(/[;,、；]/).map((gloss) => gloss.trim()).filter(Boolean);
  return { entSeq: entry.entSeq, status: "ready", glossesVi, note: null, source: "vocab" };
}

function glossSection(entry: EntryForGloss) {
  const definition = SECTION_REGISTRY.word_gloss_vi;
  return {
    definition,
    locale: "vi" as const,
    targetText: entry.headword,
    contextKey: contextKeyFor(definition, { videoId: null, parentFingerprint: null, senseKey: entry.senseKey }),
    // System-funded: the tier never changes the variant of a system section.
    tier: "free" as const,
  };
}

function fromContent(entSeq: number, content: unknown): GlossDto {
  const gloss = content as { glosses?: string[]; note?: string };
  return { entSeq, status: "ready", glossesVi: [...(gloss.glosses ?? [])], note: gloss.note || null, source: "ai" };
}

type Prelude =
  | { refusal: Refusal }
  | { refusal?: never; supabase: ReturnType<typeof createClient>; userId: string; entry: EntryForGloss };

async function prelude(limit: { limit: number; windowMs: number }, key: string, entSeq: number): Promise<Prelude> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { refusal: { kind: "unauthorized" } };
  const limited = rateLimit(`${key}:${user.id}`, limit);
  if (!limited.ok) return { refusal: { kind: "rate_limited", retryAfter: limited.retryAfter } };
  const entry = await entryForGloss(supabase, entSeq);
  if (!entry) return { refusal: { kind: "not_found" } };
  return { supabase, userId: user.id, entry };
}

/** GET /api/dictionary/gloss: the curated or cached Vietnamese gloss, else `missing`. No side effect. */
export async function getGloss(entSeq: number, deps: Pick<GenerateDeps, "store"> = {}): Promise<GlossResult> {
  const ready = await prelude(READ_LIMIT, "dictionary:gloss:read", entSeq);
  if (ready.refusal) return ready.refusal;
  const curated = await curatedGloss(ready.supabase, ready.entry);
  if (curated) return { kind: "ok", gloss: curated };
  const cached = await readCachedSection(glossSection(ready.entry), deps);
  return {
    kind: "ok",
    gloss: cached ? fromContent(entSeq, cached.content) : { entSeq, status: "missing", glossesVi: [], note: null, source: null },
  };
}

/**
 * POST /api/dictionary/gloss: a system-funded `word_gloss_vi` generation, recorded against the requester but
 * never against their entitlement; the global budget still applies (spec §5.2).
 */
export async function requestGloss(entSeq: number, deps: GenerateDeps = {}): Promise<GlossResult> {
  const ready = await prelude(GENERATE_LIMIT, "dictionary:gloss:generate", entSeq);
  if (ready.refusal) return ready.refusal;
  const { entry, userId } = ready;
  const curated = await curatedGloss(ready.supabase, entry);
  if (curated) return { kind: "ok", gloss: curated };
  const outcome = await getOrGenerateSection({
    ...glossSection(entry),
    parentFingerprint: fingerprint(entry.headword),
    billing: { scope: "system", userId },
    promptInput: { sentence: entry.headword, locale: "vi", headword: entry.headword, reading: entry.reading, senseGlossesEn: entry.glossesEn },
  }, deps);
  if (outcome.status === "ready") return { kind: "ok", gloss: fromContent(entSeq, outcome.content) };
  if (outcome.status === "pending") return { kind: "ok", gloss: { entSeq, status: "pending", glossesVi: [], note: null, source: null } };
  return { kind: "unavailable" };
}
