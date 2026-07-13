/**
 * Public result/param types for `lib/speech-scoring`. Rendering- and
 * transport-agnostic: raw numbers + text that routes persist or forward.
 */

/** WAV/PCM audio bytes to send to Azure (server-side; validated at the route). */
export type SpeechAudioInput = ArrayBuffer | Uint8Array;

/** Word-level granularity for pronunciation assessment. */
export type PronunciationGranularity = "Word" | "Phoneme" | "FullText";

/** Per-word pronunciation outcome, flattened from Azure's `Words[]`. */
export interface WordPronunciationScore {
  word: string;
  /** 0–100 accuracy for this word. */
  accuracyScore: number;
  /** "None" when spoken correctly; otherwise the mistake class. */
  errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
}

/**
 * Pronunciation-assessment result for one recorded line.
 *
 * DB mapping (spec §4, `shadowing_sessions`):
 *   - `pronunciationScore` (PronScore, 0–100)  → `pronunciation_score`
 *   - `fluencyScore`       (FluencyScore, 0–100) → `rhythm_score`
 *
 * `accuracyScore` / `completenessScore` are returned for richer UI feedback
 * but have no dedicated column. `pitch_score` is produced separately by the
 * pitch-accent scorer (`lib/pitch`, Layer 4), not here.
 */
export interface PronunciationAssessmentResult {
  /** What Azure recognized (may differ from the reference text). */
  recognizedText: string;
  /** PronScore 0–100 → `shadowing_sessions.pronunciation_score`. */
  pronunciationScore: number;
  /** FluencyScore 0–100 → `shadowing_sessions.rhythm_score`. */
  fluencyScore: number;
  /** AccuracyScore 0–100 (phoneme accuracy; UI feedback only). */
  accuracyScore: number;
  /** CompletenessScore 0–100 (how much of the reference was spoken). */
  completenessScore: number;
  /** Per-word breakdown for highlighting weak words in the transcript. */
  words: WordPronunciationScore[];
}

export interface AssessPronunciationParams {
  audio: SpeechAudioInput;
  /** The line the user is shadowing; scored against this. */
  referenceText: string;
  /** Assessment granularity. Defaults to "Word". */
  granularity?: PronunciationGranularity;
  /** Flag insertions/omissions vs. the reference. Defaults to true. */
  enableMiscue?: boolean;
}

/** Plain STT result for voice-conversation mode. */
export interface SpeechRecognitionResult {
  /** Recognized Japanese text. Show with an "AI-generated, may be wrong" note. */
  text: string;
  /** Azure NBest confidence, 0–1. */
  confidence: number;
}

export interface RecognizeSpeechParams {
  audio: SpeechAudioInput;
}

export interface SynthesizeSpeechParams {
  text: string;
  /** Azure neural voice name. Defaults to a Japanese female neural voice. */
  voice?: string;
  /** `X-Microsoft-OutputFormat`. Defaults to a 24kHz mono mp3. */
  format?: string;
}
