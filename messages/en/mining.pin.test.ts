import { describe, expect, it } from "vitest";
import en from "./mining.json";

/**
 * Characterization test for `mining.json` (Task 12): a literal `toBe` pin for
 * every `mining.*` leaf, copied verbatim from the pre-extraction source of
 * `components/video-player/mine-line-control.tsx`,
 * `components/video-player/mining-deck-list.tsx`,
 * `components/video-player/mining-clip-player.tsx`,
 * `components/video-player/mining-review-session.tsx`,
 * `app/[locale]/(app)/mining/page.tsx`, and
 * `app/[locale]/(app)/mining/review/page.tsx` on
 * `layer-9a-string-extraction` before Task 12 (never derived from the catalog
 * itself — binding pattern 2). `toHaveTextContent` given a string is a
 * CONTAINMENT match, not equality, so this file's job — distinct from the RTL
 * wiring tests — is to pin every leaf byte-exact.
 */
describe("mining.json EN — mining/page.tsx + mining-deck-list.tsx", () => {
  it("pins the deck page heading and Review link", () => {
    expect(en.deck.title).toBe("Mining deck");
    expect(en.deck.review).toBe("Review");
  });

  it("pins the empty-deck message, including its literal double quotes around \"Mine\"", () => {
    expect(en.deck.empty).toBe(
      "No mined sentences yet. While shadowing a video, tap \"Mine\" on a transcript line to add one.",
    );
  });
});

describe("mining.json EN — mining-clip-player.tsx", () => {
  it("pins the Play clip / Replay clip button labels", () => {
    expect(en.clip.play).toBe("Play clip");
    expect(en.clip.replay).toBe("Replay clip");
  });
});

describe("mining.json EN — mine-line-control.tsx", () => {
  it("pins the Mine trigger button", () => {
    expect(en.mine.trigger).toBe("Mine");
  });

  it("pins the popover's accessible group label and sr-only field label", () => {
    expect(en.mine.a11y.pickWord).toBe("Pick a word to mine");
    expect(en.mine.a11y.wordLabel).toBe("Word to mine");
  });

  it("pins the manual-entry placeholder and Add button", () => {
    expect(en.mine.placeholder).toBe("Type a word");
    expect(en.mine.add).toBe("Add");
  });

  it("pins the success message with its {word} argument", () => {
    expect(en.mine.added).toBe('Added "{word}" to your mining deck.');
  });

  it("pins the 429 rate-limit messages, with and without Retry-After", () => {
    expect(en.mine.rateLimited).toBe(
      "Too many cards — please wait {seconds}s and try again.",
    );
    expect(en.mine.rateLimitedGeneric).toBe(
      "Too many cards — please wait a moment and try again.",
    );
  });

  it("pins the shared add-failure message", () => {
    expect(en.mine.error).toBe("Couldn't add that word. Please try again.");
  });
});

describe("mining.json EN — mining-review-session.tsx + mining/review/page.tsx", () => {
  it("pins the review page heading", () => {
    expect(en.review.title).toBe("Mining review");
  });

  it("pins the empty-queue message and its Back to deck link", () => {
    expect(en.review.empty).toBe("Nothing due — mine some sentences!");
    expect(en.review.backToDeck).toBe("Back to deck");
  });

  it("pins the reviewed-count plural (mining-specific copy — NOT common.srs.reviewedCount's item(s) wording)", () => {
    expect(en.review.reviewedCount).toBe(
      "{count, plural, one {You reviewed {count} sentence.} other {You reviewed {count} sentences.}}",
    );
  });
});
