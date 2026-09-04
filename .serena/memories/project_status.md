# Korume (was Nihongo Cinema) — Project Status

Read this first each session. Product spec: `japanese-learning-app-spec.md` (**repo root** — moved
in from the parent folder and put under version control 2026-07-16; old references say `../`);
root rules: `CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## ✅ L9a Plans 1/3 AND 2/3 COMPLETE — both MERGED to master (Plan 1 `69f22e6`, Plan 2 `fcd35af`, 2026-07-18)

**Plan 2 (design system) merged `fcd35af` --no-ff same day** — full token system + semantic
colour tiers + 8 Radix/in-house primitives + living style guide `/[locale]/admin/style-guide`
+ enforcement tests (P8 lint fire-tested, §8 logical-properties scan, token contract,
middleware-composition guard). Post-merge: tsc 0 · **1293/1293 (174 files)**. Manual
style-guide browser pass STILL OWED (checklist in `mem:l9a_localization_run_state`).
Plan-1 details below unchanged:
**Branch `layer-9a-localization-architecture` merged & local branch deleted (user chose merge).
NOT pushed (origin/layer-9a-... still holds a stale pre-finish tip — prune when pushing).
Post-merge verify on master: tsc 0, 1229/1229.** All 8 tasks done + task-reviewed; final whole-branch review (opus):
READY TO MERGE = YES, 0 Critical/Important. Shipped: `lib/i18n/**` foundation (next-intl 4.13.2,
vi/en, prefix "always"), `app/`→`app/[locale]/`, Supabase-first middleware composition, locale-
stripped route protection + security matrix, all feature code on `@/lib/i18n/navigation`, ESLint
boundary (merged with AI-SDK guard, fire-tests). Zero user-visible change (shell still EN).
Baseline @ ceb7445: **unit 1229/162 files · build 52s · playwright 2/2 37s · tsc 0 · lint 0**.
Plans 2 (design system) & 3 (extraction + VN) both UNBLOCKED, not yet written.
**→ Load-bearing constructs, reuse patterns, and review-assigned follow-ups: `mem:l9a_localization_run_state`. READ THAT before Plans 2/3 or touching middleware/i18n.**
Spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`;
plan `docs/superpowers/plans/2026-07-17-l9a-localization-architecture.md`;
SDD ledger `.superpowers/sdd/progress.md` (gitignored, richer per-task detail).

## ▶ NEXT ACTION (updated 2026-09-05, session 10) — **⏸️ WORK IS IN FLIGHT ON `landing-page-motion-doctrine`, PAUSED AT THE OWNER'S REQUEST.** A per-section motion system for the landing page: spec and plan are written and committed, Phase 0 (the engine) is complete, and Task 4 of 12 is one re-review short of done. **18 commits off master `faa2cfd`; nothing merged, nothing pushed, master untouched.** ⚠️ **Read `mem:landing_page_motion_doctrine_run_state` FIRST — it is the authority**, and it opens with the one thing to check before anything else: a reviewer was mid-mutation when the session stopped, so `components/marketing/recommendation-donut.tsx` may still hold a `data-familiar-arc-DISABLED` marker that must be edited back (never `git restore`). That memory carries the eight rulings taken on the owner's behalf, the four "green while measuring nothing" incidents, and the two times SVG behaved differently in a browser than on paper. The spec (`docs/superpowers/specs/2026-09-04-landing-page-motion-doctrine-design.md`) and plan (`docs/superpowers/plans/2026-09-04-landing-page-motion-doctrine.md`) travel with the repo and win over any memory. ▶ **The pre-existing candidate queue below is untouched and still valid for whenever this branch closes** — Layer 8 (PayOS billing, the last unbuilt layer, which inherits the deletion-must-cancel-PayOS-first dependency), the owner's mobile landing page (still blocked on its two questions), and `EMAIL_PROVIDER=none` on `almostgone.vn` (an OPS task no commit here can close).

<details><summary>(superseded 2026-09-05) the 2026-09-04 block — "the landing page is merged, pick the next piece of work"</summary>

## ▶ NEXT ACTION (updated 2026-09-04, session 9) — **⭐ THE LANDING PAGE IS MERGED TO MASTER (`9c0fec2`, `--no-ff`) AND MASTER IS GREEN. The branch is closed; pick the next piece of work.** `landing-page-port` is KEPT per repo convention (not deleted), and **nothing is pushed** — local `master` runs 103 commits ahead of `origin/master` (`988bb97`), which is this repo's normal state (`L-021`); do NOT `git pull` on master, it would merge a stale remote into a local branch that leads it. Merged-master gate, each command run and read on `9c0fec2`: `npx tsc --noEmit` 0 · `npm run lint` **0 errors / 81 warnings** · `npm test` **2617 over 283 files, exit 0** · `npm run build` exit 0. The merge brought in 156 files, +21431/-600. ⚠️ **Two tests flake under parallel load** — `components/video-player/pitch-contour.test.tsx` and `waveform.test.tsx`, both `expected 0 to be greater than 0` on canvas call counts after decoding an audio blob. Named and excluded three ways (standalone 14/14 ×4; full re-run 2617/2617; `waveform` is untouched by the merged branch yet shows the identical signature, so the cause is shared and environmental). **Re-run before believing either**, and always `npm test -- --reporter=dot > <file>` so a failure has a name. ⚠️ **Do NOT record `playwright 27/27` without local Supabase running**: five specs (auth-locale-round-trip · journal · review · route-group-provider-identity ×2) fail with `ECONNREFUSED 127.0.0.1:54321`; none touches the landing page. ▶ **WHAT TO PICK UP NEXT — nothing is in flight, the tree is clean, choose one:** (1) **Layer 8**, the last unbuilt layer — PayOS billing, animation polish, the performance audit (`.claude/docs/workflow.md` §3); ⚠️ it inherits a hard dependency: account deletion currently drops the `subscriptions` row like any other, and L8 must cancel with PayOS *first*. (2) **The owner's mobile landing page** (Figma `429:2` / `433:728`) — large, and **two questions must be answered before any of it is built** (do its five extra sections go on desktop too, and what do the menu rows point at); see `mem:landing_page_port_run_state`. (3) **`EMAIL_PROVIDER=none` in `almostgone.vn`'s production `.env`** — the only deploy blocker, and an OPS task no commit in this repo can close. ▶ The full record of the landing-page branch — what shipped, the rulings that still bind, what is still owed to the owner, and the method rules it paid for — is `mem:landing_page_port_run_state`; sessions 1-6 are in `mem:landing_page_port_archive` (grep it, do not open it whole).

</details>

✅ **`landing-page-identity-ruling` MERGED to master at `2822d22` (`--no-ff`), 2026-08-26; branch kept
per repo convention.** Count its commits with
`git rev-list --count 988bb97..landing-page-identity-ruling` (`L-002`). It closed the one open
decision Phase 3 left — frame `347:6277` is the design for `/` — converted the `landing-page` row to
`kind: "screen"`, left `dashboard` at `/dashboard` unrenamed as the same ruling directed, and fixed
the claims the ruling made false (the registry header's frame-map invariant, G2's per-date pin,
`346:6275` recorded as "decorative canvas noise", two mis-read section descriptions in
`figma-frame-map.md`, and `P16`/§19.0 in the two product-authority docs).
Two reviews ran: whole-branch (`L-011`) → 0 correctness bugs, 10 prose defects; review of that wave
(`L-012`) → 10 more, **three created by the wave itself**. Both waves landed.
**Merged-master gate, measured on `2822d22`:** tsc 0 · `next lint` 0 errors · **262 files / 2368
tests** · `next build` exit 0 · the registry's frame-map invariant recipe re-run and holding
(mapped-but-unregistered = the six first-capture exclusions + `335:1588`; reverse empty).
Playwright deliberately not run — no `app/` route and no rendered component was touched.

**▶ The landing page at `/` is PORTED; what is live now is reviewing it — see the block above.**
**Read `mem:landing_page_port_archive` first** — it holds the resume block, the authority map, the
six rulings not to re-litigate, and the process notes. Then **read
`docs/product/landing-page-reconciliation.md` — it is the authority** and this block must not restate
it. In one line: build `347:6277`'s structure to `346:6275`'s visual bar, keeping the frame's footer
and its "A quieter way to keep going." section, which the user ruled authoritative.
✅ **The image-LICENSING question is RULED (user, 2026-08-26): the imagery is AI-generated, so there
is none.** Do not re-escalate it, and do not cite `CLAUDE.md` §2.3 at it — §2.3 is scoped to study
content, not marketing imagery.
✅ **The photographs are DELIVERED — this is no longer owed.** Every `AssetSlot` call site passes
`src` and the files sit in `public/marketing/`, so the pending branch is unreached on `/`. They
arrived across **2026-08-28 to 2026-09-01**, not on one day; the record is `git log
--diff-filter=A --date=short -- public/marketing/` and no date is restated here. Re-derive the call
sites rather than trusting this line — it returns 6:
`grep -rl "<AssetSlot" components/marketing --include="*.tsx" | grep -v asset-slot` against
`ls public/marketing/`. The `AssetSlot` boundary is why it landed cheaply — one `src` prop at one
call site, no layout change — and it stays for the next surface that needs one. The reference's own
images were never usable as sources (they exist only as pixels inside one flat PNG at capture
resolution); what shipped is generated per the recorded per-slot descriptions, provenance in
`progress.md` per spec §5.2. The reconciliation doc's §5 is the home for this; do not restate it here.

**Where execution stands is the NEXT ACTION block at the top of this file, and nowhere else.** The 2026-09-02 paragraph that used to sit here — the one naming an independent render-capable review of `19b05d5..HEAD` as the live next action, with unit 2564/280 and Playwright 23/23 — is **superseded**: that review ran, its fixes landed, and Task 13 and Task A-MOTION were built after it. It is moved to the superseded section at the end of this file rather than kept here, because two blocks each calling themselves the live next action is the defect `CLAUDE.md` §6 names.

⚠️ **Two decisions are waiting on the owner**, neither blocking: §1's transport bar lacks the
reference's timestamp and four control glyphs (adding them means choosing which affordances to
depict), and its Key Words list has two entries against the reference's three (a third needs a new
catalog key, and the catalog is the owner's).

The spec is `81a20c9` (`docs/superpowers/specs/2026-08-27-landing-page-port-design.md`) and the plan
`docs/superpowers/plans/2026-08-27-landing-page-port.md`, which now carries Task V beside Task 13. **Five more user rulings
landed that day** — Blender mascot renders rejected, nav destinations, the footer link rule, §2's six
chip sub-labels (the frame repeats one placeholder six times, a defect the reconciliation doc never
named), and who writes the Vietnamese copy. **Read `mem:landing_page_port_archive`** for all of it,
plus two measurements that replaced assumptions and the process notes; this block must not restate
them.

**L9b Plan 1 (GDPR data deletion) is DONE and MERGED to master at `4b1fef7`** (merge commit,
2026-08-22; the branch `l9b-plan1-gdpr` is kept, per this repo's convention). All 13 tasks built and
reviewed, the whole-branch review (`L-011`) run, its single fix wave landed and re-reviewed clean, and
the merged master verified green (tsc 0, 257 files / 2327 tests). GDPR was the `CLAUDE.md` §2
non-negotiable owed since Layer 1; it is now paid.
**Read `mem:l9b_plan1_gdpr_run_state` — it is the authority on what shipped and what it still owes.
This block must not restate it.**

Phase 0 is COMPLETE AND CLOSED and **Screen Registry Phases 1a, 1b, 2a and 2b are all built and
merged** (2b at `10caaac`; its two debts closed 2026-08-19 at `a371a4b`).

⭐ **Screen Registry Phase 3 — ✅ MERGED to master at `f6f7e95` (`--no-ff`), 2026-08-25. CLOSED.**
Branch `screen-registry-phase-3` kept (repo convention); commit range `8865aed..5be3aa0` (count with
`git rev-list --count 8865aed..5be3aa0`). Stage 1 shipped the type change, the five test changes and
the 2026-08-23 frame batch; Stage 2 closed at zero rows; a whole-branch review (`L-011`) and then a
review of its fix wave (`L-012`) both ran, the second catching a defect the wave itself created.
**The gate figures and the command to re-measure them live in the run-state memory only** — not
restated here (`CLAUDE.md` §6), because a second copy would age independently.
**Read `mem:screen_registry_phase_3_run_state` — it is the authority. This block carries a one-line
gist only and must not duplicate that memory's evidence or its reasoning.**
In one line: `spec-only` is now a `ScreenKind` and `specRef` the 13th field, so the registry can record
a destination the spec requires that has neither a Figma frame nor an implementation — turning it from
a Figma map into a product-surface ↔ design ↔ implementation map.
**Stage 2's discovery pass RAN on 2026-08-25 and the user ruled it: ZERO `spec-only` rows.** Do not
re-run it and do not hunt for rows to add. Why the pass ended at zero, which candidate reached the
user, and what rejected it are **in the spec's §6.7** — deliberately not repeated here, because a
second copy of that reasoning is what the header above forbids and what a later reader would then
have to reconcile.
**Phase 3 is merged and closed.** It left one open decision, which was ruled and merged on
2026-08-26 and merged to master at `2822d22` — **do not read this block as "pick from the
candidates below"**; the NEXT ACTION block at the top of this file governs. Read the run-state
memory's ▶▶ RESUME block for Phase 3's own sequence and merged-master gate.
✅ **Phase 3's one open decision is CLOSED (user, 2026-08-26): frame `347:6277` IS the design for
`/`.** The `landing-page` row converted to `kind: "screen"` on branch `landing-page-identity-ruling`
(`a9ad897`, merged to master at `2822d22` on 2026-08-26 — an older note here said "NOT yet
merged", which stopped being true that same day). The authenticated home **stays
`dashboard` at `/dashboard`**: the user declined a `/home` rename in the same ruling. Authority is the
spec's §9.1; this line is the gist, not a second copy.
The GitHub sign-in button was previously listed alongside it and **should not have been** — that one
is ruled by `decision-register.md` **P14** ("Auth = email + Google + Apple. GitHub: no"), confirmed
still standing by the user 2026-08-25; the frame's content simply loses to P14 at port time.

**⭐ `feat/email-notification-system` MERGED to master `8865aed`, 2026-08-23** (branch kept; merged
master verified green: tsc 0, 262 files / 2366 tests). Closed both of L9b's "two product decisions"
bullet plus built the general-purpose `lib/email/*` provider-agnostic email port the user asked for
(mirrors `lib/ai/*`). **Full detail: `mem:l9b_plan1_gdpr_run_state` § Owed — read that before
touching `lib/email`, `lib/contact.ts`, or `deleteDialog.support` again.** ⚠️ **Deploy consequence,
not yet done: `EMAIL_PROVIDER` is now a required boot-time env var** (no real transport chosen yet)
— `almostgone.vn`'s production `.env` needs `EMAIL_PROVIDER=none` added before the NEXT deploy, or
the instance fails to boot.

**The candidate queue, none started, in no fixed order.** ▶ **As of the landing-page merge
(2026-09-04) nothing is in flight, so this list IS what is next** — the NEXT ACTION block at the top
names the three it considers strongest and this is the fuller set:
- **Layer 8** — PayOS billing, animation polish, the performance audit. It is the last unbuilt layer
  (`.claude/docs/workflow.md` §3). ⚠️ It inherits a hard dependency: deletion currently removes the
  `subscriptions` row like any other, and L8 must cancel with PayOS *first*.
- **A real production email transport (SMTP/Resend/etc.)** for `lib/email`'s `EMAIL_PROVIDER` —
  the port and the `console` (dev/test) adapter are built on `feat/email-notification-system`; no
  production adapter exists yet, so deletion-requested notifications only ever log to the server
  console until this is picked up. Needs a provider decision from the user first.
- **Two scoped follow-ups L9b sized deliberately so nobody re-derives them:** wiring the voice
  pronunciation score to its column (the client scores *after* the message POST and never learns the
  row id, so it needs the POST to return that id plus an endpoint to attach a score); and a
  repo-wide fix for `components/ui/dialog.tsx`, which restores focus blindly to a trigger that may
  have become disabled or unmounted while the dialog was open.
- **A DB-backed regression guard for RLS and column grants** — still owed, and L9b is the third
  branch to prove grant claims by hand (`L-005`).
- **Figma re-capture** — see below.

Four rulings from 2026-08-20 (the 7-day window vs the modal's "cannot be undone", the two deletion
tiers, the AI-training split, `/settings/privacy`) were made against two Figma frames Phase 0 never
saw. Do not re-litigate them, or decisions 2–3.

✅ **Figma re-capture pass 1 DONE 2026-08-23**: the 12 frames flagged missing on 2026-08-20 (plus
`218:15740`, never screenshotted before) are now captured and reviewed — auth flow, Layer 8
billing UI, error-state system, and a new marketing homepage. **Read `mem:figma_recapture_2026_08_23_run_state`
first.** Its payment-provider question is RULED: PayOS-only stands for now (`CLAUDE.md` §3
unchanged — it was `decision-register.md` **P13** all along, re-affirmed 2026-08-25, and there is now
a note against P13 recording the rationale); when Layer 8 is built, shape the payment code as a
provider-agnostic port from day one (mirrors `lib/ai`/`lib/email`) but ship only the PayOS adapter —
SePay/MoMo are deferred (complex merchant registration). ✅ **The registry now knows about these
frames** — Screen Registry Phase 3 Stage 1 registered the batch (see the Phase 3 block above). The
one row whose `figmaCheckedAt` still overstates comparison is `login`/`65:2`, deliberately left at
`2026-08-12` because nobody re-compared it.

**⚠️ Standing instruction that survives all of the above: do NOT settle navbar/routes/registry without
the user's review.** ("Do not port any screen yet" is retired — the IA is locked and the registry
exists, so porting is ordinary work now rather than something to block on.)

<details><summary>(superseded 2026-08-19) the 2026-08-12 block — "the IA proposal is BLOCKED on 5 answers from the user"</summary>

⚠️ **All five questions below were answered, and every stage downstream of them has since shipped.**
Kept only as the record of what Phase 0 delivered. This block sat in the file's "read this first"
region long after it stopped being true, which is `L-026` exactly: a resume document is code for the
next session.

**Read `mem:phase0_figma_inventory_run_state` § "▶▶ RESUME HERE" first — it is the authority.**

**Delivered 2026-08-12, all committed to master (working tree clean, last commit `5dfe498`):**
- `docs/product/screen-inventory.md` — **all 57 Figma frames read and analysed**, Part II §6–§19,
  ~1,900 lines, committed cluster by cluster. **§20 lists 10 content conflicts for the user to fix in
  Figma.**
- `docs/product/capability-map.md` — the aggregation: **12 capability areas**, the **six cross-cutting
  systems**, §3's four IA blockers, §4's rules for building the IA proposal.
- `docs/product/figma-frame-map.md` — name → node id, post-rename and read back from Figma.

**⛔ The IA proposal must not start until the user answers:**
1. `AI Sensei` vs the Companion — one intelligent presence or two?
2. One canonical **skill taxonomy** — three conflicting sets exist today.
3. **`Journey`** — the nav label points at the Diary; the design means the Roadmap.
4. **Both kanji surfaces** (discovery + curriculum) or one?
5. **Model choice** — policy requires asking before IA synthesis. **Recommendation on record: stay on
   Opus 5, no Fable** (the hard reasoning is already written down across the 8 clusters).

Then: propose IA → **STOP for the user's review** → lock IA → Screen Registry Phase 1 →
route/API reconciliation → UI implementation → L8 → L9.

**⚠️ Standing instructions: do NOT port any screen yet, and do NOT settle navbar/routes/registry
without the user's review.**

</details>

### The six cross-cutting systems the inventory found (this is the headline result)
A capability sighted in 3+ independent modules is **not a feature of any of them**:
**Learning Intelligence** (6 sightings) · **Companion presence** (all modules) · **save & collect /
mining** (6) · **pitch accent** (4) · **provenance-attached claims** (3+) · **progress narrative** (3).
**None of them may take a nav row** — they surface *inside* destinations.

### Method corrections that now bind all downstream work
- **Four layers, never collapsed:** A product intent · B UX representation · C implementation ·
  D constraint. A contradiction exists only when B is mistaken for C.
- **B splits:** **B-design is authoritative; B-content may be wrong** (report it).
- **⭐ Layer C is NOT a baseline.** The backend was built for a smaller product — a designed capability
  with no endpoint means *the design is larger*, never that the design is wrong. Do not phrase findings
  as "conflicts with the API".
- **Layer D still binds absolutely** (`CLAUDE.md` §2).
- **Never infer a frame's identity from its name** — the picture corrected four names this run.

<details><summary>(superseded 2026-08-12) the instruction that started this stage — Phase 0: Figma Product Inventory, Do NOT start Screen Registry Phase 1</summary>

## ▶ Superseded NEXT ACTION blocks — moved out 2026-09-03

### The 2026-09-02 "where execution actually stands" block (superseded 2026-09-04)

Kept verbatim because it records figures measured at that point; every one of them has since moved.

> **Where execution actually stands (2026-09-02, superseding the 2026-08-27 note this block used to
> carry):** branch `landing-page-port` off master, **nothing merged, nothing pushed**, and the page is
> BUILT — tasks 1–7, A1/A2/A3, P, 8–11, **12** (page composition, `--layout-marketing-max`) and
> **Task V** (visual fidelity) are all committed. Unit **2564 over 280 files**, tsc 0, lint 0,
> **Playwright 23/23**.
> 
> ▶ **The live next action is an independent RENDER-CAPABLE review of `19b05d5..HEAD`.** Two ranges
> need one: task 12's review was run by the lineage that built it, and Task V has had no review at
> all. Use `general-purpose`, not `code-reviewer` — the latter is code-only and every finding here is
> visual. After that: **Task A-MOTION**, **Task 13** (⚠️ re-measure the 320/390/768 overflow rather
> than trusting any recorded number — Task V did not touch the construct it comes from), the
> whole-branch review, and the branch-end `docs/lessons.md` pass (**six** queued entries).

Three of them (Phase 0 2026-08-11 · the screen-port workflow merge · the Figma token/typography
foundation) already labelled themselves historical/done/superseded and were 25% of this file.
They are in `mem:project_status_archive`, verbatim, under "Superseded NEXT ACTION blocks".
Nothing was deleted — this file is the live index, and a live index that is a quarter dead reads
slower every session.

## ⭐ L9b DECOMPOSITION — user-approved 2026-07-24 (4 sequential plans, brainstormed on Fable)
L9b was too large for one spec, so it was split. Order and rationale:
1. **Plan 1 — launch-blocker debt:** transcript-submit UI (backlog #14, CRITICAL — core loop dead-ends
   without it, scope pivoted to auto-fetch not user-paste) + GDPR delete-my-data (backlog #5, §2
   non-negotiable, owed since L1, now a 3-stage grace-period design) + small items (#6 persist voice
   pronunciation score, #4 badge icons). **BRAINSTORM IN PROGRESS — see NEXT ACTION above, spec not
   yet written.**
2. **Plan 2 — Companion Presence** = Companion Plan 2 of 3. **DONE, merged to master `61416bd`
   2026-07-30.**
3. **Plan 3 — missing feature UIs:** dictionary meanings on tap-to-lookup (#15), "add to flashcard" from
   reading (#8), particle highlighting (#16), listening drill (#9)? — scope to be brainstormed. **NOT STARTED.**
4. **Plan 4 — landing/cinematic + tutorial + Companion Plan 3** (adaptive voice, AI reflection).
   Tutorial deliberately AFTER Companion Presence: per `MASCOT.md` the companion is the tutorial's guide.
   **NOT STARTED.** Character Identity (Spec 2 — name/lore/art) should be brainstormed right before this.
Then → **L8** (PayOS billing) → **L9c** (polish + perf audit).

<details><summary>(historical) Plan 3 mid-execution snapshot — superseded by the COMPLETE line above</summary>

**L9a Plan 3 WAS BEING EXECUTED** on branch **`layer-9a-string-extraction`** (off master @ `e5893e9`)
via `superpowers:subagent-driven-development`. Tasks 1-10 + 6b + 11a–11e + 12–15 committed/reviewed clean;
gate then: tsc 0 · 1619 tests / 196 files · lint exit 0 / 80-23 / 0 new. (Tasks 16–19 landed after this.)
</details>

**Task 15 done `49553cc` + lint-fix `07cb3fa`** (`conversation` ns — AI voice module, most error-path-heavy so
far). ONE fix wave, but it was a GATE catch not a review finding: the feature commit shipped a lint ERROR
(`no-empty-function` in a test) that the controller's own gate re-run caught (impl's "0 new" claim was false)
— fixed via SendMessage. Review itself came back 0 Critical/Important. Load-bearing SCENARIOS 3-consumer label
rewire done right (shared `scenarioLabel(t,...)` helper, fallback chain preserved). Implementer found a THIRD
convention-#4 leak (conversation-app `friendlyErrorFrom`) → `common.errors.network` now = **7 surfaces**; also
reused `common.states.loading`. Three distinct honest 503 degrade paths (STT/TTS/Claude). Detail +2 carried
Minors in `mem:l9a_localization_run_state`.

**Task 14 done `ac29966`** (`reading` ns — 39 leaves; 2nd consecutive 0-fix-wave task). Import graph clean.
**The D8 content/chrome boundary was the risk and was drawn exactly right** — reading passages, their
translations, Japanese words, and furigana are CONTENT (not localized); only chrome extracted. NEW
Convention-4 instance found & fixed (`reading-quiz` `friendlyErrorFrom` leaked raw `body.error` to a
`role="alert"` node → now logged + translated fallback). `common.errors.network` now = 5 surfaces.
**Refined getTranslations rule:** wire a translator ONLY where chrome strings actually exist — `reading/[id]/
page.tsx` is a 12-line pass-through with zero chrome, correctly left unwired (a `t` there = dead code + lint
warning). The audit's "pages fetch data → async → getTranslations" premise was factually wrong (children own
the fetch); the implementer overrode it correctly. Full detail in `mem:l9a_localization_run_state`.

**Task 13 done `763c884`** (`jlpt` ns — 81 leaves, 107-line en+vi catalogs; the FIRST 0-fix-wave task of
the run — the implementer found & closed its own 2 wiring survivors before review). Convention-#2 audit was
CLEAN (no cross-module surprise). Handled the hotspot: `lib/jlpt-ui.ts`'s `SECTION_LABELS`/`PILLAR_LABELS`
(English maps = section/pillar NAMES) DELETED, all 5 call sites rewired to `t()`. **TWO NEW standing lessons
(full text in `mem:l9a_localization_run_state`):** (a) namespace wiring is a **5-step** list — `types/messages.d.ts`
`AppConfig.Messages` also needs the namespace or tsc fails; (b) use `useTranslations` for ALL synchronous
components (even without `"use client"`, if imported by a client component `getTranslations` hard-fails);
`await getTranslations` only for genuinely-async server components. N5–N1 + "JLPT" left untranslated as required.

**Task 12 done `5dde8c8` + error-path test `4f9b473`** (`mining` ns — 4 components + 2 pages, 18 leaves
all pinned; the plan list omitted `mining-review-session.tsx` a 5TH time, controller audited it in and
patched the plan doc; that file mirrors Task 7's `review-session.tsx`, reusing `common.srs.*` +
`common.states.error`; the LAST `Error.message`→DOM defect CLOSED; 1 fix wave added the error-path RTL
assertion). **Task 11e done `1795471` + `faca02f`** (`shadowing-recorder-panel`; 41 leaves; Azure
`errorType` enum mapped via exhaustive `Record`; 1 wiring survivor 発音/リズム closed). Details in
`mem:l9a_localization_run_state`.

Commits 2026-07-22: `23a8f84` (11b `dictation`) · `36534b0` (plan-doc file-list patch) · `da41411`
(11c `shadowing` + `common.player.*`) · `9c9b3bf` (11d capture). **The user made their own commit
`3e4b4a3` "[LongTNP]: mascot" mid-run** (deleted `.docx`, added `MASCOT.md`) — those files are handled,
stop excluding them.

**NEXT: Task 13** (`jlpt` namespace) — `app/[locale]/(app)/jlpt/{page,[id]/page}.tsx`,
`app/[locale]/(app)/jlpt-test/page.tsx`, `components/jlpt/*` (~965 LOC, 10 components). Timer `aria-live`
warnings → nest under `a11y`, ICU time args identical across locales; pillar names + pass/fail copy live
here; **N5–N1 level labels NOT translated**; JLPT stays "JLPT". **AUDIT the file list + import graph FIRST
(convention #2 — the plan list has been wrong 5×, incl. Task 12's missing `mining-review-session`).** Read
`mem:l9a_localization_run_state` top "⭐⭐ STANDING CONVENTIONS" block first.

**Task 11 was SPLIT into 11a-11e** (plan commit `087b342`) after measuring it at 3793 LOC = 6.9x Task 10.
11a–11e ✅ (Task 11 DONE) · 12 ✅ `5dde8c8`+`4f9b473` (`mining`). **Tasks 13-19 + a metadata sweep (Task 18)
remain**. Namespaces so far: `common`, `nav`, `auth`, `marketing`, `dashboard`, `kanji`, `vocab`, `grammar`,
`videos`, `dictation`, `shadowing`, `mining`, `jlpt`, `reading`, `conversation` (15 done).

**⚠ The plan's file lists have now been wrong FOUR times, and 11d's miss crossed MODULES:** translating
the `useRecorder` hook broke 13 tests in `components/conversation/` because `voice-recorder-button.tsx`
consumes it and no list mentioned that. **Grep the IMPORT GRAPH of whatever you translate, not just the
directory you were handed.**
The 2026-07-20 pause is long resolved (the Task 5 draft was verified in place and kept).
**Before resuming, read `mem:l9a_localization_run_state` "▶ Plan 3 EXECUTION IN PROGRESS" FIRST** —
it holds the patterns Tasks 9-19 must follow (two were Critical review findings), the three things
Tasks 6/6b/7/8 settled, the review lesson about mutation-testing pins, the backlog items no task
owns, and the debugging gotchas. Then the SDD ledger `.superpowers/sdd/progress.md` (gitignored;
reconstruct from `git log` if lost), which carries the per-task detail and the carry-forward defects.

**Cadence that is working (keep it):** one fresh implementer subagent per task (sonnet) → an
independent code-review (opus) → one fix wave → controller marks complete. Every task so far needed
exactly one fix wave and every finding was a real defect, not polish. The reviews have been worth
more than the implementations: the three highest-value catches of the run all came from reviewers
and all were invisible to a green test suite (ICU `#` silently reformatting 1234 → "1,234"; no
Vietnamese message ever being ICU-parsed in CI; raw `Error.message` reaching the DOM and making the
translated error string unreachable).
**SIX STANDING CONVENTIONS, binding for Tasks 13–19 (user-codified after Tasks 11–12, 2026-07-22) — full
text in `mem:l9a_localization_run_state` top block "⭐⭐ STANDING CONVENTIONS", put ALL in every implementer
AND reviewer brief:** (1) mutation in TWO layers → `docs/lessons.md` L-007; (2) audit the DEPENDENCY GRAPH
not the plan → `docs/lessons.md` L-023; (3) swap-proof render assertion for TYPE-INTERCHANGEABLE values →
`docs/lessons.md` L-008; (4) server-authored diagnostics NEVER reach the DOM — **defect class CLOSED after
Task 12** (5 instances all fixed; apply the rule to any NEW instance the audit finds, don't hunt); (5) Task
19 exit criterion — re-audit `common.*` consumer counts by surface (demote `common.player.*` to
`shadowing.*` if still single-surface); (6) proportionality → `docs/lessons.md` L-014. The original two are
(1)+(5B): (A) mutation's two-class separate-survivor-count reporting rule → `docs/lessons.md` L-007.
(B) When promoting into `common.*`, **record the actual consumer count, naming the unit** — importing
FILES vs consuming SURFACES differ, and P4 tests MODULES. Measured: `common.player.*` = 3 files but
**1 surface** (demotion candidate); `common.errors.network` = **2 consumers**, NOT the 28-places/8-modules
figure, which counts un-migrated raw English literals (a backlog, not consumers).

**Two ROADMAP additions decided during execution:**
1. **Task 6b (inserted, done)** — `lib/i18n/catalog.test.ts` now parses every message in every
   locale as a real ICU AST instead of matching regexes.
2. **A metadata sweep task (not yet written)** — 25 pages carry `export const metadata` in English;
   the user chose one dedicated task near the end over doing it piecemeal. **Module tasks LEAVE
   metadata in English.**

## ⭐ ROADMAP SEQUENCING — decided 2026-07-16 (read before choosing what to build next)
**User launch philosophy (explicit):** still in BUILD phase; publish ONLY after everything is
complete, polished, and fully-featured. There is NO near-term launch, paid-beta, or revenue goal.
This resolves the "L8 vs finish-L9" question decisively:

**Order = finish L9 first, do L8 (billing) near the very end, right before publish:**
1. **L9a — i18n + design system** (foundation; VN-first, replace English shell). Unblocks EVERYTHING
   visual + Companion Plans 2/3. Split into 3 plans: **Plan 1 localization architecture = ✅ DONE,
   MERGED `69f22e6` 2026-07-18** (see block above + `mem:l9a_localization_run_state`); **Plan 2
   design system = ✅ DONE, MERGED `fcd35af` 2026-07-18** (plan doc w/ execution addendum:
   `docs/superpowers/plans/2026-07-18-l9a-design-system.md`); **Plan 3 string extraction
   EN-verbatim + Vietnamese (spec Phase 2/3) — NOT WRITTEN, THE LAST L9a PLAN**. ←
   **NEXT ACTION: see ▶ NEXT ACTION block above (manual style-guide pass, then write Plan 3).**
2. **L9b — surfaces**: Companion Plan 2 → Plan 3, the missing feature UIs, landing/cinematic, tutorial.
   Fold the two launch-blocker debts in here (they count as "fully-featured"): **user transcript-submit
   UI** (backend done since L3, UI missing = core loop dead-ends) and **GDPR delete-my-data** (§2
   non-negotiable, owed since L1). Companion Plans 2/3 are HARD-BLOCKED on L9a.
3. **L8 — billing (PayOS)**: subscription + Founding price-lock + per-user Knowledge-Gen quota + auto
   kill-switch + Contextual Discovery UI nhúng vào L9b surfaces. Deferred to here because its conversion
   mechanism needs surfaces to exist, and cost-defense isn't urgent while AI is off in prod.
4. **L9c — polish + perf audit** on the final UI (why L9c was split out).

**HARD CONSTRAINT that overrides the order:** L8's per-user quota + auto kill-switch MUST land BEFORE
`ANTHROPIC_API_KEY` is added / AI is enabled for anyone (even mid-build end-to-end testing with other
people) — today only a manual ~$1-2 spend-cap exists. Reasoning behind all of the above is in this
session's discussion; flip to L8-first ONLY if the goal changes to open-paid/AI-to-real-users-soon.

## Stack
Next.js **14.2.35** App Router + TS strict + Tailwind. React **18.3.1**. Supabase
(Postgres + Auth + Storage) via `@supabase/ssr`. Zod. Motion: Lenis + Framer + GSAP.
AI: `@anthropic-ai/sdk` 0.111.0. Tests: Vitest+RTL (unit), Playwright (`tests/e2e`). Staying on
**Next 14** (revisit L8; don't silently bump — see `nextjs-14-pin-decision`).
**Fonts (since `86328bc`, five roles via `next/font/google`):** `--font-sans` Plus Jakarta Sans ·
`--font-display` Be Vietnam Pro · `--font-serif` Noto Serif · `--font-mono` IBM Plex Mono ·
`--font-jp` Noto Sans JP. **Only sans + jp preload**; the other three are `preload: false` +
`display:"swap"`. Outfit / Noto Serif JP / DM Mono were REJECTED — none has a `vietnamese` subset and
they had been assigned the headings and the Companion Diary prose in a VN-first app. `--font-jp`
stays a sans because it carries furigana at very small sizes, where mincho serifs break first.
⚠️ **`subsets: ["latin"]` does NOT suppress CJK** — Noto Sans JP still emits 373 unicode-range
`@font-face` rules and the browser fetches the needed slice. Verified in-browser. Also: **width
comparison cannot detect CJK fallback** (both real and fallback render full-width at exactly 1em) —
inspect `@font-face` unicode-ranges instead.

## Branching policy (user-set)
One branch per layer `layer-<n>-<slug>` off master; merge `--no-ff` ONLY after DoD (tests pass +
code-reviewer sign-off); never push unless asked. History: L1 `1d1628e`, L2 `618e1a4`,
L3 `d6c2138`, L4 `63b965f`, L5 `74514cd`, L6 `3fe741b`, L7 `01ae59d`, Spec A `201a9b4`,
Companion Core `9f09cf2`, L9a-Plan1 `69f22e6`, L9a-Plan2 `fcd35af`, L9a-Plan3 `d7b158c`,
Design-docs reconciliation `20d6eed`, Shadowing Hub Lesson Workspace Plan A `a6a7617` / Plan B
`b36c455`, Shadowing Practice Figma reconciliation `b56bba1`, Korume rebrand Plan A `69c4685` /
Plan B `44521bc`, Figma token + typography foundation `86328bc`, Screen-port workflow `7277ac1`
(2026-08-07), Shadowing Hub Plan C1 `bd7f574` (2026-08-08), Lessons Registry `88c1301` (2026-08-11),
Screen Registry Phase 1a `fff90fa` / 1b `6f67dd1` (2026-08-13) / 2a `e767537` / 2b `10caaac`
(2026-08-14), **certification grants hardening `a371a4b` (2026-08-19)**.
⚠️ This list went five merges stale before 2026-08-19 — every screen-registry phase was missing.
Re-derive it rather than trusting it: `git log --oneline --merges master`.

## Progress
**The layer-by-layer build log for L1–L7 lives in `mem:project_status_archive`** — it is a
completed-work record, not something a session needs in full. L1–L7 are all DONE and merged;
branch SHAs are in § Branching policy above. Only L8 (PayOS billing) and L9c (polish/perf) remain
unbuilt from the original 8 layers — see § ROADMAP SEQUENCING for why they are last.

## Key gotchas learned
- **Table GRANTs**: migration-created tables do NOT inherit Supabase default grants → queries as
  `authenticated` failed with 42501 until `20260712000006_grants.sql`. Every NEW table needs RLS
  enabled (default-privileges auto-grant DML to authenticated → table without RLS = open hole).
- Content is versioned reference data → lives in MIGRATIONS (not seed.sql) so `db push` deploys it.
- **RLS gates ROWS, not columns.** Column control = `revoke update ... ; grant update (<col>)`.
  **Layer 7 admin approval MUST use the service-role client** (authenticated has zero UPDATE on
  videos.status/title/etc.). For shared AI content the L4 pattern: SELECT-only policy + explicit
  revoke of write grants + service-role write path.
- **⭐ Verifying a PostgREST write — the STATUS CODE is the part that lies, not the whole response.**
  A `PATCH` answers **204 whether it updated every matching row or none**. The two differ only in
  `Content-Range`, which is easy to miss: under `Prefer: return=minimal` that header reads `*/*` for
  zero rows and `0-(N-1)/*` for N. Ask for **`count=exact`** (alone, or alongside `return=minimal` —
  behaviour is identical) to get the count itself: `*/0` for zero, `0-(N-1)/N` for N. **The figure
  after the slash is the affected-row count.** Two traps, both measured 2026-08-19 on
  `certification_questions` **with the write grants and a permissive UPDATE policy temporarily
  restored** — on a clean `db reset` every variant returns 403, so the recipe reproduces nothing
  without that setup:
  (a) **ANY `PATCH` needs SELECT on the columns named in its FILTER** — not on the columns being
  written, and not on what a representation would return. This is a Postgres `UPDATE … WHERE` rule,
  not something the count preference introduces. PostgREST rejects an unfiltered UPDATE outright
  (`400 21000 "UPDATE requires a WHERE clause"`), so the requirement is never optional; with SELECT
  revoked entirely the probe returns 403 and tells you nothing.
  (b) **A `*` representation is a trap on a column-grant-restricted table.** `return=representation`
  defaults to `*`, so it answers **403 `42501`** for a *read* reason indistinguishable from a refused
  write — which is why it is the one preference that spoils the probe here. Narrow it with
  `select=<granted cols>` and the same call returns 200, which is how you tell the two apart.
  This is the canonical home for the recipe; `docs/lessons.md` L-001 carries the lesson it evidences
  and points here.
- **§2 & YouTube audio**: never extract/compare YouTube source audio; pitch reference = TTS of
  the transcript line TEXT; user contour = mic recording only.
- **Sentence mining stores NO media** (§2): card = text + `{video_id,start,end}`.
- **Azure short-audio format**: webm/opus is rejected — convert to 16kHz mono 16-bit PCM WAV
  client-side (`blobToWav16kMono`) before upload; keep stored recordings webm.
- **Claude API**: official SDK only, `claude-opus-4-8`, no temperature/top_p, `messages.parse` +
  `zodOutputFormat`, no prefills, typed error handling (RateLimitError/AuthenticationError/…).
- **Admin auth**: `users.is_admin` (DB) = source of truth; `ADMIN_EMAILS` = bootstrap-only, and
  the promotion fires ONLY inside `requireAdmin()` — any server gate for admin surfaces must call
  `requireAdmin()`, not `isAdmin()` (side-effect-free), or the first admin can never get in.
- **Consent-scoped payloads**: what a user opted into showing defines the response shape —
  leaderboard returns name/avatar/weeklyXp but NOT userId; peer-review authors never include email.
- jsdom quirks: Blob has no `arrayBuffer()` (use `@/test/blob-utils` `readBlobBytes` /
  `lib/audio/read-blob.ts`), no Web Audio (use `@/test/audio-context-mock`), no canvas 2D.
  Radix polyfills (ResizeObserver, pointer capture, scrollIntoView) live in `vitest.setup.ts`.
- **`cn()` + custom Tailwind scales (L9a-Plan2)**: `lib/utils.ts` uses `extendTailwindMerge`
  configured with every custom token scale. Plain twMerge misreads `text-body`/`text-caption`
  as COLOURS and silently strips them. **Any new scale added to tailwind.config.ts MUST also be
  added there** — `lib/utils.test.ts` is the guard. Also: dynamic class names (`shadow-${x}`)
  are never emitted by Tailwind static extraction — use literal maps.
- **Design tokens are DARK-ONLY since `86328bc`.** Values live in `:root`; there is **no
  `[data-theme]` block at all**, and `lib/design-tokens.test.ts` asserts the string is absent.
  `ThemeProvider` + `data-theme` + `components/ui/theme-toggle.tsx` are all retained on purpose, so
  light mode returns as ONE added block. The toggle is mounted only in the admin style guide.
  `color-scheme: dark` is declared in `:root` and pinned by test — without it the UA keeps rendering
  scrollbars, autofill, native `<select>`s and checkboxes in the light scheme.
- **Primitive names are `void / paper / ink / slate / ember / sand / mint / coral`** — the Japanese
  scheme (`vermilion`/`indigo`/`washi`/`sumi`) is gone, and indigo was deleted outright. Primitives
  are referenced in exactly THREE places: `app/globals.css`, `PRIMITIVE_TOKENS` in
  `lib/design-tokens.test.ts`, and `PRIMITIVE_COLORS` in `components/style-guide/token-sections.tsx`.
  A **fourth** location must stay in sync for semantics: `tailwind.config.ts`. A token present in
  three of four is the classic drift.
- **`-foreground` is for SOLID fills; `-strong` is for text on an alpha tint.** Pairing `-foreground`
  with `bg-<c>/<alpha>` is a real bug that shipped twice. And structural correctness is not enough —
  the pairing must actually measure ≥4.5:1. `--paper-50` on `--accent` is 1.98:1 and on `--danger`
  2.98:1, so **text on a warm fill is always `--ink-950`**.
- **Auditing colour usage needs MORE than one grep.** This bit twice in one branch:
  `bg-<c>/<alpha>` missed `notification-bell` (no alpha suffix), and `hover:bg-muted` missed
  `select.tsx`'s `data-[highlighted]:bg-muted` — the keyboard-nav indicator, i.e. CLAUDE.md §2 rule 5.
  Always sweep variants (`data-[…]`, `focus`, `focus-visible`, `group-hover`, `aria-*`, `peer-*`)
  AND hardcoded colours (`text-white`, `text-black`, `text-[#…]`) on solid fills.
- **`--muted` is a RECESSED surface (1.07:1 vs background), not a hover surface.** Hover uses
  `--secondary` (`--void-800`, 1.26:1). `bg-muted` as the resting colour of an unselected tab/pill
  with `hover:text-foreground` is a different, legitimate pattern — leave those alone.
- **Design-system boundaries (L9a-Plan2)**: `@radix-ui/*` imports only in `components/ui/**`
  (ESLint, fire-tested); the `components/ui/**` ESLint override RESTATES the whole
  no-restricted-imports rule minus Radix — editing one copy requires editing both. New ui
  primitives must use CSS logical properties (ps-/pe-/ms-/me-/text-start…) — auto-enforced by
  `components/ui/logical-properties.test.ts`.
- **⚠️ `EMAIL_PROVIDER` is now a required boot-time env var** (`feat/email-notification-system`,
  merged `8865aed` 2026-08-23 — see `mem:l9b_plan1_gdpr_run_state` § Owed). Only `none` and
  `console` are legal values today; `console` is REJECTED at startup when `APP_ENV=production`
  (no real transport exists yet). **`almostgone.vn`'s production `.env` does not have this set as
  of the merge** — it needs `EMAIL_PROVIDER=none` added before the next deploy, or
  `instrumentation.ts`'s `validateEnv()` aborts startup exactly like a missing `AI_PROVIDER`/
  `SPEECH_PROVIDER` would. This is a manual step on the live host no session has performed.

### CSS / DOM mechanics that have already cost this project a defect

Filed here, not in `docs/lessons.md`: that file's scope is **process**, and these are technical
facts (its § Scope sends them here). Each cost a real defect on `landing-page-port`.

- **Tailwind preflight's `[hidden]` rule is `[hidden]:where(:not([hidden="until-found"]))`.**
  `:where()` **contributes** zero specificity, so the rule weighs a single attribute selector — it
  merely TIES with any one utility class and loses on source order. The day an element carrying
  `hidden` gains `block`/`flex`/`grid`, it silently stops hiding and no test goes red. ⚠️ Do not
  restate this as "the rule has zero specificity" — that is a different and false claim (it would
  then lose to every class). Guard: `[&[hidden]]:hidden`, as `components/layout/site-menu.tsx` does.
- **⭐ A reduce-motion kill switch that collapses `animation-duration` but not `animation-delay`
  does NOT disable animation — it hides content.** `animation-fill-mode: both` holds the element at
  the keyframe's FROM value for the whole delay, so with `opacity: 0` in the `from`, a reduce-motion
  reader sees nothing for as long as the stagger runs. Found live on `landing-page-port` 2026-09-04
  (CLAUDE.md §2 r4 violation): `animationDuration: 1e-06s` beside `animationDelay: 0.09s`, element at
  opacity 0 across 12 frames / ~350ms. Both blocks in `app/globals.css` now carry
  `animation-delay: -1ms !important` and `transition-delay: 0s !important`, pinned in
  `lib/design-tokens.test.ts`. ⚠️ **Negative, not `0s`** — with a 0.001ms duration, a frame sampled
  at the animation's exact start still reads the FROM value; `-1ms` starts it already complete.
- **A `@keyframes` block with only a `to` takes its `from` from the element's LIVE computed value.**
  So a start value that lives on a rule which stops matching when the state flips is not the start
  value — the animation runs `x → x` and the element just appears. §4's contour draw shipped broken
  for one commit this way (`stroke-dashoffset: 1` on the `pending` rule only). Unit tests were green;
  only a browser probe of `getComputedStyle` mid-animation saw it. Now pinned in
  `lib/design-tokens.test.ts`.
- **A child's `transform` composes with its ancestor's, it does not replace it.** `reveal-fade`
  exists beside `reveal-rise` in `app/globals.css` for exactly this: stepped collections nest inside
  a block that already rises, and using `reveal-rise` on both gives ~48px of travel and two easing
  curves fighting each other.
- **`aria-hidden` is INHERITED.** Testing it on the element alone reported six false positives —
  walk the ancestors.
- **To find what makes a page scroll sideways, use a `Range` over TEXT NODES plus an ancestor
  `overflow-x` walk.** Filtering on `getBoundingClientRect().right` cannot see the offender, because
  text overflowing its own box does not move the box's rect; it returns a wall of irrelevant `LI`s
  inside whatever scroll container is nearby. This single mistake misdirected Task 13 across three
  sessions.

## Deploy target (user-set)
**Self-hosted at `almostgone.vn`** — a single long-running Node instance (NOT Vercel/serverless).
Consequence: `lib/rate-limit.ts` in-memory sliding-window IS a real limiter here (state persists across
requests, no per-cold-start reset) — the "per-instance / resets" caveat only bites if we later scale to
multiple instances behind a load balancer (then → Redis). Cost-defense: user runs a low Anthropic Console
spend cap (~$1–2) = a manual global kill-switch (defense layer #1); it's a monthly org budget, near-real-time
(can slightly overshoot), and blunt (all-or-nothing app-wide, not per-user) — still need per-user Knowledge-Gen
quota (L8) before opening to real users. Supersedes spec's "Deploy: Vercel". Payments = PayOS (not Stripe).

## DB / running locally
Local Supabase (Docker) is the dev DB; `.env.local` points at it. Docker Desktop must be running
(`npx supabase start`). `npm run dev` → localhost:3000. Studio :54323. `npx supabase db reset`
re-applies migrations (**15 built** — Companion migration #15 `20260716000015_companion_memories`
merged 2026-07-16). Cloud move (still not done): create free project → swap 4
`.env.local` values → `supabase link` + `supabase db push`; add Google OAuth creds in dashboard.
Env keys (AUDITED 2026-07-14, see `mem:product_readiness_audit_2026-07-14`):
`ANTHROPIC_API_KEY` **NOT in .env.local** (earlier "set" claim stale) → all Claude features
degrade to "not configured". `AZURE_SPEECH_KEY` present but **INVALID — Azure returns 401**
(value looks like a GUID/resource-ID, not Key1/Key2) → TTS/STT/pronunciation all fail (502).
`ADMIN_EMAILS="admin@almostgone.vn"` added 2026-07-14 (bootstrap admin exists locally).

## Verify commands
`npx tsc --noEmit` · `npx vitest run` · `npm run lint` — **never quote a test or file count from this
file; run the command.** (`docs/lessons.md` L-002. The figure that used to sit here went stale twice.)
The one number worth pinning is the lint debt, because it is a *comparison baseline*, not a measurement
of today: lint exits 0 with long-standing warnings, and "clean" means **0 NEW errors and an unchanged
RULE MIX** — `54 no-non-null-assertion + 23 no-unused-vars`. Compare the mix, never the total.
Last full gate on master: `88c1301`, 2026-08-11 — tsc 0, unit all green, lint mix as above.
⚠️ **With a worktree present, `npm test` from the repo root scans it too** — `vitest.config.ts`
excludes `node_modules`, `.next`, `tests/e2e` but NOT `.worktrees/`. Pass `--exclude ".worktrees/**"`
or remove the worktree first. Still not fixed in config.
⚠️ **A worktree has NO `.env.local`** — read `docs/lessons.md` L-020 before trusting any e2e run there.
`npm run build` (~52s) · `npx playwright test` (**8 e2e**, ~50s; free `:3000` first — `docs/lessons.md`
L-017) · `npx supabase db reset`
(15 migrations).

⚠️ **The e2e suite structurally CANNOT reach full green on a dev machine — this is permanent, and
"fixing" it is a mistake.** Five specs die at registration because there are no backend credentials
locally. Measured 2026-08-13 on the Phase 1a branch: **5 fail / 8 pass**, and an *identical* 5 fail /
8 pass at its branch point `e4f407a`. **Delta zero ⇒ environmental, not a regression.** Therefore:
read a local Playwright result only as a **comparison against the branch point**, never as an
absolute pass count, and never repair the environment just to make the number look nicer — the
comparison is the whole signal, and a green-by-configuration run destroys it. Record the comparison
in the branch's acceptance notes rather than treating a non-green run as a blocker. ⚠️ `tests/e2e/route-group-provider-identity.spec.ts` needs the seeded FREE-tier video
in `supabase/seed.sql`, so a fresh machine must run `db reset` before that spec can pass; nothing
wires the two together.
Known CPU-contention flakes (standalone-green): `pitch-contour.test.tsx`, `waveform.test.tsx`.
Component tests import render from **`@/test/render`** (NextIntlClientProvider, locale="en"). Shared test harness in
`test/` (`@/test/*`): media mocks, YouTube IFrame stub, Claude + Azure Speech + AudioContext
mocks, tone-buffer/transcript/URL fixtures, blob utils, `supabase-mock.ts` (chainable
query-builder mock for lib/data tests).

## Deferred follow-ups

**USER-FACING FEATURES đã hoãn nằm ở memory riêng `mem:feature_backlog_deferred` — PHẢI đọc nó
khi plan bất kỳ layer mới nào (user mandate 2026-07-14: không bỏ sót chức năng đã brainstorm).**
Mục dưới đây chỉ là engineering debt/nits.

**⭐ HARD DEPENDENCY ON L8 — PayOS cancellation before erasure (added 2026-08-20).** L9b Plan 1
builds account deletion while no billing integration exists, so it deletes the `subscriptions` row
like any other user-owned row. **When L8 lands, deletion must cancel the PayOS subscription first** —
erasing the account of someone with a live recurring charge, and keeping the charge, is the worst
shape this can take. Home of the reasoning:
`docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` §6. **L8’s spec must carry it as a
requirement**, not discover it.

**⭐ SCOPED TASK, not a nit — wire the voice-mode pronunciation score to a real caller (added
2026-08-22, user ruling).** `conversation_messages.pronunciation_score` is PREPARED end to end on the
server: accepted and range-validated at the API boundary (`lib/validation/conversation.ts`), carried
through the data-layer input type, and written on message insert (`lib/data/conversation.ts`). Those
three hooks are deliberate and must NOT be deleted as dead code — the user ruled explicitly that the
column stays prepared. What is missing is a caller, and it cannot be added without new surface: the
client scores asynchronously *after* the message POST resolves
(`components/conversation/conversation-app.tsx`) and never learns the created row's id, so at POST
time there is nothing to send. **Wiring it needs two things: the message POST must return the created
row id, and a new authenticated + rate-limited endpoint must exist to attach a score to a message the
caller owns.** L9b Plan 1 deliberately builds neither. Design notes and the reason live in
`docs/superpowers/specs/2026-08-20-l9b-plan1-gdpr-design.md` §12 and §14 — this entry is the task,
that spec is the reasoning. Natural home: whichever layer next touches voice conversation mode.

**⭐ SCOPED TASK, not a nit — a DB-backed regression guard for RLS and column grants (added
2026-08-19).** `L-005` says no mocked test can ever guard these, so the only instrument is a test
against a real Postgres. **Feasibility is proven**: on 2026-08-19 the full migration chain was applied
from zero to a local Supabase and probed as the real `authenticated`/`anon` roles over PostgREST —
ten assertions, exit 0 — which closed Phase 2b's open security debt and exposed a write-grant gap that
reading the migration had not surfaced (fixed in `20260819000028`). What does **not** exist is any
guard against a future regression. Deliberately deferred rather than bolted onto that migration: it
has to settle DB lifecycle, CI dependency, seed/reset, credentials, suite runtime, and how it skips
when Docker is absent — an architecture decision, not a fix. The assertion list to rebuild from is
enumerated in commit `74a752a`'s message. Pairs naturally with the long-standing L2 item below (CI
guard asserting RLS is enabled on all public tables), which the same harness would satisfy.

**⭐ RESIDUAL from the same run — the write-grant asymmetry is repo-wide, and only two tables were
fixed.** `20260819000028` closed it on `certification_questions`/`certification_tests`. Other public
tables still hold the same shape — `authenticated` carries INSERT/UPDATE/DELETE while no policy admits
any write — **`subscriptions` among them**. All are held shut by RLS alone, exactly as the certification
pair was: defence-in-depth missing, not an open hole. Never write the list or its size here (`L-002`);
enumerate it:
```sql
select t.table_name from information_schema.table_privileges t
 where t.grantee='authenticated' and t.table_schema='public'
   and t.privilege_type in ('INSERT','UPDATE','DELETE')
   and not exists (select 1 from pg_policies p
                    where p.schemaname='public' and p.tablename=t.table_name
                      and p.cmd in ('INSERT','UPDATE','DELETE','ALL')
                      and p.roles::text like '%authenticated%')
 group by t.table_name order by t.table_name;
```
(The `roles like` test misses a policy granted `to public`, which would also apply to `authenticated`;
none exists today and the failure direction is over-reporting, which is the safe one.) TRUNCATE is a
separate matter with its own home — see the L6 entry below, which is its one home.
From L1: GDPR delete-my-data; getUser() in middleware on all routes (perf); conditional
aria-describedby; users_update_own email/level column scope. From L2: `unique(word, reading)`
won't dedupe reading-less vocab (NULLs distinct) — matters when admin CMS adds entries; add CI
guard asserting RLS enabled on all public tables. From L3 (non-blocking nits): adaptive furigana
homograph false-hide + `Object.hasOwn`; mine popover outside-click dismiss + aria live-region;
radiogroup roving tabindex; mining duplicate-card dedup; `lib/rate-limit` unbounded map (Redis in
L8); `VideoRow` type duplication; Supabase-backed integration tests; difficulty scorer caching.
From L4 (review nits, non-blocking): persist voice-mode pronunciation score to
`conversation_messages.pronunciation_score` (column exists, deliberately unwired — best-effort
client-side only for now); human-review/publish gate for `source='ai_generated'` vocab examples
(candidate for L7 admin tools). From L5: "Add to flashcard" from reading passages is disabled —
`/api/mining` requires `lineId` FK into `transcript_lines` (video-only); generalizing the mining
schema (nullable lineId + source discriminator) is a future decision (fits F-010/F-014);
listening weakness links route to `/videos?level=` (no dedicated listening drill module yet);
site-wide i18n/VN-localization of the English shell = deliberate product decision, not per-module;
`jlpt_questions.question_type` free-form text (add check constraint if vocabulary stabilizes);
manual click-through of /jlpt + /reading in the browser not yet done (only unit/e2e-registration
coverage) — worth doing before real users. From L6: one intermittent unit-test failure observed
once (822/823, then 823/823 twice; test unidentified, reviewer found no time-fragile test in the
new code — watch for recurrence); markNotificationsRead maps DB errors to 400 (should split 500);
recommendations tokenizes ≤100 transcripts/request with no cache (revisit with catalog growth or
L3's deferred difficulty-cache); Supabase's bootstrap `pg_default_acl` (NOT
`20260712000006_grants.sql`, which grants `authenticated` only select/insert/update/delete and grants
`anon` nothing — its `grant all … to service_role` is a separate matter) gives **both `authenticated` AND `anon`** TRUNCATE/REFERENCES/TRIGGER on every public
table — count them, never quote a figure. **RLS does not gate TRUNCATE**, so "RLS holds it shut" is
only ever a claim about INSERT/UPDATE/DELETE. Not reachable via PostgREST (no TRUNCATE verb), hence a
hardening candidate rather than a live hole; badge iconUrl all null
(SVG fallback in UI — real icons = content task); srs_due notification producer unwired (needs
scheduler, pairs with push/email deliverer later); manual browser click-through of dashboard/bell/
recommendations not done (unit+build coverage only). From L7: ~~admin dialog focus trap~~ **REPAID in L9a-Plan2** (`components/admin/dialog.tsx` is
now a thin wrapper over `components/ui/dialog.tsx`, Radix focus trap); `stroke_order_svg` stored/rendered as raw SVG (fine while only admins write — needs
allowlist SVG sanitizer before less-trusted contributors); `users.email`/`created_at` still
client-writable (hardening migration candidate); no 'rejected' video status (reject = hard delete,
moderator reason logged not persisted) and no 'admin' transcript_source (admin-attached transcripts
stored as 'user_submitted') — both need a migration if wanted; CSV import is flat rows only (nested
kanji readings / test questions / passage questions via JSON create/update after import) and the
table doesn't auto-refresh post-import; admin content edit form only pre-fills fields present in
the list query (no GET-single endpoint); forum comment optimistic insert shows "You" until reload
(cosmetic); save-to-playlist overlay on /videos uses ARIA role="list" wrapper (revisit if
video-card gets a slot); community cursor pagination assumes distinct created_at at page
boundaries; admin stats count ids in JS not count:'exact' (fine at current scale); manual browser
click-through of /community, /playlists, /leaderboard, /admin not done (unit+build only).

## Parked

*(nothing currently parked — the one entry that lived here is resolved, see below)*

**~~Shadowing Hub Consolidation IA spec~~ — ✅ EXECUTED, no longer parked (corrected 2026-08-06).**
`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §6's 17-file change list was
carried out inside **Lesson Workspace Plan A (Docs)**, merged `a6a7617` (2026-07-31) — not as its own
branch, which is why this section wrongly still read "NOT yet executed" for a week. Proof: both
`docs/design/screens/screen-shadowing-hub.md` and `screen-shadowing-practice.md` exist.
The old "user deferred it to finish L9b first" note is historical only.
`mem:shadowing_hub_consolidation_status` has been rewritten to match.

## Working agreements
TDD-first, tests shown passing. code-reviewer signs off every non-trivial change before "done".
Data flows down schema→API→UI. Never download/proxy video (YouTube IFrame only). **Commit freely
without asking** (user granted standing permission 2026-07-13 — supersedes old "commit only when
asked"); push to remote still requires an explicit ask. Branch-per-layer + merge-to-master-when-done.
