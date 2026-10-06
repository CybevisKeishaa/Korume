# Ask Korume — ⭐ MERGED to master `ea456b8` (2026-10-03)

Branch `ask-korume`, worktree `.worktrees/ask-korume`, HEAD `a9931f5`. The authoritative run state is
`docs/superpowers/run-state/ask-korume.md` ON THE BRANCH — read it first.

- Spec `docs/superpowers/specs/2026-10-03-ask-korume-design.md` (locked `bafeea6`, §6.2 amended: Shadowing sheet is
  a floating POPUP, owner ruling 2026-10-03; `/korume/chat` stays full screen); plan
  `docs/superpowers/plans/2026-10-03-ask-korume.md` (approved `9f1bd85`; Corrections 1–11 binding).
- Committed: T1 `8fa52de`, T2 `a5164f6`, T3 `69c1fc7`, T4 `b91a2d8`, T5 `c954628`, T6 `9c8f466`, T7 `dda295d`,
  T8 `fc7c76f`, T9 `77bb454`, T10a `397a18c` (chat page), T10b `4678871` (/sensei redirect + persona sweep),
  T11 part 1 `6f12fc6` (popup + Playwright 6/6), whole-branch review fixes `309b40b`, owner-look changes `54d7aae` + slimmer chat bars `a9931f5`
  (Enlarge mode with Learning context rail; Open full chat creates the thread first; /korume/chat fits one
  viewport with internal scroll; auto-scroll to newest turn). HEAD after run-state commit on top.
- Whole-branch review DONE: 3 findings fixed (stored grounding vs read schema; intro anchor for mascot/k; chunked
  id read in exposure tool). vitest 513 files / 4569 tests; tsc, lint, verify:protocol 0.
- MERGED: owner approved after the Chrome look; `--no-ff` merge `ea456b8` (not pushed; owner pushes). The live
  Gemini smoke `KORUME_LIVE=1` was never run — still needs the owner's go-ahead.
- Open follow-ups: M5 free-chat URL does not follow the new thread; m3 focus on body after ⋯ thread switch;
  selection-span anchor e2e; 4 landing-page e2e timeouts not compared with master.
- Chrome demo: worktree `next start` on :3000 (rebuilt at `309b40b`); local DB was reset by e2e, so a demo account
  `demo.korume@example.com` / `password123` was seeded with one thread. Real lesson Ep.729 imported with
  `scripts/seed-real-lesson.ts --dir C:\Users\tplon\Desktop\Japan\Korume\shadowing --youtube Fwj3tH4Uls8`
  → video `f9f2dcc5-37f9-445b-82a3-b7821400fb43`, 282 lines (ja + vi); demo thread anchored on its line 3.
  A db reset wipes it; re-run the script.
- Codex via Paseo: `& $env:PASEO_CLI run --provider codex --model gpt-5.6-terra --mode auto-review` from PowerShell.
  Codex never commits, never runs Playwright. `db reset` approved on this branch.
- Migrations are edited in place (AGENTS.md §6): ledger in 038/040, companion_enabled in 033; new files 041, 042.
