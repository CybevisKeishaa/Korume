/**
 * Text-to-speech: returns the binary buffer, sends correct SSML/voice/format,
 * escapes text, and maps HTTP errors. This is also the source of REFERENCE
 * audio for Layer 4 pitch scoring — synthesized from text, never from YouTube
 * (CLAUDE.md §2.1).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installAzureSpeechMock, type AzureSpeechMockHandle } from "@/test/azure-speech-mock";
import {
  azureThrottleError,
  azureTtsAudioBuffer,
} from "@/test/fixtures/azure-speech-responses";
import { DEFAULT_JA_VOICE, DEFAULT_TTS_FORMAT, synthesizeSpeech } from "./tts";
import { SpeechThrottledError } from "./errors";

const TTS = /\/cognitiveservices\/v1/;

describe("synthesizeSpeech", () => {
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

  it("returns the raw audio bytes and posts SSML with the default voice + format", async () => {
    azure = installAzureSpeechMock([{ match: TTS, responses: [{ body: azureTtsAudioBuffer() }] }]);

    const buffer = await synthesizeSpeech({ text: "こんにちは" });

    expect(new Uint8Array(buffer)).toEqual(new Uint8Array(azureTtsAudioBuffer()));

    const call = azure.calls[0];
    expect(call?.method).toBe("POST");
    expect(call?.headers["x-microsoft-outputformat"]).toBe(DEFAULT_TTS_FORMAT);
    expect(call?.headers["content-type"]).toMatch(/ssml\+xml/);
    expect(call?.headers["ocp-apim-subscription-key"]).toBe("test-key");
    expect(call?.bodyText).toContain(`<voice name="${DEFAULT_JA_VOICE}">`);
    expect(call?.bodyText).toContain("こんにちは");
    expect(call?.bodyText).toMatch(/xml:lang="ja-JP"/);
  });

  it("honors an explicit voice override", async () => {
    azure = installAzureSpeechMock([{ match: TTS, responses: [{ body: azureTtsAudioBuffer() }] }]);

    await synthesizeSpeech({ text: "テスト", voice: "ja-JP-KeitaNeural" });

    expect(azure.calls[0]?.bodyText).toContain(`<voice name="ja-JP-KeitaNeural">`);
  });

  it("XML-escapes the input text so it cannot break the SSML document", async () => {
    azure = installAzureSpeechMock([{ match: TTS, responses: [{ body: azureTtsAudioBuffer() }] }]);

    await synthesizeSpeech({ text: `a & b <tag> "q"` });

    const body = azure.calls[0]?.bodyText ?? "";
    expect(body).toContain("a &amp; b &lt;tag&gt;");
    expect(body).not.toContain("<tag>");
  });

  it("maps a 429 to SpeechThrottledError", async () => {
    azure = installAzureSpeechMock([{ match: TTS, responses: [azureThrottleError()] }]);
    await expect(synthesizeSpeech({ text: "テスト" })).rejects.toBeInstanceOf(SpeechThrottledError);
  });
});
