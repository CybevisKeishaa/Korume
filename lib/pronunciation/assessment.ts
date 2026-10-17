import { z } from "zod";
import type { PronunciationAssessmentResult } from "@/lib/speech-types";

const score = z.number().min(0).max(100).nullable();
const wordSchema = z.object({
  word: z.string().max(100),
  accuracy: score,
  errorType: z.enum(["None", "Omission", "Insertion", "Mispronunciation"]),
});

/** Spec §4.4: unknown versions and invalid stored detail read as null. */
export const assessmentSchema = z.object({
  v: z.literal(1),
  accuracy: score,
  completeness: score,
  recognizedText: z.string().max(1000).nullable(),
  words: z.array(wordSchema).max(200).nullable(),
});
export type Assessment = z.infer<typeof assessmentSchema>;
export type AssessmentWord = z.infer<typeof wordSchema>;

export function toAssessment(result: PronunciationAssessmentResult): Assessment {
  return assessmentSchema.parse({
    v: 1,
    accuracy: result.accuracyScore ?? null,
    completeness: result.completenessScore ?? null,
    recognizedText: result.recognizedText || null,
    words: result.words?.map((word) => ({
      word: word.word, accuracy: word.accuracyScore ?? null, errorType: word.errorType,
    })) ?? null,
  });
}

export function readAssessment(value: unknown): Assessment | null {
  const parsed = assessmentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
