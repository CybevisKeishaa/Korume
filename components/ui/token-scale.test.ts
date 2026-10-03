import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rule #0 (spec §2): pixel values in Figma are not an API. A primitive that
 * hardcodes `text-[12px]` has copied a number instead of mapping a role, and
 * every screen that imitates the primitive inherits the mistake.
 *
 * Only ABSOLUTE literals are forbidden. Arbitrary values that express a
 * relationship are fine and deliberately allowed: CSS custom properties
 * (min-w-[--radix-select-trigger-width]), viewport units (h-[80vh]), calc(),
 * and percentages. The distinction is the whole point of the rule.
 *
 * Exceptions require an inline comment saying why no token can express the
 * value — see spec §7. Deleting this test is not an exception.
 */
/** Named, because a scope below enforces this rule alone. A positional index
 *  into FORBIDDEN would silently start enforcing a different rule the moment
 *  a pattern is inserted above it. */
const RADIUS_LITERAL = /\brounded(-[a-z]+)?-\[[\d.]+(px|rem|em)\]/; // rounded-[22px] → rounded-lg

/** A Tailwind default type utility where a rung already exists. `text-sm` IS
 *  `--text-body` (0.875rem) and `text-xs` IS `--text-caption` (0.75rem): two
 *  names for one value means a token change moves some call sites and not
 *  others, which is how the density defect survived a whole branch — changing
 *  the token moved 8 of 40 sites.
 *
 *  `text-base` (16 = body-lg), `text-xl` (20 = heading) and `text-2xl`
 *  (24 = heading-lg) are the same defect and are listed too (whole-branch
 *  review M3). `text-lg` (18), `text-3xl` and up have no rung of their own,
 *  and banning a utility with no replacement only teaches people to escape
 *  it — which is what `text-[8px]` in a screen port already was. */
const DEFAULT_TYPE_UTILITY = /\btext-(sm|xs|base|xl|2xl)\b/;

const FORBIDDEN = [
  /\btext-\[[\d.]+(px|rem|em)\]/, // text-[12px] → text-caption
  /\b[pm][trblxy]?-\[[\d.]+(px|rem|em)\]/, // p-[10px] → p-sm
  /\bgap(-[xy])?-\[[\d.]+(px|rem|em)\]/, // gap-[6px] → gap-xs
  RADIUS_LITERAL,
  /\bleading-\[[\d.]+(px|rem|em)\]/, // leading-[18px] → a paired token
  /\bshadow-\[[^\]]*#/, // shadow-[0_0_12px_#FF8A3D] → shadow-raised
] as const;

// Scanned directories. `components/marketing` was added for the landing-page
// port (spec §2 of the screen-port workflow design): it is the largest body
// of new presentational code in the repo and must be held to the same rule
// as components/ui.
//
// `sources` is a STATE PIN, not a fact about the design: it is the file count
// each scan must reach, so that a scan which silently stops walking cannot
// pass by finding nothing. Bump it, in its own commit, when a directory
// legitimately gains or loses a source — and when you bump it, say which file
// moved. A count that drifts silently is the same defect as a scan that sees
// nothing.
const SCANNED_DIRS = [
  { dir: "components/ui", rules: FORBIDDEN, sources: 18 },
  { dir: "components/marketing", rules: FORBIDDEN, sources: 25 },
  // The typography consolidation (2026-09-21 density-scale spec, ruling 3.4)
  // gives these three trees one source of truth per rung. They get the FULL
  // rule set, not just radius: a tree that may not write `text-sm` but may
  // still write `text-[8px]` has not been given one source of truth, it has
  // been given a detour. `explore-lesson-card.tsx` had taken that detour four
  // times over before this scope was widened.
  { dir: "components/shadowing", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 24 },
  // Task 4b: shell, mode body, context, playback store, and controller hook.
  // Task 5: + player-adapter.ts and use-progress-persistence.ts.
  // Task 6a: + playback-root, workspace-player, player-glyphs, progress-bar, beat-markers,
  // sentence-loop-control, speed-control. Task 6b: + live-sentence, ruby-sentence.
  // Task 7: + transcript-panel, transcript-row, use-auto-follow.
  // Task 8: + workspace-header, lesson-bookmark-button, workspace-overflow-menu, mode-nav.
  // Task 10: + reading-settings-popover, study-environment-popover, shortcut-hints-popover, atmosphere-layer.
  // Part 1b Task 10: + drawer/drawer-context, drawer/drawer-header, drawer/drawer-separator, drawer/utility-drawer.
  // Part 1b Task 11: + selection-popover, use-line-analysis, drawer/word-card, drawer/phrase-card.
  // Part 1b Task 12: + drawer/vocabulary-tab.
  // Part 1b Task 13: + drawer/notes-context, drawer/notes-tab, drawer/grammar-tab, drawer/mining-tab.
  // Part 1b Task 14: + drawer/ai-knowledge-context, drawer/ai-tab, drawer/ai-section, drawer/ai-usage, drawer/section-renderers.
  // Part 1b reframe: - drawer/phrase-card, vocabulary-tab, grammar-tab and the five Task 14 AI files; + drawer/inspector.
  { dir: "components/shadowing-workspace", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 42 },
  { dir: "components/layout", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 9 },
  // Part 1b Task 12: + kanji-quick-inspect.
  { dir: "components/kanji", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 2 },
  // Ask Korume's shared chat core (Task 8): every viewport renders through it.
  { dir: "components/korume", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 7 },
  { dir: "app/[locale]/(protected)/(app)/shadowing", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 2 },
  { dir: "app/[locale]/(protected)/(app)/pronunciation", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 4 },
  // Task 4b: the workspace route group only; dictation stays outside this scope.
  { dir: "app/[locale]/(protected)/(focus)/shadowing/[id]/(workspace)", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 2 },
  // The Shadowing Hub renders into this tree and the first pass missed it:
  // hub-import-section imports VideoImportForm, and both it and
  // hub-library-section import LessonCreationProgress. A calibration screen
  // whose import card still sets a duplicate rung is not consolidated, so the
  // scan has to follow the second hop, not just the page's own imports.
  { dir: "components/video", rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY], sources: 4 },
];

function collectSources(dir: string, root: string = dir): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSources(fullPath, root));
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes(".test.")) {
      files.push(path.relative(root, fullPath));
    }
  }
  return files;
}

describe("Rule #0 — semantic tokens are the API (spec §2)", () => {
  for (const { dir: scannedDir, rules, sources: expectedSourceCount } of SCANNED_DIRS) {
    const dir = path.join(process.cwd(), scannedDir);
    const sources = collectSources(dir);

    it(`reaches every one of the ${scannedDir} sources it claims to scan`, () => {
      expect(sources.length).toBeGreaterThan(0);
      expect(sources).toHaveLength(expectedSourceCount);
    });

    it.each(sources)(`${scannedDir}/%s hardcodes no absolute px/rem literal`, (file) => {
      const text = readFileSync(path.join(dir, file), "utf8");
      const hits = rules.filter((pattern) => pattern.test(text));
      expect(hits).toEqual([]);
    });
  }

  // The three sites outside components/ui that already violated the rule
  // before it existed. Pinned individually so that fixing them cannot silently
  // regress, without widening the scan to all of components/** (spec §7).
  it.each([
    "components/layout/notification-bell.tsx",
    "components/learning/badges-grid.tsx",
  ])("%s uses no arbitrary font size", (file) => {
    const text = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(/\btext-\[[\d.]+(px|rem|em)\]/.test(text)).toBe(false);
  });
});
