/**
 * Fixture builders for Azure Cognitive Services Speech REST responses, for
 * use with `installAzureSpeechMock` in `../azure-speech-mock`.
 *
 * Shapes mirror the real Azure Speech-to-Text REST API: pronunciation
 * assessment rides the same recognition response, with a `PronunciationAssessment`
 * object added at the NBest and Word levels (AccuracyScore / FluencyScore /
 * CompletenessScore / PronScore, per §5 pitch/pronunciation priorities in
 * CLAUDE.md). Errors use the standard Cognitive Services envelope
 * `{error: {code, message}}`.
 */

export interface AzurePronunciationWordScore {
  AccuracyScore: number;
  ErrorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
}

export interface AzurePronunciationWord {
  Word: string;
  Offset: number;
  Duration: number;
  PronunciationAssessment: AzurePronunciationWordScore;
}

export interface AzurePronunciationScore {
  AccuracyScore: number;
  FluencyScore: number;
  CompletenessScore: number;
  PronScore: number;
}

export interface AzurePronunciationNBest {
  Confidence: number;
  Lexical: string;
  ITN: string;
  MaskedITN: string;
  Display: string;
  PronunciationAssessment: AzurePronunciationScore;
  Words: AzurePronunciationWord[];
}

export type AzureRecognitionStatus = "Success" | "NoMatch" | "InitialSilenceTimeout" | "Error";

/** A pronunciation-assessment (`Speech-to-text` + `Pronunciation-Assessment` header) result. */
export interface AzurePronunciationAssessmentResult {
  RecognitionStatus: AzureRecognitionStatus;
  DisplayText: string;
  Offset: number;
  Duration: number;
  NBest: AzurePronunciationNBest[];
}

/**
 * A realistic Japanese pronunciation-assessment result for "今日はいい天気です"
 * (kyou wa ii tenki desu), with one deliberately weak word (低い = mispronounced)
 * so scoring/mapping tests have a non-uniform fixture to assert against.
 */
export function azurePronunciationAssessmentResult(
  overrides: Partial<AzurePronunciationAssessmentResult> = {},
): AzurePronunciationAssessmentResult {
  return {
    RecognitionStatus: "Success",
    DisplayText: "今日はいい天気です。",
    Offset: 500000,
    Duration: 12300000,
    NBest: [
      {
        Confidence: 0.94,
        Lexical: "今日 は いい 天気 です",
        ITN: "今日は いい 天気です",
        MaskedITN: "今日は いい 天気です",
        Display: "今日はいい天気です。",
        PronunciationAssessment: {
          AccuracyScore: 87,
          FluencyScore: 82,
          CompletenessScore: 100,
          PronScore: 85,
        },
        Words: [
          {
            Word: "今日",
            Offset: 500000,
            Duration: 2500000,
            PronunciationAssessment: { AccuracyScore: 95, ErrorType: "None" },
          },
          {
            Word: "は",
            Offset: 3100000,
            Duration: 1000000,
            PronunciationAssessment: { AccuracyScore: 98, ErrorType: "None" },
          },
          {
            Word: "いい",
            Offset: 4200000,
            Duration: 2000000,
            PronunciationAssessment: { AccuracyScore: 60, ErrorType: "Mispronunciation" },
          },
          {
            Word: "天気",
            Offset: 6300000,
            Duration: 2800000,
            PronunciationAssessment: { AccuracyScore: 93, ErrorType: "None" },
          },
          {
            Word: "です",
            Offset: 9200000,
            Duration: 1800000,
            PronunciationAssessment: { AccuracyScore: 96, ErrorType: "None" },
          },
        ],
      },
    ],
    ...overrides,
  };
}

/** A plain speech-to-text recognition result (no pronunciation assessment). */
export interface AzureSttNBest {
  Confidence: number;
  Lexical: string;
  ITN: string;
  MaskedITN: string;
  Display: string;
}

export interface AzureSttRecognitionResult {
  RecognitionStatus: AzureRecognitionStatus;
  DisplayText: string;
  Offset: number;
  Duration: number;
  NBest: AzureSttNBest[];
}

export function azureSttRecognitionResult(
  overrides: Partial<AzureSttRecognitionResult> = {},
): AzureSttRecognitionResult {
  return {
    RecognitionStatus: "Success",
    DisplayText: "図書館はどこですか。",
    Offset: 300000,
    Duration: 9800000,
    NBest: [
      {
        Confidence: 0.91,
        Lexical: "図書館 は どこ です か",
        ITN: "図書館はどこですか",
        MaskedITN: "図書館はどこですか",
        Display: "図書館はどこですか。",
      },
    ],
    ...overrides,
  };
}

/**
 * A small binary payload standing in for the audio bytes a TTS endpoint
 * returns. Not a decodable audio file — just a deterministic byte sequence
 * (RIFF/WAVE-tagged) so tests can assert on the bytes actually received
 * without shipping a real audio fixture.
 */
export function azureTtsAudioBuffer(): ArrayBuffer {
  const bytes = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, // "RIFF"
    0x00, 0x00, 0x00, 0x00, // chunk size (unused placeholder)
    0x57, 0x41, 0x56, 0x45, // "WAVE"
    0x01, 0x02, 0x03, 0x04, // fake data bytes
  ]);
  return bytes.buffer;
}

/** The standard Cognitive Services error envelope. */
export interface AzureErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface AzureErrorFixture {
  status: 401 | 429;
  body: AzureErrorBody;
}

/** A `401` — missing/invalid subscription key. */
export function azureUnauthorizedError(
  overrides: Partial<AzureErrorBody["error"]> = {},
): AzureErrorFixture {
  return {
    status: 401,
    body: {
      error: {
        code: "401",
        message:
          "Access denied due to invalid subscription key or wrong API endpoint. " +
          "Make sure to provide a valid key for an active subscription and use a " +
          "correct regional API endpoint for your resource.",
        ...overrides,
      },
    },
  };
}

/** A `429` — throttled. */
export function azureThrottleError(
  overrides: Partial<AzureErrorBody["error"]> = {},
): AzureErrorFixture {
  return {
    status: 429,
    body: {
      error: {
        code: "429",
        message: "Rate limit is exceeded. Try again later.",
        ...overrides,
      },
    },
  };
}
