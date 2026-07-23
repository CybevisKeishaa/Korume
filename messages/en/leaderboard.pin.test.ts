import { describe, expect, it } from "vitest";
import en from "./leaderboard.json";

/**
 * Characterization test for `leaderboard.json` (Task 16): a literal `toBe`
 * pin for every `leaderboard.*` leaf, copied verbatim from the
 * pre-extraction source of `app/[locale]/(app)/leaderboard/page.tsx` and
 * `components/community/{leaderboard-board,leaderboard-opt-in-toggle}.tsx`
 * on `layer-9a-string-extraction` before Task 16 (never derived from the
 * catalog itself — binding pattern 2).
 *
 * `optIn.question`/`optIn.explanation` are a PRIVACY surface (G2,
 * docs/product/business-model.md §1.1): the pin proves the EN consent copy
 * states exactly what becomes visible ("name and weekly XP", "to other
 * users") — `messages/vi/leaderboard.json` must match that scope precisely,
 * never softened or broadened.
 */
describe("leaderboard.json EN — leaderboard/page.tsx", () => {
  it("pins the heading and subtitle", () => {
    expect(en.page.heading).toBe("Leaderboard");
    expect(en.page.subtitle).toBe(
      "A weekly snapshot of your progress, and (if you opt in) how you compare with other learners.",
    );
  });
});

describe("leaderboard.json EN — leaderboard-board.tsx", () => {
  it("pins the 'Your week' section: heading, XP-this-week suffix, and zero-XP nudge", () => {
    expect(en.board.yourWeekHeading).toBe("Your week");
    expect(en.board.xpThisWeek).toBe("XP this week");
    expect(en.board.zeroXp).toBe("Study something this week to start earning XP.");
  });

  it("pins the rank template and the not-opted-in fallback", () => {
    expect(en.board.rank).toBe("Rank {rank}");
    expect(en.board.notOptedInRank).toBe("Opt in to see your rank among other learners.");
  });

  it("pins the community section heading, its empty state, and the deleted-user fallback", () => {
    expect(en.board.communityHeading).toBe("This week's top learners");
    expect(en.board.empty).toBe("No one has opted in yet — opt in above to be the first to appear.");
    expect(en.board.deletedUser).toBe("Deleted user");
  });

  it("pins the '(you)' row marker and the 'XP' suffix", () => {
    expect(en.board.youSuffix).toBe("(you)");
    expect(en.board.xpSuffix).toBe("XP");
  });
});

describe("leaderboard.json EN — leaderboard-opt-in-toggle.tsx (privacy surface)", () => {
  it("pins the checkbox's accessible label and the consent question, byte-identical", () => {
    expect(en.optIn.ariaLabel).toBe("Appear on the leaderboard");
    expect(en.optIn.question).toBe("Appear on the leaderboard?");
  });

  it("pins the consent explanation exactly: WHAT (name + weekly XP) and WHO (other users) — the precise scope being agreed to", () => {
    expect(en.optIn.explanation).toBe("Your name and weekly XP will be visible to other users.");
  });

  it("pins the rate-limit (short generic form) and update-error messages", () => {
    expect(en.optIn.tooManyWithSeconds).toBe("Too many requests — try again in {seconds}s.");
    expect(en.optIn.tooManyGeneric).toBe("Too many requests — please wait a moment.");
    expect(en.optIn.updateError).toBe("Couldn't update that — please try again.");
  });
});
