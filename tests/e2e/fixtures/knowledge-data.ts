import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toFurigana } from "@/lib/japanese/furigana";
import { fingerprint } from "@/lib/knowledge/canonical";
import { contextKeyFor, SECTION_REGISTRY } from "@/lib/knowledge/registry";
import type { ContentVariant, KnowledgeSection } from "@/lib/knowledge/types";

/** Appears only in the FULL native nuance: a Free learner's network traffic must never carry it. */
export const FULL_ONLY_SENTINEL = "SENTINEL-full-only-7f3a";

export const SEEDED = {
  lite: { summary: "Seeded explanation of the fifth sentence.", literal: "Today I read the fifth sentence.", keyPoints: ["番目 makes an ordinal."] },
  native_nuance: { register: "Neutral, classroom tone.", nuance: "A plain statement of today's plan.", whenToUse: FULL_ONLY_SENTINEL, whenNotTo: "Casual chat between friends." },
  culture_notes: { notes: [{ title: "Seeded culture note", body: "Reading aloud is a common classroom routine." }] },
};

export interface KnowledgeData {
  /** Creates an active Plus subscription for this user. */
  makePlus(userId: string): Promise<void>;
  cleanup(): Promise<void>;
}

/**
 * Seeds `ready` knowledge entries for one line of the workspace lesson with the SERVICE ROLE, keyed exactly as
 * the server keys them (fingerprint of the line, the section's own context policy, schema/generator versions):
 * a full `lite`, a full `native_nuance` carrying the sentinel, and a `preview` `culture_notes`. English locale,
 * because the regression suite runs on `en`.
 *
 * The line's text gets a per-seed suffix first: every Playwright worker seeds its own lesson, and entries are
 * keyed by the sentence, not the line — with a shared text, one worker's cleanup deleted another's entries.
 */
export async function seedKnowledgeData(admin: SupabaseClient, line: { id: string; text: string; videoId: string }): Promise<KnowledgeData> {
  const text = `${line.text}${randomUUID().slice(0, 6)}`;
  const updated = await admin.from("transcript_lines").update({ text_jp: text, furigana_json: await toFurigana(text) }).eq("id", line.id);
  if (updated.error) throw updated.error;
  const parentFingerprint = fingerprint(text);
  const rows = ([
    ["lite", "full", SEEDED.lite],
    ["native_nuance", "full", SEEDED.native_nuance],
    ["culture_notes", "preview", SEEDED.culture_notes],
  ] as [KnowledgeSection, ContentVariant, unknown][]).map(([section, variant, content]) => {
    const definition = SECTION_REGISTRY[section];
    const schema = variant === "full" ? definition.schema : definition.previewSchema;
    if (!schema) throw new Error(`${section} has no ${variant} schema`);
    return {
      fingerprint: parentFingerprint,
      section,
      locale: "en",
      context_key: contextKeyFor(definition, { videoId: line.videoId, parentFingerprint }),
      schema_version: definition.schemaVersion,
      generator_version: definition.generatorVersion,
      content_variant: variant,
      status: "ready",
      content: schema.parse(content),
      model: "e2e-seed",
      provider: "none",
    };
  });
  const users: string[] = [];
  const cleanup = async () => {
    const entries = await admin.from("knowledge_entries").delete().eq("fingerprint", parentFingerprint);
    if (entries.error) throw entries.error;
    if (users.length > 0) {
      const subscriptions = await admin.from("subscriptions").delete().in("user_id", users);
      if (subscriptions.error) throw subscriptions.error;
    }
  };
  const inserted = await admin.from("knowledge_entries").insert(rows);
  if (inserted.error) throw inserted.error;
  return {
    async makePlus(userId) {
      users.push(userId);
      const { error } = await admin.from("subscriptions").upsert({ user_id: userId, plan: "premium_monthly", status: "active" }, { onConflict: "user_id" });
      if (error) throw error;
    },
    cleanup,
  };
}
