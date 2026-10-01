import type { LoopConfig } from "@/lib/shadowing-workspace/loop-machine";

export interface PlaybackController {
  play(): void;
  pause(): void;
  togglePlay(): void;
  isPlaying(): boolean;
  seekTo(seconds: number): void;
  seekToSentence(index: number, options?: { play?: boolean }): void;
  previousSentence(): void;
  nextSentence(): void;
  rewind(seconds: number): void;
  setRate(rate: number): void;
  availableRates(): number[];
  toggleMute(): void;
  isMuted(): boolean;
  setLoop(config: Partial<LoopConfig>): void;
  loopConfig(): LoopConfig;
}
