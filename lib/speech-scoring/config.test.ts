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
const PROVIDER = "SPEECH_PROVIDER";

describe("isSpeechConfigured", () => {
  const original = {
    key: process.env[KEY],
    region: process.env[REGION],
    provider: process.env[PROVIDER],
  };

  afterEach(() => {
    process.env[KEY] = original.key;
    process.env[REGION] = original.region;
    process.env[PROVIDER] = original.provider;
  });

  // isSpeechConfigured now delegates to isSpeechEnabled (Spec D9): intent comes
  // from SPEECH_PROVIDER, never inferred from which credentials happen to be
  // set. Structural validity of the credentials is a startup-time concern
  // (see env.test.ts), not this runtime gate's job.
  it("is true when SPEECH_PROVIDER=azure, regardless of credential presence", () => {
    process.env[PROVIDER] = "azure";
    process.env[KEY] = "k";
    process.env[REGION] = "japaneast";
    expect(isSpeechConfigured()).toBe(true);
  });

  it("is false when speech is not the selected provider, even with credentials present", () => {
    // Setup uses an explicit SPEECH_PROVIDER=none rather than an unset/deleted
    // value: since Fix 3 (D9), an *unset* SPEECH_PROVIDER is a misconfiguration
    // that throws (see env.test.ts), not a silent "off" — so this test now
    // exercises the genuinely-disabled case instead of that removed inference.
    process.env[PROVIDER] = "none";
    delete process.env[KEY];
    process.env[REGION] = "japaneast";
    expect(isSpeechConfigured()).toBe(false);

    process.env[KEY] = "k";
    delete process.env[REGION];
    expect(isSpeechConfigured()).toBe(false);
  });

  it("throws when SPEECH_PROVIDER is unset — absence is a misconfiguration, never intentional off (D9)", () => {
    delete process.env[PROVIDER];
    expect(() => isSpeechConfigured()).toThrow();
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
