/**
 * Korume's reaction to a practice result (owner 2026-11-03): a teasing best friend from a comedy anime. Strong
 * feelings, always cute: praise like a friend, scolding that makes the learner laugh and try again, never harsh.
 * The strongest poses (cry, tantrum) need a run of misses on one sentence, so they stay rare.
 *
 * Pure: the caller keeps the page visit's log (one entry per Check / Show answer, oldest first) and passes the
 * log BEFORE the result being judged; it appends `entry` afterwards.
 */
export type KorumeMood =
  | "ace" | "smug" | "hype" | "proud" | "comeback" | "giggle" | "laugh" | "improved" | "close" | "focus"
  | "sulk" | "tantrum" | "dizzy" | "cry" | "shock" | "peek" | "furious";

/** perfect = right with no help; helped = right with help; partial = anything less; revealed = Show answer. */
export type MoodOutcome = "perfect" | "helped" | "partial" | "revealed";
export interface MoodEntry { line: string; outcome: MoodOutcome; score: number | null }
export interface MoodResult { mood: KorumeMood; streak: number; turn: number }

const MISS: ReadonlySet<MoodOutcome> = new Set(["partial", "revealed"]);

function trailing<T>(items: readonly T[], test: (item: T) => boolean): number {
  let n = 0;
  for (let i = items.length - 1; i >= 0 && test(items[i] as T); i--) n++;
  return n;
}

/**
 * `close`: a partial score the mode calls nearly there. `extraOnly`: the only mistake was extra typed characters.
 * `turn` is the log length: it picks between a mood's quips, so the same moment does not repeat word for word.
 */
export function korumeMood(log: readonly MoodEntry[], entry: MoodEntry, { close = false, extraOnly = false } = {}): MoodResult {
  const onLine = log.filter((e) => e.line === entry.line);
  const misses = trailing(onLine, (e) => MISS.has(e.outcome));
  const prevScore = [...onLine].reverse().find((e) => e.score !== null)?.score ?? null;
  const streak = entry.outcome === "perfect" ? trailing(log, (e) => e.outcome === "perfect") + 1 : 0;
  const [older, newer] = log.flatMap((e) => e.score === null ? [] : [e.score]).slice(-2);
  // Weaker and weaker: two earlier results in a row each better than the next, ending with this one.
  const declining = entry.score !== null && older !== undefined && newer !== undefined && older > newer && newer > entry.score;
  const result = (mood: KorumeMood): MoodResult => ({ mood, streak, turn: log.length });

  switch (entry.outcome) {
    case "revealed": return result(onLine.length === 0 ? "furious" : "peek");
    case "helped": return result("giggle");
    case "perfect":
      if (misses > 0) return result("comeback");
      return result(streak >= 5 ? "proud" : streak >= 3 ? "hype" : streak === 2 ? "smug" : "ace");
    case "partial": {
      const score = entry.score ?? 0;
      const dropped = prevScore !== null && score < prevScore;
      if (score === 0) return result("shock");
      if (misses >= 4) return result("cry");
      if (dropped) return result(misses >= 2 ? "tantrum" : "sulk");
      if (declining) return result("sulk");
      if (misses >= 2) return result("dizzy");
      if (prevScore !== null && score > prevScore) return result("improved");
      if (extraOnly) return result("laugh");
      return result(close ? "close" : "focus");
    }
  }
}
