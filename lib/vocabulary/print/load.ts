import "server-only";
import { cache } from "react";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { authenticateSummary } from "@/lib/summary/load-snapshot";
import { resolveLessonSource } from "./lesson-source";
import type { PrintSource, PrintSourceResult } from "./source";

/** One load per request: `generateMetadata` and the page share it. The user id always comes from the session. */
export const loadPrintDocument = cache(async (source: PrintSource, locale: KnowledgeLocale): Promise<PrintSourceResult> => {
  const auth = await authenticateSummary();
  if (!auth) return { kind: "unauthorized" };
  switch (source.kind) {
    case "lesson": return resolveLessonSource({ source, locale, userId: auth.userId, db: auth.supabase });
  }
});
