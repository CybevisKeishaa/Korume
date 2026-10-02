import { createHash } from "node:crypto";

/**
 * Conservative canonical form (spec §4.2): NFKC, line endings, trim, collapsed whitespace. Lexical text,
 * particles and ALL punctuation stay — `？`, `！` and `…` change the tone a learner is asking about.
 */
export function canonicalizeSentence(text: string): string {
  return text.normalize("NFKC").replace(/\r\n?/g, "\n").trim().replace(/\s+/g, " ");
}

export function fingerprint(text: string): string {
  return createHash("sha256").update(canonicalizeSentence(text), "utf8").digest("hex");
}
