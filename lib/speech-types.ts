/**
 * Client-safe shared types for the Layer 4 speech features (STT, TTS,
 * pronunciation scoring). These mirror the JSON shapes returned by
 * `/api/speech/stt` and `/api/pronunciation/score` (see the server-only
 * source of truth in `lib/speech-scoring/types.ts`). This module has NO
 * runtime imports, so it is safe to import from client components — unlike
 * `lib/speech-scoring`, which is `server-only`.
 */

/** Per-word pronunciation outcome, flattened from Azure's `Words[]`. */
export interface WordPronunciationScore {
  word: string;
  /** 0–100 accuracy for this word. */
  accuracyScore: number;
  /** "None" when spoken correctly; otherwise the mistake class. */
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
}

/** `POST /api/pronunciation/score`'s `data` shape. */
export interface PronunciationAssessmentResult {
  /** What Azure recognized (may differ from the reference text). */
  recognizedText: string;
  /** PronScore 0–100. */
  pronunciationScore: number;
  /** FluencyScore 0–100 — rendered as "Rhythm" per repo language conventions. */
  fluencyScore: number;
  /** AccuracyScore 0–100 (phoneme accuracy; UI feedback only). */
  accuracyScore: number;
  /** CompletenessScore 0–100 (how much of the reference was spoken). */
  completenessScore: number;
  /** Per-word breakdown for highlighting weak words. */
  words: WordPronunciationScore[];
}

/** `POST /api/speech/stt`'s `data` shape. AI-generated — label "may be wrong" at the UI. */
export interface SpeechRecognitionResult {
  text: string;
  /** Azure NBest confidence, 0–1. */
  confidence: number;
}
