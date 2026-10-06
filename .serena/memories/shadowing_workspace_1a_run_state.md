# Shadowing workspace Part 1a — run state mirror (2026-10-02, MERGED)

Canonical: `docs/superpowers/run-state/shadowing-workspace-1a.md` (now on master). This file only points there.

## Where things stand
- **MERGED to master `9f032ca`** on 2026-10-02 with the owner's approval. The branch tip was `4535786`; the branch
  and its worktree are kept. Not pushed (the owner pushes master by hand).
- T0–T12 are done, each with its own review, plus a whole-branch review and its fixes.
- After the owner's Chrome look:
  - `34983a5`: the control bar lies over the video, the whole PiP is draggable, and the PiP bar is one row.
  - `4535786`: the re-review nits.
- YouTube's own controls stay ON. With `controls=0`, an unmuted `playVideo()` was refused (measured in live A/B
  runs).
- Last gates: vitest 434 files / 3963 tests, det e2e 16/16, live Ep.729 2/2 (max 19.7 ms).

## Session end (2026-10-02)
- Branch: an `-s ours` merge absorbed the leaked WIP push `1a2a08a`. The tree is unchanged. The branch is ahead 3,
  behind 0.
- Master `13e9ab9` commits the owner's Korume assets (43 files). Master is ahead 37 of origin, waiting for the
  owner's push.

## Next (owner's choice)
- Part 1b: the intelligence layer (Utility Drawer, Analysis popover, Vocabulary / Grammar / AI explanation, the ✨
  action).
- Part 2: Pronunciation mode in the workspace. The mode bar appears once this second mode exists.
- Old debts: the settings-page whole-branch review, the mobile landing page (2 owner questions open),
  `EMAIL_PROVIDER`, Layer 8.
- Small: the video is black until the first play. This was already true before this branch.

## Tools
- Seed Ep.729: `npx vite-node --config vitest.config.ts scripts/seed-real-lesson.ts -- --dir "C:/Users/tplon/Desktop/Japan/Korume/shadowing" --youtube Fwj3tH4Uls8` (uuid `f885cf07-d6f5-4e01-b38c-236008b2a0a3`).
- Live e2e: build, then `npx next start -p 3000` in a worktree, then `EP729_VIDEO_ID=<uuid> npm run test:e2e:live`.
