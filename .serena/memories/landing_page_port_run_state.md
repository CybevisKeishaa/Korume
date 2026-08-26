# Landing page port (`/`) — run state

> **Status: NOT STARTED.** The ruling that unblocked it is merged; no porting work exists yet.
> `mem:project_status` § NEXT ACTION points here and carries the gist only.
>
> ⚠️ **This memory is navigation and process. It deliberately does NOT restate the design.**
> `docs/product/landing-page-reconciliation.md` is the authority on what to build and why; it travels
> with the repo, this does not. If the two ever disagree, the doc wins and this file is the bug.

# ▶▶ RESUME HERE

**The ruling is merged** — `landing-page-identity-ruling` → master at `2822d22` (`--no-ff`,
2026-08-26, branch kept). Frame `347:6277` is the design for route `/`, registered as `landing-page`,
`kind: "screen"`. Merged-master gate figures live in `mem:project_status` § NEXT ACTION, their single
home; re-measure rather than copy them anywhere.

**The one thing blocking the first line of code: the image files.** Licensing is NOT the issue — the
user ruled 2026-08-26 that the imagery is AI-generated. The issue is that the reference's images
exist only as pixels inside one flat PNG at capture resolution and cannot be sliced into per-section
assets. §1, §2, §5 and §7 need real files: the user's original generations, or a fresh generation to
the same direction. **First action of the next session: ask the user for those files.** Do not slice
the reference, and do not start §1 without them — it is the page's most important image.

Work that does NOT depend on the images and could start meanwhile: §3's broken five-step row, §6's
threaded capability chain, §4's contour visualizer, and the density pass. See the doc's §3–§4.

## Which file answers which question

| Question | Authority |
|---|---|
| What to build, section by section; what the gaps are | `docs/product/landing-page-reconciliation.md` |
| Which node id is what; the `346:6275` correction | `docs/product/figma-frame-map.md` |
| The identity ruling and the reasoning behind it | spec `2026-08-23-screen-registry-phase-3-design.md` §9.1 |
| The row itself (`kind`, `figmaNodeId`, stamp) | `lib/product/screen-registry.ts` |
| Overall project state, gate figures, what comes after | `mem:project_status` |

## Rulings from 2026-08-26 — do not re-litigate any of these

1. **`347:6277` IS the design for `/`.** Not a separate destination.
2. **The authenticated home stays `dashboard` at `/dashboard`.** A `/home` rename was offered and
   **declined** — "user homepage" was the user's way of telling the two apart in conversation, not a
   rename instruction. `/dashboard` is referenced in ~89 files including the post-login redirect,
   middleware and safe-redirect tests; nobody should touch that without a fresh ruling.
3. **The frame's footer wins outright** over the reference's — the user built it deliberately, and it
   carries real data (`admin@almostgone.vn`, Discord/Facebook/TikTok, App Store block).
4. **The frame's "A quieter way to keep going." section stays.** Reference-only polish is allowed;
   content changes are not.
5. **`346:6275` is the visual quality bar, stays OUT of the registry, and must NOT be deleted** in any
   Figma cleanup pass. It is a flat image with zero children — comparable against, never derivable
   from.
6. **Imagery is AI-generated → no licensing question.** Do not re-escalate, and do not cite
   `CLAUDE.md` §2.3 at it: §2.3 is scoped to study content, not marketing imagery.

## Process notes from the session that produced this — worth not repeating

- **Two review rounds were needed and the second earned its keep.** Whole-branch (`L-011`) → 0
  correctness bugs, 10 prose defects. Review of that fix wave (`L-012`) → 10 more, **three created by
  the wave itself**, including a `grep` recipe written in to replace three wrong counts that had never
  been run and did not match the sites it named. Both lessons went into `docs/lessons.md` (`L-001`,
  `L-019`) as merged evidence, not new ids — count is unchanged.
- **`346:6275` renders blank if it is hidden again.** Check `get_metadata` before concluding it is
  empty; that exact mistake is what mis-filed it as "canvas noise" for three days across six files.
- **The registry file is CRLF.** Multi-line `perl -0pi` patterns with `\n` silently match nothing and
  exit 0. Use line-addressed `sed` or the Edit tool, and read the line back (`L-001`).
- A stale claim in this project reliably lives in **more than one file**. When correcting one, sweep
  for the phrasing — and note the phrasing may vary ("canvas noise" vs "decorative noise"), which is
  why a control matters (`L-019`, `L-033`).
