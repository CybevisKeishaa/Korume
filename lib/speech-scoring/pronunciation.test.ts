/**
 * Pronunciation assessment: score parsing/mapping (incl. word-level errors),
 * request-header shape, NoMatch handling, and typed HTTP errors.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installAzureSpeechMock, type AzureSpeechMockHandle } from "@/test/azure-speech-mock";
import {
  azurePronunciationAssessmentResult,
  azureThrottleError,
  azureUnauthorizedError,
} from "@/test/fixtures/azure-speech-responses";
import { SpeechAuthError, SpeechRecognitionError, SpeechThrottledError } from "./errors";
import { assessPronunciation } from "./pronunciation";

const RECOGNITION = /\/speech\/recognition\//;

describe("assessPronunciation", () => {
  let azure: AzureSpeechMockHandle | undefined;

  beforeEach(() => {
    process.env.SPEECH_PROVIDER = "azure";
    process.env.AZURE_SPEECH_KEY = "test-key";
    process.env.AZURE_SPEECH_REGION = "japaneast";
  });

  afterEach(() => {
    azure?.restore();
    azure = undefined;
  });

  it("maps NBest[0] scores onto DB-facing fields, including word-level errors", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION, responses: [{ body: azurePronunciationAssessmentResult() }] },
    ]);

    const result = await assessPronunciation({
      audio: new Uint8Array([1, 2, 3, 4]),
      referenceText: "今日はいい天気です",
    });

    // pronunciationScore → shadowing_sessions.pronunciation_score
    expect(result.pronunciationScore).toBe(85);
    // fluencyScore → shadowing_sessions.rhythm_score
    expect(result.fluencyScore).toBe(82);
    expect(result.accuracyScore).toBe(87);
    expect(result.completenessScore).toBe(100);
    expect(result.recognizedText).toBe("今日はいい天気です。");

    expect(result.words).toHaveLength(5);
    expect(result.words[2]).toEqual({
      word: "いい",
      accuracyScore: 60,
      errorType: "Mispronunciation",
    });
    expect(result.words[0]).toEqual({ word: "今日", accuracyScore: 95, errorType: "None" });
  });

  it("sends a base64 Pronunciation-Assessment header with the right config", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION, responses: [{ body: azurePronunciationAssessmentResult() }] },
    ]);

    await assessPronunciation({
      audio: new Uint8Array([1, 2, 3, 4]),
      referenceText: "今日はいい天気です",
      granularity: "Phoneme",
    });

    const call = azure.calls[0];
    expect(call).toBeDefined();
    expect(call?.headers["ocp-apim-subscription-key"]).toBe("test-key");
    expect(call?.url).toMatch(/language=ja-JP/);

    const encoded = call?.headers["pronunciation-assessment"];
    expect(encoded).toBeDefined();
    const config = JSON.parse(Buffer.from(encoded ?? "", "base64").toString("utf-8"));
    expect(config).toMatchObject({
      ReferenceText: "今日はいい天気です",
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      EnableMiscue: true,
    });
  });

  it("throws SpeechRecognitionError on a NoMatch result", async () => {
    azure = installAzureSpeechMock([
      {
        match: RECOGNITION,
        responses: [
          { body: azurePronunciationAssessmentResult({ RecognitionStatus: "NoMatch", NBest: [] }) },
        ],
      },
    ]);

    await expect(
      assessPronunciation({ audio: new Uint8Array([1]), referenceText: "今日" }),
    ).rejects.toBeInstanceOf(SpeechRecognitionError);
  });

  it("maps a 401 to SpeechAuthError", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION, responses: [azureUnauthorizedError()] },
    ]);
    await expect(
      assessPronunciation({ audio: new Uint8Array([1]), referenceText: "今日" }),
    ).rejects.toBeInstanceOf(SpeechAuthError);
  });

  it("maps a 429 to SpeechThrottledError", async () => {
    azure = installAzureSpeechMock([{ match: RECOGNITION, responses: [azureThrottleError()] }]);
    await expect(
      assessPronunciation({ audio: new Uint8Array([1]), referenceText: "今日" }),
    ).rejects.toBeInstanceOf(SpeechThrottledError);
  });
});
