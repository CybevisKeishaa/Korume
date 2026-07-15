/**
 * Plain speech-to-text (voice-conversation mode): happy path, NoMatch, errors.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installAzureSpeechMock, type AzureSpeechMockHandle } from "@/test/azure-speech-mock";
import {
  azureSttRecognitionResult,
  azureUnauthorizedError,
} from "@/test/fixtures/azure-speech-responses";
import { SpeechAuthError, SpeechRecognitionError } from "./errors";
import { recognizeSpeech } from "./stt";

const RECOGNITION = /\/speech\/recognition\//;

describe("recognizeSpeech", () => {
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

  it("returns recognized text + confidence, and does NOT send an assessment header", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION, responses: [{ body: azureSttRecognitionResult() }] },
    ]);

    const result = await recognizeSpeech({ audio: new Uint8Array([1, 2, 3]) });

    expect(result.text).toBe("図書館はどこですか。");
    expect(result.confidence).toBeCloseTo(0.91);
    expect(azure.calls[0]?.headers["pronunciation-assessment"]).toBeUndefined();
    expect(azure.calls[0]?.headers["ocp-apim-subscription-key"]).toBe("test-key");
  });

  it("throws SpeechRecognitionError when Azure reports NoMatch", async () => {
    azure = installAzureSpeechMock([
      {
        match: RECOGNITION,
        responses: [{ body: azureSttRecognitionResult({ RecognitionStatus: "NoMatch", NBest: [] }) }],
      },
    ]);

    await expect(recognizeSpeech({ audio: new Uint8Array([1]) })).rejects.toBeInstanceOf(
      SpeechRecognitionError,
    );
  });

  it("maps a 401 to SpeechAuthError", async () => {
    azure = installAzureSpeechMock([
      { match: RECOGNITION, responses: [azureUnauthorizedError()] },
    ]);
    await expect(recognizeSpeech({ audio: new Uint8Array([1]) })).rejects.toBeInstanceOf(
      SpeechAuthError,
    );
  });
});
