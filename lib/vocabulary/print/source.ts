import { z } from "zod";
import type { MeaningLocale, MeaningSource } from "@/lib/analysis/meaning";

/** Spec §2.2: the workspace knows only these types — never a lesson, a mining card or Summary. */
export type PrintSet = "all" | "saved";
export type PrintSource = { kind: "lesson"; lessonId: string; set: PrintSet };

export interface VocabularyPrintItem {
  /** Stable within the source: the lexical identity, or the saved word's identity when raw. */
  id: string;
  surface: string;
  reading?: string;
  meaning?: string;
  meaningLocale?: MeaningLocale;
  meaningSource?: MeaningSource;
  resolution: "resolved" | "saved_raw";
  example?: { text: string; sourceLabel?: string };
}

export interface PrintDocument {
  title: string;
  backHref: string;
  backLabel: string;
  items: VocabularyPrintItem[];
}

export type PrintSourceResult = { kind: "ok"; doc: PrintDocument } | { kind: "not_found" } | { kind: "unauthorized" };

const querySchema = z.object({
  source: z.literal("lesson"),
  lesson: z.string().uuid(),
  set: z.enum(["all", "saved"]).default("all"),
});

export function parsePrintQuery(searchParams: Record<string, string | string[] | undefined>): PrintSource | null {
  const parsed = querySchema.safeParse(searchParams);
  return parsed.success ? { kind: "lesson", lessonId: parsed.data.lesson, set: parsed.data.set } : null;
}
