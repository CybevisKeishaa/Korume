# practice-listening (B2 Listening Practice) — run state

Updated 2026-10-23 (session 3). Branch `practice-listening`, worktree `.worktrees/practice-listening`, base master
`5c076987`. NOT merged; no merge before the owner's Chrome check and approval.

## ▶ 2026-10-31 session 12 (latest) — resume from the LEDGER's last lines
- Ledger `.worktrees/practice-listening/.superpowers/sdd/2026-10-26-listening-two-exercises/progress.md` is the
  source of truth (sessions 10–11 are only there). Tasks 1–13 complete. Ultra review #1 on PR #1 (owner pushed the
  branch; repo too big for a bare `/code-review ultra`): U2–U5 fixed `73cec782` + `ce7c5757` (sonnet review approved),
  U1 = Task 15. Case 22 red since Task 12 (toggle row).
- Owner rulings L1/L2/S1/Q1: chunker v3 keeps Latin runs, character cut v4 fallback (digit run = one piece), placed
  pieces fill the stars in chosen order. Spec `docs/superpowers/specs/2026-10-31-listening-latin-and-character-pieces-design.md`
  (`d08f83b2`, builder-checked twice); plan `docs/superpowers/plans/2026-10-31-listening-latin-and-character-pieces.md`
  (`eeafd533`, Tasks A1–A3 before Task 14).
- ▶ NEXT: owner reviews the A1–A3 plan → A1 → A2 → A3 (controller Chrome trial first) → Task 14 → 15 → 16.

## 2026-10-28 session 9: Task 8 complete, Task 1 decided (dock V3), Task 9 dispatched
- Task 8 fix review clean -> "Task 8: complete". Task 1 trialled in the owner's Chrome (maximized, dpr 1.25 -> measured
  in a same-origin 1280x529 iframe on lesson b78ce634 line 272): owner picked (d) -> dock V3: practice full width +
  in-flow docked control bar that absorbs the ReplayRow (Nghe lại câu / Lặp / 0.75x 1x), neutral progress fill, no
  CC/fullscreen/-5s/popovers in the dock. Ruling T1 + root cause of the hover glitch (auto-hiding overlay bar) in the
  ledger. Task 9 implemented: commit `bcce6e15` (tip, tree clean), DONE_WITH_CONCERNS, vitest 6412, E2E 22/23 x2
  (case 6 = known T5->T15 Summary ZodError). STOPPED by the owner after the task. ▶ NEXT: package
  `review-ad2800f8..bcce6e15.diff`, dispatch the Task 9 review; then real-YouTube audio check with the collapsed dock
  iframe in Chrome; then Task 10. Ledger "SESSION 9 STOP" has the concern list (owner calls: Chế độ dễ toggle drops
  work without confirm; listen-only tab order header->dock->panel; draft copy in task-9-report.md).

## 2026-10-27 session 8: P1 done, Task 8 approved, fix round 1 uncommitted at stop
- Ruling P1 DONE: owner DB pg_dumped (`.superpowers/sdd/2026-10-26-listening-two-exercises/p1-owner-048.dump`, restore
  with pg_restore --clean), then ONLY 049 applied via `npx supabase migration up` from the worktree. 351 legacy rows
  byte-identical, word_bank easy_mode true. **Owner DB is now at 049.**
- Task 8 (word pieces: tap/drag/Alt+Arrow, selection removed) committed `d0f7ab67`, independent review APPROVED
  (0 Critical/Important). E2E 16/17 x2; case 6 fails at Summary (wordBankMean NaN) = accepted 049→Task 15 transient.
- Fix round 1 (7 cheap minors: marker clamp to hinted prefix, drop index from the event, Alt+Arrow on bank chips,
  aria-keyshortcuts, trimEnd before …, dead glyph, case 16 title, lint log) landed `ad2800f8` (tip, tree clean,
  vitest 6396).
- ▶ NEXT: dispatch the fix review on `review-d0f7ab67..ad2800f8.diff` → Task 8 complete; Task 1 Chrome trial
  (extension connected) → Task 9.
