import { FALLBACK_STUDY_TIMEZONE } from "./study-day";
import { getStudyTimezone, type StudyTimezone } from "./study-timezone";

/** A failed timezone projection must not prevent a page from rendering. */
export async function getStudyTimezoneOrFallback(read: () => Promise<StudyTimezone> = getStudyTimezone): Promise<StudyTimezone> {
  try {
    return await read();
  } catch (error) {
    console.error("[study-timezone] read failed:", error);
    return { timeZone: FALLBACK_STUDY_TIMEZONE, needsDetection: false };
  }
}
