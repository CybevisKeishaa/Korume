"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { YouTubePlayer, type YouTubePlayerHandle } from "./youtube-player";

export interface MiningClipPlayerProps {
  videoId: string;
  startTime: number | null;
  endTime: number | null;
}

/**
 * Replays a mined sentence's clip through the official YouTube IFrame player
 * — seeks to `startTime` and pauses once playback reaches `endTime`. A card
 * stores no media, only `{videoId, startTime, endTime}` (CLAUDE.md §2), so
 * this is the only way a clip is ever "replayed". The player is mounted
 * lazily, on first "Play clip" click, so a deck/review page with many cards
 * doesn't load the IFrame API for cards the user never plays.
 */
export function MiningClipPlayer({ videoId, startTime, endTime }: MiningClipPlayerProps) {
  const [mounted, setMounted] = useState(false);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const seekAndPlay = useCallback(() => {
    const handle = playerRef.current;
    if (!handle || startTime == null) return;
    handle.seekTo(startTime);
    handle.play();
  }, [startTime]);

  const handleTick = useCallback(
    (time: number) => {
      if (endTime != null && time >= endTime) {
        playerRef.current?.pause();
      }
    },
    [endTime],
  );

  if (startTime == null) return null;

  if (!mounted) {
    return (
      <Button type="button" variant="outline" size="sm" onClick={() => setMounted(true)}>
        Play clip
      </Button>
    );
  }

  return (
    <div>
      <div className="aspect-video w-full max-w-xs overflow-hidden rounded-md bg-black">
        <YouTubePlayer
          ref={playerRef}
          videoId={videoId}
          className="h-full w-full"
          onReady={seekAndPlay}
          onTick={handleTick}
        />
      </div>
      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={seekAndPlay}>
        Replay clip
      </Button>
    </div>
  );
}
