/**
 * `lib/speech-scoring` — server-only Azure Cognitive Services Speech integration
 * (Layer 4). Pronunciation assessment, plain STT, and TTS over the REST API via
 * `fetch` (no Azure SDK). Keys stay server-side (CLAUDE.md §6); routes owned by
 * `backend-engineer` rate-limit and validate around these wrappers.
 */
export { isSpeechConfigured, SPEECH_LANGUAGE } from "./config";
export { assessPronunciation } from "./pronunciation";
export { recognizeSpeech } from "./stt";
export { synthesizeSpeech, buildSsml, DEFAULT_JA_VOICE, DEFAULT_TTS_FORMAT } from "./tts";

export {
  SpeechError,
  SpeechNotConfiguredError,
  SpeechAuthError,
  SpeechThrottledError,
  SpeechRequestError,
  SpeechRecognitionError,
} from "./errors";
export type { SpeechErrorKind } from "./errors";

export type {
  SpeechAudioInput,
  PronunciationGranularity,
  WordPronunciationScore,
  PronunciationAssessmentResult,
  AssessPronunciationParams,
  SpeechRecognitionResult,
  RecognizeSpeechParams,
  SynthesizeSpeechParams,
} from "./types";