- Owner FYI: master's Summary reader still expects `dictationMean` (gone since 048) → master Summary mismatches the
  owner DB until merge; 31 old `e2e-ws-*` fixture videos (10-14, 10-22, 2000-01-01) remain in the owner DB, untouched.
- Env: Git Bash `docker exec` paths need `MSYS_NO_PATHCONV=1`.

## 2026-10-27 session 7: EXECUTING the two-exercises plan, stopped at a clean point
- Plan `docs/superpowers/plans/2026-10-26-listening-two-exercises.md`, subagent-driven. Ledger (source of truth):
  `.worktrees/practice-listening/.superpowers/sdd/2026-10-26-listening-two-exercises/progress.md`; read its
  "SESSION 7 STOP" block first.
- Tasks 2–7 complete (independent review each), tip `57d7cfc4`, tree clean. Task 1 (owner Chrome trial) not run.
- Owner installed `wanakana@5.3.1` by hand (npm install was denied to agents). Migration 049 is committed and proven
  on disposable DBs only. AGENTS.md §6 was amended on the branch (additive migrations from 049); the owner must OK it.
- ▶ NEXT: (1) pg_dump the owner DB, apply ONLY 049 once (Ruling P1), with the owner present and Docker on;
  (2) Task 8, whose packet names the E2E typing→dictation edits; (3) Task 1 before Task 9.

