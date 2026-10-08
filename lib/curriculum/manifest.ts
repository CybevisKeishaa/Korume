import { JLPT_LEVELS, type JlptLevel } from "@/lib/conversation-types";

export const CURRICULUM_LEVELS = JLPT_LEVELS;
export const FIXTURE_ID = /^(e2e_|demo\d+$|demo-)/;
/** A real YouTube video id: 11 characters of the URL-safe base64 alphabet. */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function validateCurriculumManifest(manifest: Record<string, readonly string[]>): string[] {
  const errors: string[] = [];
  const levelsByLesson = new Map<string, JlptLevel>();

  for (const level of CURRICULUM_LEVELS) {
    const ids = manifest[level] ?? [];
    const seen = new Set<string>();

    for (const id of ids) {
      if (seen.has(id)) errors.push(`${level} lists ${id} twice`);
      seen.add(id);

      if (FIXTURE_ID.test(id)) errors.push(`${level}: ${id} is a fixture id`);
      else if (!YOUTUBE_ID.test(id)) errors.push(`${level}: ${id} is not a YouTube video id`);

      const firstLevel = levelsByLesson.get(id);
      if (firstLevel && firstLevel !== level) errors.push(`${id} is in ${firstLevel} and ${level}`);
      else levelsByLesson.set(id, level);
    }
  }

  for (const level of Object.keys(manifest)) {
    if (!CURRICULUM_LEVELS.includes(level as JlptLevel)) errors.push(`unknown level ${level}`);
  }

  return errors;
}
