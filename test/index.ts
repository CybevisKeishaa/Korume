/**
 * Barrel for shared Layer 3 + Layer 4 test fixtures/mocks. Import from here
 * (or from the individual modules directly — both are fine) in player,
 * shadowing recorder, pitch, dictation, and AI-feature (lib/ai,
 * lib/speech-scoring) tests.
 */
export {
  createFakeMediaStream,
  mockGetUserMedia,
  mockMediaRecorder,
  FakeMediaRecorder,
  type FakeMediaStreamOptions,
  type GetUserMediaMockOptions,
  type GetUserMediaMockHandle,
  type FakeMediaRecorderState,
  type MediaRecorderMockHandle,
} from "./media-mocks";

export {
  installYouTubeStub,
  FakeYtPlayer,
  YT_PLAYER_STATE,
  type YtPlayerStateValue,
  type YtReadyEvent,
  type YtStateChangeEvent,
  type YtErrorEvent,
  type YtPlayerConfig,
  type FakeYtPlayerOptions,
  type YouTubeStubHandle,
} from "./youtube-stub";

export {
  makeToneBuffer,
  makeSilenceBuffer,
} from "./audio-fixtures";

export {
  mockAudioContext,
  type FakeAudioContextOptions,
  type AudioContextMockHandle,
} from "./audio-context-mock";

export { readBlobBytes } from "./blob-utils";

export {
  TRANSCRIPT_PLAIN_TEXT_FIXTURE,
  TRANSCRIPT_SRT_FIXTURE,
  TRANSCRIPT_VTT_FIXTURE,
  TRANSCRIPT_VTT_WITH_TRANSLATION_FIXTURE,
  type ParsedTranscriptLine,
  type TranscriptFixture,
} from "./fixtures/transcripts";

export {
  YOUTUBE_URL_FIXTURES,
  type YouTubeUrlFixture,
} from "./fixtures/youtube-urls";

export {
  installClaudeMock,
  type ClaudeMockHandle,
  type ClaudeMockOptions,
  type ClaudeCapturedRequest,
  type ClaudeMessagesRequestBody,
  type QueuedClaudeResponse,
} from "./claude-mock";

export {
  claudeTextResponse,
  claudeToolUseResponse,
  claudeTruncatedResponse,
  claudeErrorResponse,
  type ClaudeMessageResponse,
  type ClaudeContentBlock,
  type ClaudeTextBlock,
  type ClaudeToolUseBlock,
  type ClaudeStopReason,
  type ClaudeUsage,
  type ClaudeErrorBody,
  type ClaudeErrorFixture,
} from "./fixtures/claude-responses";

export {
  installAzureSpeechMock,
  type AzureSpeechMockHandle,
  type AzureRoute,
  type AzureCapturedRequest,
  type AzureQueuedResponse,
} from "./azure-speech-mock";

export {
  azurePronunciationAssessmentResult,
  azureSttRecognitionResult,
  azureTtsAudioBuffer,
  azureUnauthorizedError,
  azureThrottleError,
  type AzurePronunciationAssessmentResult,
  type AzurePronunciationNBest,
  type AzurePronunciationWord,
  type AzurePronunciationScore,
  type AzurePronunciationWordScore,
  type AzureSttRecognitionResult,
  type AzureSttNBest,
  type AzureRecognitionStatus,
  type AzureErrorBody,
  type AzureErrorFixture,
} from "./fixtures/azure-speech-responses";
