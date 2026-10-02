import type { KnowledgeKey } from "./types";

/** The `p_key` argument of `knowledge_claim_lease`: exactly the seven key dimensions, nothing else. */
export function cacheKeyJson(key: KnowledgeKey): Record<string, string | number> {
  return {
    fingerprint: key.fingerprint,
    section: key.section,
    locale: key.locale,
    contextKey: key.contextKey,
    schemaVersion: key.schemaVersion,
    generatorVersion: key.generatorVersion,
    contentVariant: key.contentVariant,
  };
}
