import { jlptLevelSchema, type JlptLevel } from "@/lib/validation/content";

/** The list the inspect modal was opened from (`?from=`), which ‹ › walk. */
export type KanjiContext = { kind: "level"; level: JlptLevel } | { kind: "favorites" };

export function parseKanjiContext(raw: string | null): KanjiContext | null {
  if (raw === "favorites") return { kind: "favorites" };
  const level = jlptLevelSchema.safeParse(raw?.startsWith("level:") ? raw.slice(6) : undefined);
  return level.success ? { kind: "level", level: level.data } : null;
}

export function formatKanjiContext(context: KanjiContext): string {
  return context.kind === "favorites" ? "favorites" : `level:${context.level}`;
}
