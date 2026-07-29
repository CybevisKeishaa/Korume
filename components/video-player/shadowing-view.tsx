"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import type {
  FuriganaDisplayMode,
  TranscriptLineRow,
  TranscriptWithLines,
  VideoRow,
  VocabMasteryMap,
} from "@/lib/video-types";
import {
  YouTubePlayer,
  YT_PLAYER_STATE,
  type YouTubePlayerHandle,
  type YtPlayerStateValue,
} from "./youtube-player";
import { TranscriptPane } from "./transcript-pane";
import { FuriganaModeControl, LoopControls, SpeedControl, ToggleButton } from "./playback-controls";
import { ShadowingRecorderPanel } from "./shadowing-recorder-panel";
import { VideoSummaryPanel } from "./video-summary-panel";

export interface ShadowingViewProps {
  video: VideoRow;
  /** null when this video has no transcript yet — later task adds ingestion UI. */
  transcript: TranscriptWithLines | null;
  /**
   * word/reading -> srs_stage for the current user's mastered vocab
   * (CLAUDE.md §5.4). Defaults to empty (signed-out reader or no progress
   * yet), which makes "Adaptive" behave like "All" until the user has SRS
   * history.
   */
  masteryMap?: VocabMasteryMap;
}

/** Saves a watch-position PATCH at most every this many seconds of playback. */
const PROGRESS_SAVE_INTERVAL_S = 5;

/** The transcript line whose [start_time, end_time) contains `time`, or null between/before lines. */
function findActiveLine(lines: TranscriptLineRow[], time: number): TranscriptLineRow | null {
  let active: TranscriptLineRow | null = null;
  for (const line of lines) {
    if (line.start_time > time) break;
    active = line.end_time == null || time < line.end_time ? line : null;
  }
  return active;
}

async function patchJson(url: string, body: unknown): Promise<void> {
  try {
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Best-effort: watch position / duration reporting never blocks playback.
  }
}

/**
 * Orchestrates the synced video + transcript shadowing player: highlights
 * the active line, seeks on line click, A–B loop, speed control, furigana +
 * translation toggles, and duration/progress reporting to the API.
 */
export function ShadowingView({ video, transcript, masteryMap = {} }: ShadowingViewProps) {
  const t = useTranslations("shadowing");
  const searchParams = useSearchParams();
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const durationReportedRef = useRef(video.duration_seconds != null);
  const lastSavedTimeRef = useRef(0);
  /**
   * `?line=<transcriptLineId>` — the Journal's "return to this moment" target.
   * Held in a ref because it is consumed once, when the player becomes ready.
   */
  const deepLinkLineIdRef = useRef(searchParams.get("line"));

  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [furiganaMode, setFuriganaMode] = useState<FuriganaDisplayMode>("adaptive");
  const [showTranslation, setShowTranslation] = useState(true);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  /** Native YouTube IFrame API error code (region lock, deleted, embedding disabled, ...), or null. */
  const [playerError, setPlayerError] = useState<number | null>(null);

  const lines = useMemo(() => transcript?.lines ?? [], [transcript]);
  const activeLine = useMemo(() => findActiveLine(lines, currentTime), [lines, currentTime]);

  const saveProgress = useCallback(
    (position: number, completed = false) => {
      void patchJson(`/api/videos/${video.id}/progress`, {
        position,
        ...(completed ? { completed: true } : {}),
      });
    },
    [video.id],
  );

  const handleReady = useCallback(() => {
    if (!durationReportedRef.current) {
      const duration = playerRef.current?.getDuration() ?? 0;
      if (duration > 0) {
        durationReportedRef.current = true;
        void patchJson(`/api/videos/${video.id}`, { durationSeconds: Math.round(duration) });
      }
    }

    // A deep link is an arrival, not a mode: consume it once (clearing the ref
    // before the lookup, so an unknown id is spent too) and let the user drive
    // from there. An absent or unknown `?line=` leaves playback exactly where
    // a plain arrival would.
    const deepLinkLineId = deepLinkLineIdRef.current;
    if (deepLinkLineId) {
      deepLinkLineIdRef.current = null;
      const target = lines.find((line) => line.id === deepLinkLineId);
      if (target) {
        playerRef.current?.seekTo(target.start_time);
        setCurrentTime(target.start_time);
      }
    }
  }, [video.id, lines]);

  const handleStateChange = useCallback(
    (state: YtPlayerStateValue) => {
      const handle = playerRef.current;
      if (!handle) return;
      if (state === YT_PLAYER_STATE.PAUSED) {
        const time = handle.getCurrentTime();
        lastSavedTimeRef.current = time;
        saveProgress(time);
      } else if (state === YT_PLAYER_STATE.ENDED) {
        const time = handle.getCurrentTime();
        lastSavedTimeRef.current = time;
        saveProgress(time, true);
      }
    },
    [saveProgress],
  );

  const handleTick = useCallback(
    (time: number) => {
      setCurrentTime(time);

      if (loopA !== null && loopB !== null && time >= loopB) {
        playerRef.current?.seekTo(loopA);
        return;
      }

      if (time - lastSavedTimeRef.current >= PROGRESS_SAVE_INTERVAL_S) {
        lastSavedTimeRef.current = time;
        saveProgress(time);
      }
    },
    [loopA, loopB, saveProgress],
  );

  const handleError = useCallback((code: number) => {
    setPlayerError(code);
  }, []);

  const handleLineSelect = useCallback((line: TranscriptLineRow) => {
    const handle = playerRef.current;
    if (!handle) return;
    handle.seekTo(line.start_time);
    handle.play();
    setCurrentTime(line.start_time);
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    playerRef.current?.setPlaybackRate(rate);
    setPlaybackRate(rate);
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
          <YouTubePlayer
            ref={playerRef}
            videoId={video.youtube_video_id}
            className="h-full w-full"
            onReady={handleReady}
            onStateChange={handleStateChange}
            onError={handleError}
            onTick={handleTick}
          />
          {playerError !== null && (
            <div
              role="alert"
              aria-live="assertive"
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/90 p-4 text-center text-white"
            >
              <p className="font-medium">{t("playerError.title")}</p>
              <p className="text-sm text-white/70">{t("playerError.body")}</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <SpeedControl value={playbackRate} onChange={changeSpeed} />
          <LoopControls
            loopA={loopA}
            loopB={loopB}
            onSetA={() => setLoopA(currentTime)}
            onSetB={() => setLoopB(currentTime)}
            onClear={() => {
              setLoopA(null);
              setLoopB(null);
            }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4">
          <FuriganaModeControl value={furiganaMode} onChange={setFuriganaMode} />
          <ToggleButton pressed={showTranslation} onClick={() => setShowTranslation((v) => !v)}>
            {t("translationToggle")}
          </ToggleButton>
        </div>

        {activeLine && (
          <div className="mt-4 rounded-lg border border-border p-3">
            <ShadowingRecorderPanel
              key={activeLine.id}
              videoId={video.id}
              lineId={activeLine.id}
              lineText={activeLine.text_jp}
            />
          </div>
        )}

        <VideoSummaryPanel videoId={video.id} className="mt-4" />
      </div>

      <div className="max-h-[70vh] overflow-y-auto rounded-lg border border-border p-3">
        {transcript ? (
          <TranscriptPane
            lines={lines}
            activeLineId={activeLine?.id ?? null}
            onLineSelect={handleLineSelect}
            furiganaMode={furiganaMode}
            masteryMap={masteryMap}
            showTranslation={showTranslation}
            videoId={video.id}
          />
        ) : (
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t("noTranscript.title")}</p>
            <p className="mt-1">{t("noTranscript.body")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
