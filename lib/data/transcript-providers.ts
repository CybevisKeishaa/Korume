import "server-only";
import { fetchJapaneseCaptions } from "@/lib/youtube";

export interface ProviderTranscriptLine {
  startTime: number;
  endTime: number;
  textJp: string;
  textTranslation: string | null;
}

export interface ProviderTranscriptResult {
  source: "youtube_caption" | "ai_generated";
  lines: ProviderTranscriptLine[];
}

/**
 * A source of transcript lines for a YouTube video ID. `fetch` resolves to
 * `null` when no transcript is available from this provider — never throws;
 * `lib/data/lesson-creation.ts` treats `null` as "try the next provider, or
 * report no-transcript-found if this was the last one."
 */
export interface TranscriptProvider {
  fetch(videoId: string): Promise<ProviderTranscriptResult | null>;
}

export const youtubeCaptionProvider: TranscriptProvider = {
  async fetch(videoId: string): Promise<ProviderTranscriptResult | null> {
    const lines = await fetchJapaneseCaptions(videoId);
    if (!lines) return null;
    return {
      source: "youtube_caption",
      lines: lines.map((line) => ({ ...line, textTranslation: null })),
    };
  },
};

/**
 * STUB. Real AI transcript generation (Plus-only, spec §2.1 step 6 / §3.3)
 * needs a way to get the video's audio to a speech-to-text backend, which is
 * a gray area against CLAUDE.md §2's "never download video from YouTube"
 * rule and was deliberately NOT resolved when this plan was written
 * (2026-07-31) — see this plan's "Decisions locked" section. This stub keeps
 * the call shape `lib/data/lesson-creation.ts` needs stable so a real
 * implementation is a drop-in replacement, not an architecture change.
 */
export const aiTranscriptProvider: {
  fetch(videoId: string): Promise<{ ok: false; status: 501 }>;
} = {
  async fetch(_videoId: string) {
    return { ok: false, status: 501 };
  },
};
