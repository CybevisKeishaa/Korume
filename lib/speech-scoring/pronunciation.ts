/**
 * Pronunciation assessment (ja-JP) — differentiator #1 support (CLAUDE.md §5).
 *
 * Sends the user's WAV recording to Azure with a base64 `Pronunciation-Assessment`
 * config header, then flattens NBest[0] into DB-facing scores. Never fabricates
 * a score: an unusable recognition throws `SpeechRecognitionError`.
 */
import { SpeechRecognitionError } from "./errors";
import { postRecognition } from "./recognition-client";
import type {
  AssessPronunciationParams,
  PronunciationAssessmentResult,
  WordPronunciationScore,
} from "./types";

/** Build the base64-encoded JSON config for the `Pronunciation-Assessment` header. */
function buildAssessmentHeader(params: AssessPronunciationParams): string {
  const config = {
    ReferenceText: params.referenceText,
    GradingSystem: "HundredMark",
    Granularity: params.granularity ?? "Word",
    EnableMiscue: params.enableMiscue ?? true,
  };
  return Buffer.from(JSON.stringify(config), "utf-8").toString("base64");
}

/**
 * Score a recording against `referenceText`. Returns per-line accuracy/rhythm
 * scores + a per-word breakdown. See `PronunciationAssessmentResult` for the
 * exact mapping onto `shadowing_sessions` columns.
 */
export async function assessPronunciation(
  params: AssessPronunciationParams,
): Promise<PronunciationAssessmentResult> {
  const json = await postRecognition(params.audio, buildAssessmentHeader(params));

  const best = json.NBest?.[0];
  const assessment = best?.PronunciationAssessment;
  if (json.RecognitionStatus !== "Success" || !best || !assessment) {
    throw new SpeechRecognitionError(
      `Pronunciation assessment produced no usable result (status: ${json.RecognitionStatus}).`,
      json.RecognitionStatus,
    );
  }

  const words: WordPronunciationScore[] = (best.Words ?? []).map((w) => ({
    word: w.Word,
    accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
    errorType: w.PronunciationAssessment?.ErrorType ?? "None",
  }));

  return {
    recognizedText: json.DisplayText ?? best.Display ?? "",
    pronunciationScore: assessment.PronScore,
    fluencyScore: assessment.FluencyScore,
    accuracyScore: assessment.AccuracyScore,
    completenessScore: assessment.CompletenessScore,
    words,
  };
}
