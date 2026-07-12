/**
 * Barrel for shared Layer 3 test fixtures/mocks. Import from here (or from
 * the individual modules directly — both are fine) in player, shadowing
 * recorder, pitch, and dictation tests.
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
