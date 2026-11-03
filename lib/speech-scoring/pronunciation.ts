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
    // Default is "Basic" = AccuracyScore only; Fluency/Completeness/PronScore need this.
    Dimension: "Comprehensive",
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
  // REST returns the scores flat on NBest[0]; the SDK shape nests them.
  const s = best?.PronunciationAssessment ?? best;
  const scores = s && [s.PronScore, s.FluencyScore, s.AccuracyScore, s.CompletenessScore];
  if (json.RecognitionStatus !== "Success" || !best || !scores?.every((n) => typeof n === "number")) {
    throw new SpeechRecognitionError(
      `Pronunciation assessment produced no usable result (status: ${json.RecognitionStatus}).`,
      json.RecognitionStatus,
    );
  }

  const words: WordPronunciationScore[] = (best.Words ?? []).map((w) => ({
    word: w.Word,
    accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? w.AccuracyScore ?? 0,
    errorType: w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? "None",
  }));

  // Every entry was checked to be a number above.
  const [pronunciationScore, fluencyScore, accuracyScore, completenessScore] = scores as [number, number, number, number];
  return {
    recognizedText: json.DisplayText ?? best.Display ?? "",
    pronunciationScore,
    fluencyScore,
    accuracyScore,
    completenessScore,
    words,
  };
}
