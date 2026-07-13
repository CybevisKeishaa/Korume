/**
 * Config + not-configured behavior for `lib/speech-scoring`.
 *
 * When Azure creds are absent, every public entry point must throw
 * `SpeechNotConfiguredError` *before* touching the network (CLAUDE.md §6/§7 —
 * routes map this to a 503; we never fabricate scores).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installAzureSpeechMock, type AzureSpeechMockHandle } from "@/test/azure-speech-mock";
import { azureTtsAudioBuffer } from "@/test/fixtures/azure-speech-responses";
import { isSpeechConfigured } from "./config";
import { SpeechNotConfiguredError } from "./errors";
import { assessPronunciation } from "./pronunciation";
import { recognizeSpeech } from "./stt";
import { synthesizeSpeech } from "./tts";

const KEY = "AZURE_SPEECH_KEY";
const REGION = "AZURE_SPEECH_REGION";

describe("isSpeechConfigured", () => {
  const original = { key: process.env[KEY], region: process.env[REGION] };

  afterEach(() => {
    process.env[KEY] = original.key;
    process.env[REGION] = original.region;
  });

  it("is true only when both key and region are present", () => {
    process.env[KEY] = "k";
    process.env[REGION] = "japaneast";
    expect(isSpeechConfigured()).toBe(true);
  });

  it("is false when either credential is missing", () => {
    delete process.env[KEY];
    process.env[REGION] = "japaneast";
    expect(isSpeechConfigured()).toBe(false);

    process.env[KEY] = "k";
    delete process.env[REGION];
    expect(isSpeechConfigured()).toBe(false);
  });
});

describe("not-configured entry points", () => {
  let azure: AzureSpeechMockHandle | undefined;

  beforeEach(() => {
    delete process.env[KEY];
    delete process.env[REGION];
    // Install a mock that would capture any fetch, so we can prove none happens.
    azure = installAzureSpeechMock([
      { match: /./, responses: [{ body: azureTtsAudioBuffer() }] },
    ]);
  });

  afterEach(() => {
    azure?.restore();
    azure = undefined;
  });

  it("assessPronunciation throws SpeechNotConfiguredError and makes no fetch", async () => {
    await expect(
      assessPronunciation({ audio: new Uint8Array([1, 2, 3]), referenceText: "今日" }),
    ).rejects.toBeInstanceOf(SpeechNotConfiguredError);
    expect(azure?.calls).toHaveLength(0);
  });

  it("recognizeSpeech throws SpeechNotConfiguredError and makes no fetch", async () => {
    await expect(recognizeSpeech({ audio: new Uint8Array([1, 2, 3]) })).rejects.toBeInstanceOf(
      SpeechNotConfiguredError,
    );
    expect(azure?.calls).toHaveLength(0);
  });

  it("synthesizeSpeech throws SpeechNotConfiguredError and makes no fetch", async () => {
    await expect(synthesizeSpeech({ text: "こんにちは" })).rejects.toBeInstanceOf(
      SpeechNotConfiguredError,
    );
    expect(azure?.calls).toHaveLength(0);
  });
});
