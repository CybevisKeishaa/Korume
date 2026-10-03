import type { DictionaryMatch } from "@/lib/analysis/types";
import type { ToolResult } from "./retrieval";
import type { ExposureData } from "./tools/exposure";
import type { GroundedEntity } from "./types";

const JLPT = ["N1", "N2", "N3", "N4", "N5"] as const;
const jlptLabel = (level: number | null | undefined): GroundedEntity["jlpt"] =>
  level && level >= 1 && level <= 5 ? JLPT[level - 1] : undefined;

const PARTICLE_POS = "助詞";

interface AnalysedToken { surface: string; base: string; reading: string | null; pos: string; entSeq?: number; headword?: string; gloss?: string; jlpt?: number | null }

function fromMatch(m: DictionaryMatch): GroundedEntity {
  return {
    id: `ent:${m.entSeq}`, label: m.headword, kind: "vocabulary",
    ...(m.reading ? { reading: m.reading } : {}),
    ...(m.glossEn ? { gloss: m.glossEn } : {}),
    ...(jlptLabel(m.jlpt) ? { jlpt: jlptLabel(m.jlpt) } : {}),
  };
}

/** Later facts fill gaps; they never overwrite what an earlier, richer source already said. */
function merge(into: Map<string, GroundedEntity>, entity: GroundedEntity): void {
  const seen = into.get(entity.id);
  into.set(entity.id, seen ? { ...entity, ...seen, ...(entity.seenCount !== undefined ? { seenCount: entity.seenCount, seenCapped: entity.seenCapped } : {}) } : entity);
}

/** A thread's entities across its answers (the rail, §6.3): one per id, a later turn's exposure count wins. */
export function unionGrounding(messages: readonly { grounding: GroundedEntity[] | null }[]): GroundedEntity[] {
  const byId = new Map<string, GroundedEntity>();
  for (const message of messages) for (const entity of message.grounding ?? []) merge(byId, entity);
  return [...byId.values()];
}

/**
 * The rail's entities (spec §5.4), built by the server from VALIDATED retrieval results — never from model text.
 * A context card in the answer may only reference one of these ids. A lesson link survives only to a video the
 * learner can still read.
 */
export function buildGroundedEntities(results: ToolResult[], readableVideoIds: Set<string>): GroundedEntity[] {
  const out = new Map<string, GroundedEntity>();
  for (const result of results) {
    if (result.status !== "ok" || result.data === undefined) continue;
    switch (result.tool) {
      case "dictionary_lookup":
        for (const m of (result.data as { matches: DictionaryMatch[] }).matches) merge(out, fromMatch(m));
        break;
      case "line_analysis":
        for (const t of (result.data as { tokens: AnalysedToken[] }).tokens) {
          if (t.entSeq !== undefined && t.headword) {
            merge(out, fromMatch({ entSeq: t.entSeq, headword: t.headword, reading: "", glossEn: t.gloss ?? "", jlpt: t.jlpt ?? null }));
          }
        }
        break;
      case "learner_exposure": {
        const e = result.data as ExposureData;
        if (e.seenCount === 0) break;
        const link = e.firstSeen && readableVideoIds.has(e.firstSeen.videoId) ? { lessonLink: e.firstSeen } : {};
        merge(out, {
          id: e.identity, label: e.label, kind: e.identity.startsWith("tok:") && e.pos === PARTICLE_POS ? "particle" : "vocabulary",
          ...(e.reading ? { reading: e.reading } : {}),
          seenCount: e.seenCount, seenCapped: e.capped, ...link,
        });
        break;
      }
      default:
        break;
    }
  }
  return [...out.values()];
}