## 2026-10-26 session 6: brainstorm DONE, spec + new plan written, waiting for owner plan review
- Owner direction: Listening = picker ("Bạn muốn luyện nghe theo cách nào?") → **Chép chính tả** (typing; star
  mask, tap a star = reveal one char (hint unit grapheme1), 💡 = whole sentence = revealed; Chế độ dễ = word pieces =
  helped) / **Điền từ** (cloze: ≤3 blanks, nouns + unconjugated verbs/adjectives, 泣いて never, 勉強して → 勉強;
  easy chips = helped; kana or kanji accepted; 💡 kana char hints). Dropped: "Số câu/lượt", ⟳. Refs are features
  only — Korume DNA, Korume speaks the result, own colours. Chip rail with hover scrollbar. Drafts kept per
  line+format for the page visit (Claude's call). Korume nudges after help from real data, no judging.
- Owner decisions: Summary = 2 independent rows (+ self-done count); missions count both (distinct lines, submitted);
  weekly skill/weakness = unhelped typing only; `wanakana` allowed (pinned).
- Spec `docs/superpowers/specs/2026-10-26-listening-cloze-dictation-design.md` (`69037d58`, builder-checked).
  Plan `docs/superpowers/plans/2026-10-26-listening-two-exercises.md` (`6bf7ce3e`, 16 tasks; old WP plan marked
  SUPERSEDED). Migration 049 (cloze cols, easy_mode, grapheme1, `dictation_attempt_helped`, consumers rewritten)
  only on disposable `listening_t1_*` DBs.
- ▶ RESUME: owner reviews the plan; execution subagent-driven (owner's earlier choice — confirm); start at Task 1
  (Chrome trial of the hidden-video look). No product code before approval.

## 2026-10-26 session 5: Task 1 PAUSED, new owner references → brainstorm first
- Owner said "Chạy task 1". Built + served the branch on :3001 (stopped again). Chrome extension was not connected,
  so no CSS trial ran. Owner, in Chrome: "there is no full-transcript button" (right: that button is in Shadowing's
  transcript header; Listening conceals the transcript, so (b) would only reuse the restyle).
- **New direction from the owner:** reference images `C:\Users\tplon\Desktop\Japan\Korume\image\ref\` (listening.png,
  when-click-che-do-de.png, when-bam-phien-am.png, when-bam-ban-dich.png, when-bam-check-dap-an.png). Owner: besides
  typing (tự điền chữ) and tap-to-fill (nhấn để điền = Word Bank) add a third mode **"Điền từ" = fill the missing
  words (cloze)**; owner likes that layout, Claude may adapt it to Korume DNA. What the refs show:
  - Header: title "Điền từ", subtitles icon button, counter "1/194", thin progress bar.
  - Toolbar: "Ẩn video" (eye-off), "Phím tắt" (shortcuts), right "Chế độ dễ" toggle (filled green when on).
  - "CÂU" label + a row of numbered sentence chips with ‹ › paging (current = filled green).
  - Card: the sentence with inline blank boxes (みなさん[ ]、[ ]です。). Easy mode shows the missing words as chips
    under it (エマー, こんにちは) to tap in. Optional lines: romaji ("minasan konnichiha , emaa desu .", T toggle)
    and Vietnamese translation (文A toggle, tooltip "Bản dịch"). Card footer: left bulb (hint) + eye ("Xem đáp án");
    right speaker, translation, romaji toggles.
  - Bottom bar: "Nghe lại", a swap/refresh icon, big green "Kiểm tra", "Câu tiếp ›".
  - Correct: card turns mint, blanks filled (teal outline), bar shows "Làm lại" + big green "Chính xác! Làm tốt lắm".
- Status: brainstorming (superpowers:brainstorming) started; nothing built, spec/plan not changed. First question
  asked, UNANSWERED: "what level / moment is Điền từ for, and what does it give that Typing and Word Bank don't?"
- Open questions for the brainstorm (Claude's list, not asked yet): which words get blanked and how many; does the
  new layout cover all three modes; does it replace the word-pieces drag design (spec 2026-10-23) and the Figma
  123:2835 composition built in 9c; "Ẩn video" in the toolbar answers where the listen-only switch sits — and how
  hidden looks is still open (Task 1 trial); numbered navigator vs today's prev/next; is romaji available in the
  data; "Chế độ dễ" (chips) vs Word Bank overlap; what the swap/refresh icon does.
- ▶ RESUME: continue the brainstorm (re-ask the open question), then update spec → plan; Task 1 trial only if the
  hidden-video look is still undecided. Do not start plan Tasks 2–8.
- Env this session: Docker Desktop restart left Supabase **Kong** exited (127) — its bind mount points into the
  removed `.worktrees/practice-pronunciation` and Docker made an empty DIR at
  `supabase/templates/confirmation.html`. Fixed narrowly: copied master's template there, `docker start
  supabase_kong_nihongo-cinema`. Studio mounts `…/practice-pronunciation/supabase/snippets` too. Clean fix
  (`npx supabase stop` + `npx supabase start` from the main checkout; data kept) offered to the owner, not done.

## 2026-10-23 session 4
- Task 9c done for its narrowed scope: 0665d585 (Figma composition) + 51c8e452 (compact message files) + 4d0dfd3d (fix
  round 1: rate name, Replay test, visible slots, divider). Review finding I1 (stale selection) left open on purpose.
- Owner then asked for word pieces (お/店/を/検索/…/けど。), drag-to-insert + tap-to-remove, video visible by default
  with a remembered "Chỉ nghe" headphones switch (tooltip), stat strip in the frame's bar look, Typing ignoring ♪ 〜 → ※.
  Design `docs/superpowers/specs/2026-10-23-listening-word-pieces-design.md` (92f6767d, owner-approved direction
  after 3 review passes + 2 builder checks). Plan `docs/superpowers/plans/2026-10-23-listening-word-pieces.md`
  (tip f81483c2, 8 tasks). I1 closes only via plan Task 5. After plan Task 8 → B2 plan Task 10.
- Owner decisions end of session 4: execution = **SUBAGENT-DRIVEN** (implementer + independent reviewer + tests +
  mutations per task, whole-branch review, owner Chrome look before merge). Owner fixes already in the plan: hinted
  prefix also leaves the LCS reference (A/B/A test); wb_fixed / ty_fewer only within same line+format+chunker
  version+textHash.
- ▶ RESUME NEXT SESSION AT PLAN TASK 1 (owner approved it): Chrome trial of how "Chỉ nghe" hides the video —
  evaluate (a) collapse the video to the control bar in place FIRST, then (b) reuse Shadowing's full-transcript
  re-layout (`#workspace-player-pane`, workspace-shell.tsx:238), (c) today's cover only as fallback; measure at
  1280×529 with an 8-piece and the 20-piece line; iframe never display:none; same player, position, sentence,
  controls. Send screenshots; owner picks before Task 6. No product code in Task 1.
- Tasks 2–8 start only after the owner has read the PLAN FILE itself (they had reviewed only the spec) — give them the
  path `docs/superpowers/plans/2026-10-23-listening-word-pieces.md` and wait for their go.
- Measured: 494 Word Bank-eligible lines, median 8 tokens, p95 13, max 20 → no piece cap.
- Env: Docker must be on (owner starts it); serve the branch on :3001 from the worktree (`npx next build`, then
  `npx next start -p 3001`), stop it before any Playwright run (shared .next).

## Where it stood before session 4
- Tasks 1–9 complete (independent review each). Tip `3d75c269`. Task 9 = `7afe4891` (mode on, E2E, redirects,
  legacy page delete) + `07de0cfb` (DictationView + `dictation` namespace retired) + `3d75c269` (fix round 1, R41).
- 2026-10-23 owner Chrome look: the Listening panel does NOT follow Figma 123:2835 (composition). Gap table +
  owner rulings (tap selects + Remove Selected Word button; headphones dropped) in
  `.superpowers/sdd/2026-10-21-practice-listening/task-9c-figma-gaps.md`.
- NEXT (next session, owner said so): **Task 9c Figma composition pass** — design context on 123:2835, CSS trial in
  the owner's Chrome first, then brief/implementer/review; THEN Task 10 (gates incl. G4 typography, Chrome per R33,
  whole-branch review, owner look).
- To show the owner the branch: `npx next start -p 3001` from the worktree (build in .next), open
  localhost:3001/vi/shadowing; stop it after.
- Ledger `.superpowers/sdd/2026-10-21-practice-listening/progress.md` (rulings R1–R41, deferred minors).

## Environment notes for Task 10
- Playwright: run `--workers=2` with `AI_PROVIDER=none` (worktree .env.local sets gemini; summary.spec needs none).
  At 4–8 workers a fresh server stalls (root cause unknown, also in untouched specs) — reviewer judged environmental.
- `next build` can miss the 120s webServer timeout on a Google Fonts ECONNRESET: build separately, serve, stop.
- Docker Desktop may be off at session start: owner starts it; check `docker ps` + :3000/:3999 free (R37: never
  reuse/kill a :3000 server you did not start).

## Rulings this session
R38 case 3b replaces "Try again while POST held"; R39 mutation (a) stays GREEN (setState-during-render, stale key
never commits; uncatchable), fallback RED; R40 e2e fixtures cleaned only via fixtures; R41 fix round for case 1
concealment on mode-bar entry + case 6 figure gone after reveal + Next, drop serial.

## Owner directives
- Use ponytail in every dispatch; lessons block (L-051/52/53, L-044, L-004, L-019, L-025) in every brief; a denied
  command is reported, never re-routed through another tool.
- Never reset or mutate the owner's DB (at 048); DB gates only on disposable `listening_t1_*` (R35). Mutations must
  go RED; `.mutbak`.
- Build/serve only in the worktree.

## Open for the owner (Chrome look / calls)
- VI copy: format names (R26), P14 feedback strings, Task 7/8 strings; VI `review.reason.dictation` "Nghe chép" also
  labels weak Word Bank lines.
- Study-time surface "dictation" has no emitter now; Listening time logs as "shadowing" — intended?
- Hint takes the lowest unhinted chunk even if placed (D10); hint line joins units with a space; empty hint live
  region gap; hint position + key guard in the input (no E2E positive control); Korume size clamp / 20rem hide
  point; PracticePanel size container (check Pronunciation too); YouTube native captions after the cover lifts.
- Whole-branch review: dead `current &&` guard listening-reveal-context.tsx:40-41; screen-inventory.md still lists
  /dictation (dated snapshot).
