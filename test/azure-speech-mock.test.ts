/**
 * Pattern test for `azure-speech-mock.ts` — executable documentation for the
 * ai-engineer's `lib/speech-scoring` Azure Speech integration. Demonstrates
 * routing three distinct endpoint shapes (pronunciation assessment, plain
 * STT, TTS binary) through one mock install, plus the 401/429 error fixtures.
 */
import { afterEach, describe, expect, it } from "vitest";
import { installAzureSpeechMock, type AzureSpeechMockHandle } from "./azure-speech-mock";
import {
  azurePronunciationAssessmentResult,
  azureSttRecognitionResult,
  azureThrottleError,
  azureTtsAudioBuffer,
  azureUnauthorizedError,
} from "./fixtures/azure-speech-responses";

const REGION = "japaneast";
const RECOGNITION_URL = `https://${REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ja-JP`;
const TTS_URL = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

describe("installAzureSpeechMock", () => {
  let azure: AzureSpeechMockHandle | undefined;

  afterEach(() => {
    azure?.restore();
    azure = undefined;
  });

  it("scores a pronunciation-assessment request and captures the request headers", async () => {
    azure = installAzureSpeechMock([
      {
        match: /\/speech\/recognition\//,
        responses: [{ body: azurePronunciationAssessmentResult() }],
      },
    ]);

    const response = await fetch(RECOGNITION_URL, {
      method: "POST",
      headers: {
        "content-type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Ocp-Apim-Subscription-Key": "test-key",
        "Pronunciation-Assessment": Buffer.from(
          JSON.stringify({ ReferenceText: "今日はいい天気です", GradingSystem: "HundredMark" }),
        ).toString("base64"),
      },
      body: "fake-pcm-audio-bytes",
    });
    const json = (await response.json()) as ReturnType<typeof azurePronunciationAssessmentResult>;

    expect(response.status).toBe(200);
    expect(json.NBest[0]?.PronunciationAssessment.PronScore).toBe(85);
    expect(json.NBest[0]?.Words).toHaveLength(5);
    expect(json.NBest[0]?.Words[2]).toMatchObject({
      Word: "いい",
      PronunciationAssessment: { ErrorType: "Mispronunciation" },
    });

    expect(azure.calls).toHaveLength(1);
    expect(azure.calls[0]?.headers["pronunciation-assessment"]).toBeDefined();
  });

  it("routes a plain STT request separately from pronunciation assessment", async () => {
    azure = installAzureSpeechMock([
      {
        match: /\/speech\/recognition\//,
        responses: [{ body: azureSttRecognitionResult() }],
      },
    ]);

    const response = await fetch(RECOGNITION_URL, { method: "POST", body: "fake-pcm-audio-bytes" });
    const json = (await response.json()) as ReturnType<typeof azureSttRecognitionResult>;

    expect(json.DisplayText).toBe("図書館はどこですか。");
    expect(json.NBest[0]).not.toHaveProperty("PronunciationAssessment");
  });

  it("returns a binary TTS payload", async () => {
    azure = installAzureSpeechMock([
      { match: TTS_URL, responses: [{ body: azureTtsAudioBuffer() }] },
    ]);

    const response = await fetch(TTS_URL, {
      method: "POST",
      headers: { "content-type": "application/ssml+xml" },
      body: "<speak>...</speak>",
    });
    const buffer = await response.arrayBuffer();

    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(new Uint8Array(buffer)).toEqual(new Uint8Array(azureTtsAudioBuffer()));
  });

  it("serves a 401 unauthorized error", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION_URL, responses: [azureUnauthorizedError()] },
    ]);

    const response = await fetch(RECOGNITION_URL, { method: "POST" });
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("401");
  });

  it("serves a 429 throttle error", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION_URL, responses: [azureThrottleError()] },
    ]);

    const response = await fetch(RECOGNITION_URL, { method: "POST" });
    const json = (await response.json()) as { error: { code: string } };

    expect(response.status).toBe(429);
    expect(json.error.code).toBe("429");
  });

  it("throws instead of hitting the network when no route matches", async () => {
    azure = installAzureSpeechMock([{ match: TTS_URL, responses: [{ body: azureTtsAudioBuffer() }] }]);
    await expect(fetch("https://example.com/unrelated")).rejects.toThrow(/no route matches/);
  });
});
