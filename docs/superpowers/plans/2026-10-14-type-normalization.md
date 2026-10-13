# Type Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One type scale (`--text-*` tokens) on every learner-app screen, the app zooming uniformly to 1.25x between 1440 and 1920, and CI failing on any drift.

**Architecture:** One CSS change (the `--density-unit` curve), a mechanical class/CSS migration by role, a vitest source scan with a per-element allowlist, a Playwright gate that measures computed type against a literal table, and a screenshot harness that lets the owner judge every changed screen.

**Tech Stack:** Next.js 14 App Router, Tailwind (token `fontSize` in `tailwind.config.ts`), vitest 3, Playwright 1.61, sharp (already a dependency) for image diffs.

**Spec:** `docs/superpowers/specs/2026-10-14-type-normalization-design.md` (approved 2026-10-14, commit `09587189`). Read it before any task; decision IDs (S, M, G, V, P, R, O) are cited below.

## Global Constraints

- Work only in `.worktrees/type-normalization`. Never build or serve in the main checkout (it shares `.next` with the owner's dev server).
- Before ANY `npm run test:e2e`: nothing may listen on :3000 (`playwright.config.ts` reuses an existing server, and one from another worktree would be measured instead — L-004). Check with PowerShell `Get-NetTCPConnection -LocalPort 3000 -State Listen`; stop it if present.
- Servers for captures: branch build on **:3100**, master baseline build on **:3101**, both started with `E2E_ROUTE_ERROR=1`.
- vitest: `npx vitest run --minWorkers=1 --maxWorkers=2 <paths>` (15.8 GB machine). Full suite after the last edit of every task that touches product code.
- Gate and captures run in locale **`vi`** (the owner's language; Vietnamese stacks diacritics and wraps longest). Paths are `/vi/<route>`.
- Pinned scale (S2), tolerance **±0.05px**, 16px root, Display scale 1 — the literal table in `tests/e2e/typography/scale.ts` (Task 1) is the only copy; everything imports it.
- Token mapping is by ROLE (spec M1 table), never by nearest pixel.
- Never shrink type or rework an approved design to make a diff smaller; noticeable changes go to the owner (V5).
- Mutation tests: back up to `<file>.mutbak` beside the file and restore from it; never `git checkout --` (it drops uncommitted work).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One commit per task (Task 1 may commit tooling and the run state separately).
- Bash heredocs: never put an apostrophe in commit prose written through a heredoc; use `git commit -F <file>` for long messages.

## Review Focus

1. **Largest Display scale at 1920.** `extra_large` (1.25) × unit 1.25 = body 21.9px, sidebar 350px: the expectation is no horizontal scroll and no clipped nav label on Dashboard and Settings. Test owned by Task 10 (`typography.spec.ts`, "extra-large display scale at 1920").
2. **Reader-enlarged browser font (WCAG 1.4.4).** A 20px browser default must still raise the unit; every bound and the intercept of the curve must stay `rem`. Test owned by Task 2 (`declares the density unit with every bound in rem`).
3. **Pronunciation result previews at the new maximum gap.** Raising the unit ceiling raises `--space-md`'s maximum; the `@container results` thresholds must be recomputed or a preview row wraps. Test owned by Task 2 (existing "keeps result previews to one row" test, its ceiling regex fixed).
4. **Text that only renders after client fetch** (reading/[id], korume/chat, summary). The gate must wait for it, or it measures a skeleton and passes. Task 10 waits for `networkidle` (bounded) and `document.fonts.ready` per page, and Task 10 Step 4 records which routes rendered empty states.
5. **Vietnamese diacritics clipped by tighter token line-heights** (footer `1.15`/`1.3` → token leading; buttons). Task 10's vertical clipping check (`scrollHeight > clientHeight + 1`) runs in `vi`.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `docs/superpowers/run-state/type-normalization.md` | create | Branch run state, `- Owner: Claude` |
| `tests/e2e/typography/scale.ts` | create | S2 literal table, viewports, tolerance |
| `tests/e2e/typography/routes.ts` | create | P1 locked route list + dynamic-id resolution |
| `tests/e2e/typography/learner.ts` | create | P2 seed: one learner with data for every route, signed in |
| `tests/e2e/typography/measure.ts` | create | In-page measurement (`readTokens`, `inspectPage`, `readRatios`) |
| `tests/e2e/typography-capture.capture.ts` | create | V1/V3 screenshot capture + V4 ratios |
| `playwright.capture.config.ts` | create | Capture runner: no build, `CAPTURE_BASE_URL` |
| `scripts/typography-report.mjs` | create | V3 before/after HTML report with pixel-diff indicator |
| `app/globals.css` | modify | S1 curve, result-preview thresholds, Dashboard/footer type rules, comments |
| `lib/design-tokens.test.ts` | modify | S1/S2 pins |
| `lib/typography-allowlist.ts` | create | G2 per-element exemptions |
| `lib/typography-scan.test.ts` | create | G1 source scan (+ temporary `PENDING_MIGRATION`) |
| `components/ui/token-scale.test.ts` | modify | Drop `DEFAULT_TYPE_UTILITY` (G1 owns typography now) |
| `app/[locale]/(protected)/(app)/layout.tsx`, `(focus)/layout.tsx` | modify | M2 base `text-body` |
| ~80 component/route files | modify | M1 migration, by cluster |
| `tests/e2e/typography.spec.ts` | create | G4 browser gate |
| `docs/lessons.md`, `AGENTS.md` | modify | R1–R3 |

---

### Task 1: Run state, capture harness, master baseline (spec V1, V2, P1, P2)

**Files:**
- Create: `docs/superpowers/run-state/type-normalization.md`
- Create: `tests/e2e/typography/scale.ts`, `tests/e2e/typography/routes.ts`, `tests/e2e/typography/learner.ts`, `tests/e2e/typography/measure.ts`
- Create: `tests/e2e/typography-capture.capture.ts`, `playwright.capture.config.ts`, `scripts/typography-report.mjs`

**Interfaces:**
- Produces: `VIEWPORTS`, `ViewportName`, `TOKENS`, `Token`, `SCALE`, `TOLERANCE` (scale.ts); `ROUTE_COUNT = 44`, `RouteTarget`, `resolveRoutes(learner)` (routes.ts); `Learner`, `seedLearner(page)` (learner.ts); `readTokens`, `inspectPage`, `readRatios`, `TypeFinding` (measure.ts). Tasks 2, 10 and 11 import these.

- [ ] **Step 1: Write the run state**

```markdown
# Branch Run State

Branch `type-normalization`, worktree `.worktrees/type-normalization`, base master `c648bff0`.

- Owner: Claude

## Goal and scope

One type scale on the learner app (spec S/M), uniform zoom 1.0 -> 1.25 between 1440 and 1920, source scan +
browser gate (G1-G4), before/after review for the owner (V1-V5). Out: admin, marketing/landing, auth,
immersive, print sheet, navbar.

## Authorities

- Spec `docs/superpowers/specs/2026-10-14-type-normalization-design.md` — approved by the owner 2026-10-14.
- Plan `docs/superpowers/plans/2026-10-14-type-normalization.md`.
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-004, L-051, L-052).

## Accepted commits

| Task | Status | Commit |
|---|---|---|

## Baseline / measurements

## Open owner calls
```

- [ ] **Step 2: Write `tests/e2e/typography/scale.ts`**

```ts
/**
 * Spec S2 — the approved type scale, written as LITERAL numbers on purpose. A gate that compared rendered text
 * with whatever the tokens currently resolve to would stay green if both were wrong. 16px root, Display scale 1,
 * [size, line-height] in px. The vitest pin (lib/design-tokens.test.ts) and the Playwright gate both import this.
 */
export const VIEWPORTS = [
  { name: "1280", width: 1280, height: 529 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
] as const;
export type ViewportName = (typeof VIEWPORTS)[number]["name"];

export const TOKENS = ["caption", "body", "body-lg", "heading", "heading-lg", "title", "display"] as const;
export type Token = (typeof TOKENS)[number];

export const SCALE: Record<ViewportName, Record<Token, readonly [number, number]>> = {
  "1280": { caption: [11, 16.5], body: [12.44, 19.56], "body-lg": [14.22, 23.11], heading: [17.78, 24.89], "heading-lg": [21.33, 28.44], title: [24.89, 32], display: [35.56, 42.67] },
  "1440": { caption: [12, 18], body: [14, 22], "body-lg": [16, 26], heading: [20, 28], "heading-lg": [24, 32], title: [28, 36], display: [40, 48] },
  "1920": { caption: [15, 22.5], body: [17.5, 27.5], "body-lg": [20, 32.5], heading: [25, 35], "heading-lg": [30, 40], title: [35, 45], display: [50, 60] },
};

export const TOLERANCE = 0.05;
```

- [ ] **Step 3: Write `tests/e2e/typography/learner.ts`**

```ts
import type { Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "../fixtures/auth";
import { seedDashboardData, seedDashboardWorkspaceData } from "../fixtures/dashboard-data";
import { seedPrintLesson } from "../fixtures/print-data";
import type { WorkspaceData } from "../fixtures/workspace-data";

export interface Learner {
  lesson: WorkspaceData;
  userId: string;
  ids: { forumPost: string; playlist: string; printLesson: string };
  cleanup(): Promise<void>;
}

/**
 * Spec P2: one learner with enough data for every P1 route, signed in on `page`'s context. Registers through
 * the UI in `en` (the fixture's labels are English); the session cookie is locale-independent, so the caller
 * then visits `/vi/...`.
 */
export async function seedLearner(page: Page): Promise<Learner> {
  const lesson = await seedDashboardWorkspaceData();
  let userId: string | undefined;
  let evidence: { cleanup(): Promise<void> } | undefined;
  const removeUser = async () => {
    if (!userId) return;
    await lesson.admin.from("forum_posts").delete().eq("user_id", userId);
    await lesson.admin.from("user_playlists").delete().eq("user_id", userId);
    const deleted = await lesson.admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
  };
  try {
    const email = uniqueEmail("e2e_typography");
    await page.goto("/en/register");
    await registerViaUi(page, { name: "Typography Learner", email, password: "password123" });
    await page.waitForURL(/\/en\/dashboard$/, { timeout: 15_000 });
    userId = await lesson.userIdByEmail(email);
    // Pause prefetch while seeding: a dashboard render must not freeze a half-seeded mission cycle.
    await page.goto("about:blank");
    evidence = await seedDashboardData(lesson.admin, userId, lesson);
    const post = await lesson.admin.from("forum_posts")
      .insert({ user_id: userId, title: "Bài viết đo chữ", content: "Một đoạn để đo chữ. 日本語の文です。" })
      .select("id").single();
    if (post.error) throw post.error;
    const playlist = await lesson.admin.from("user_playlists")
      .insert({ user_id: userId, name: "Danh sách đo chữ" }).select("id").single();
    if (playlist.error) throw playlist.error;
    const print = await seedPrintLesson(lesson.admin, lesson.prefix);
    const ids = { forumPost: post.data.id as string, playlist: playlist.data.id as string, printLesson: print.videoId };
    const id = userId;
    return {
      lesson, userId: id, ids,
      cleanup: async () => { await evidence?.cleanup(); await removeUser(); await lesson.cleanup(); },
    };
  } catch (error) {
    await evidence?.cleanup();
    await removeUser();
    await lesson.cleanup();
    throw error;
  }
}
```

- [ ] **Step 4: Write `tests/e2e/typography/routes.ts`**

```ts
import type { Learner } from "./learner";

/** Spec P1 — the locked list. 34 static + 7 dynamic (app) routes + 3 (focus) routes = 44. */
export const STATIC_ROUTES = [
  "achievements", "certification", "challenges", "community", "community/peer-review", "companion",
  "conversation", "dashboard", "e2e-route-error", "grammar", "kanji", "kanji/review", "korume/chat",
  "leaderboard", "mining", "mining/review", "playlists", "profile", "profile/edit", "pronunciation",
  "pronunciation/paths", "reading", "review", "roadmap", "settings", "settings/privacy",
  "settings/privacy/memory", "shadowing", "shadowing/explore", "statistics", "vocab", "vocab/review",
  "weekly-report",
] as const;
export const ROUTE_COUNT = 44;

/** `path` has no locale prefix. `unavailable` is a FAILURE with its reason (spec G4: never skipped silently). */
export type RouteTarget = { label: string; path: string } | { label: string; unavailable: string };

async function firstId(learner: Learner, table: string, column = "id"): Promise<string | undefined> {
  const row = await learner.lesson.admin.from(table).select(column).order(column).limit(1).maybeSingle();
  if (row.error) throw row.error;
  const value = (row.data as Record<string, unknown> | null)?.[column];
  return value == null ? undefined : String(value);
}

export async function resolveRoutes(learner: Learner): Promise<RouteTarget[]> {
  const { videoId } = learner.lesson;
  const dynamic: Array<[string, string, string | undefined]> = [
    ["certification/[id]", "certification", await firstId(learner, "certification_tests")],
    ["community/[id]", "community", learner.ids.forumPost],
    ["kanji/[id]", "kanji", await firstId(learner, "kanji")],
    ["playlists/[id]", "playlists", learner.ids.playlist],
    ["pronunciation/collections/[slug]", "pronunciation/collections", await firstId(learner, "collections", "slug")],
    ["reading/[id]", "reading", await firstId(learner, "reading_passages")],
    ["vocab/[id]", "vocab", await firstId(learner, "vocab")],
  ];
  const routes: RouteTarget[] = [
    ...STATIC_ROUTES.map((path) => ({ label: path, path })),
    { label: "vocab/print", path: `vocab/print?source=lesson&lesson=${learner.ids.printLesson}&set=all` },
    ...dynamic.map(([label, base, id]) => (id ? { label, path: `${base}/${id}` } : { label, unavailable: `no row in the table behind ${label}` })),
    { label: "(focus) shadowing/[id]", path: `shadowing/${videoId}` },
    { label: "(focus) shadowing/[id]/dictation", path: `shadowing/${videoId}/dictation` },
    { label: "(focus) shadowing/[id]/summary", path: `shadowing/${videoId}/summary` },
  ];
  if (routes.length !== ROUTE_COUNT) throw new Error(`route list has ${routes.length} entries, spec P1 locks ${ROUTE_COUNT}`);
  return routes;
}
```

Note: `STATIC_ROUTES` holds 33 entries; `vocab/print` (needs its query) is the 34th static route, added in `resolveRoutes`. The count guard makes any drift loud.

- [ ] **Step 5: Write `tests/e2e/typography/measure.ts`**

Every exported function runs INSIDE the page through `page.evaluate`, so each is self-contained (no imports, no outer variables).

```ts
export interface TypeFinding { kind: "type" | "clip" | "hscroll"; where: string; detail: string }

/** Computed [size, line-height] of each token, read from probe elements (a custom property's own value is an
 *  unresolved calc string, so the CSS must be applied to be measured). */
export function readTokens(tokens: readonly string[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const token of tokens) {
    const probe = document.createElement("span");
    probe.className = `text-${token}`;
    probe.textContent = "x";
    document.body.append(probe);
    const style = getComputedStyle(probe);
    out[token] = [parseFloat(style.fontSize), parseFloat(style.lineHeight)];
    probe.remove();
  }
  return out;
}

/** Spec G4 checks 2 and 3 on the current page. */
export function inspectPage(args: { pairs: Array<readonly [number, number]>; tolerance: number; exempt: Record<string, "all" | "line-height"> }): TypeFinding[] {
  const { pairs, tolerance, exempt } = args;
  const findings: TypeFinding[] = [];
  const near = (a: number, b: number) => Math.abs(a - b) <= tolerance;
  const label = (el: Element) => {
    const cls = typeof el.className === "string" && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}` : "";
    return `${el.tagName.toLowerCase()}${cls} "${(el.textContent ?? "").trim().slice(0, 40)}"`;
  };
  const shown = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };
  const scopeOf = (el: Element) => {
    const holder = el.closest("[data-type-exempt]");
    return holder ? exempt[holder.getAttribute("data-type-exempt") ?? ""] : undefined;
  };
  const checkType = (el: Element) => {
    const scope = scopeOf(el);
    if (scope === "all") return;
    const style = getComputedStyle(el);
    const size = parseFloat(style.fontSize);
    const leading = style.lineHeight === "normal" ? Number.NaN : parseFloat(style.lineHeight);
    if (!pairs.some(([s, l]) => near(size, s) && (scope === "line-height" || near(leading, l)))) {
      findings.push({ kind: "type", where: label(el), detail: `${style.fontSize} / ${style.lineHeight}` });
    }
  };

  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || seen.has(el) || !node.textContent?.trim() || el.closest("script, style, noscript, template")) continue;
    seen.add(el);
    if (shown(el)) checkType(el);
  }
  const fields = document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select");
  for (const el of fields) if (shown(el)) checkType(el);

  for (const el of document.querySelectorAll('button, [role="button"], nav a, [lang="ja"]')) {
    if (!(el instanceof HTMLElement) || el.clientWidth === 0 || !shown(el)) continue;
    const full = (el.textContent ?? "").trim();
    if (!full) continue;
    const style = getComputedStyle(el);
    const carriesFullText = `${el.title} ${el.getAttribute("aria-label") ?? ""}`.includes(full);
    const truncatesOnPurpose = style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none";
    if (truncatesOnPurpose && carriesFullText) continue;
    if (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1) {
      findings.push({ kind: "clip", where: label(el), detail: `content ${el.scrollWidth}x${el.scrollHeight} in box ${el.clientWidth}x${el.clientHeight}` });
    }
  }
  const pageWidth = document.documentElement.scrollWidth;
  if (pageWidth > window.innerWidth) findings.push({ kind: "hscroll", where: "document", detail: `${pageWidth} > ${window.innerWidth}` });
  return findings;
}

/** Spec V4 — raw numbers for the owner; no threshold. */
export function readRatios(cardSelector: string): Record<string, number | string> {
  const card = document.querySelector(cardSelector);
  if (!card) return { error: `no element matches ${cardSelector}` };
  const probe = document.createElement("span");
  probe.className = "text-body";
  probe.textContent = "x";
  card.append(probe);
  const body = parseFloat(getComputedStyle(probe).fontSize);
  probe.remove();
  const box = card.getBoundingClientRect();
  const icon = card.querySelector("svg")?.getBoundingClientRect().width ?? Number.NaN;
  const control = document.querySelector("main button")?.getBoundingClientRect().height ?? Number.NaN;
  const padding = parseFloat(getComputedStyle(card).paddingLeft);
  return {
    bodyPx: body, cardWidthPx: box.width, iconPx: icon, controlHeightPx: control, cardPaddingPx: padding,
    bodyPerCardWidth: body / box.width, iconPerBody: icon / body, controlPerBody: control / body, paddingPerBody: padding / body,
  };
}
```

- [ ] **Step 6: Write `playwright.capture.config.ts`**

```ts
import { defineConfig, devices } from "@playwright/test";

/**
 * Spec V1/V3 screenshot capture. Never builds: it runs against a server the operator started IN A WORKTREE
 * (branch on :3100, master baseline on :3101, both with E2E_ROUTE_ERROR=1), named by CAPTURE_BASE_URL, so it
 * can never measure a server built from somewhere else by accident. One worker: captures share one CPU.
 */
const baseURL = process.env.CAPTURE_BASE_URL;
if (!baseURL) throw new Error("set CAPTURE_BASE_URL (http://localhost:3100 branch, http://localhost:3101 baseline)");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "*.capture.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 45 * 60_000,
  use: { baseURL, locale: "vi", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

- [ ] **Step 7: Write `tests/e2e/typography-capture.capture.ts`**

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import nav from "../../messages/vi/nav.json";
import { VIEWPORTS } from "./typography/scale";
import { resolveRoutes } from "./typography/routes";
import { seedLearner } from "./typography/learner";
import { readRatios } from "./typography/measure";

/**
 * Spec V1–V4. Writes `<CAPTURE_OUT>/<route>__<viewport>[__nav-collapsed].png`, `ratios.json` and `log.txt`
 * (every route that could not be captured, with its reason — never skipped silently).
 * CAPTURE_TIME (ISO) pins the browser clock so two runs compare; server-rendered dates follow real time,
 * which is why Task 11 captures baseline and branch back to back with the same CAPTURE_TIME.
 */
const OUT = process.env.CAPTURE_OUT;
if (!OUT) throw new Error("set CAPTURE_OUT to the output directory");
const TIME = new Date(process.env.CAPTURE_TIME ?? Date.now());
const slug = (label: string) => label.replace(/[()[\]]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "");

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined); // bounded: live pages poll
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(0, 0);
}

async function contextFor(context: BrowserContext, width: number, height: number) {
  const browser = context.browser()!;
  const fresh = await browser.newContext({ storageState: await context.storageState(), viewport: { width, height }, locale: "vi", reducedMotion: "reduce" });
  await fresh.clock.setFixedTime(TIME);
  await fresh.route(/youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
  return fresh;
}

test("capture every in-scope page (spec V1-V4)", async ({ browser }) => {
  mkdirSync(OUT, { recursive: true });
  const log: string[] = [];
  const ratios: Record<string, unknown> = {};
  const seedContext = await browser.newContext({ locale: "vi" });
  const learner = await seedLearner(await seedContext.newPage());
  try {
    const routes = await resolveRoutes(learner);
    for (const viewport of VIEWPORTS) {
      const context = await contextFor(seedContext, viewport.width, viewport.height);
      const page = await context.newPage();
      for (const route of routes) {
        if ("unavailable" in route) { log.push(`${route.label} @${viewport.name}: NOT CAPTURED — ${route.unavailable}`); continue; }
        const response = await page.goto(`/vi/${route.path}`);
        await settle(page);
        if (page.url().includes("/login")) { log.push(`${route.label} @${viewport.name}: NOT CAPTURED — redirected to login`); continue; }
        if (route.label !== "e2e-route-error" && (response?.status() ?? 0) >= 400) log.push(`${route.label} @${viewport.name}: HTTP ${response?.status()} (captured anyway)`);
        await page.screenshot({ path: path.join(OUT, `${slug(route.label)}__${viewport.name}.png`), fullPage: true });
      }
      await page.goto("/vi/dashboard");
      await settle(page);
      if (viewport.name !== "1280") {
        ratios[`dashboard@${viewport.name}`] = await page.evaluate(readRatios, '[data-area="continue"]');
        await page.goto("/vi/settings");
        await settle(page);
        ratios[`settings@${viewport.name}`] = await page.evaluate(readRatios, "main section");
        await page.goto("/vi/dashboard");
        await settle(page);
      }
      await page.getByRole("button", { name: nav.toggle.hide }).click();
      await expect(page.getByRole("button", { name: nav.toggle.show })).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `dashboard__${viewport.name}__nav-collapsed.png`), fullPage: true });
      await context.close();
    }
    // Spec M4: out-of-scope surfaces that share components/ui.
    for (const viewport of VIEWPORTS) {
      const anon = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, locale: "vi", reducedMotion: "reduce" });
      await anon.clock.setFixedTime(TIME);
      const page = await anon.newPage();
      for (const [label, url] of [["out-landing", "/vi"], ["out-login", "/vi/login"]] as const) {
        await page.goto(url);
        await settle(page);
        await page.screenshot({ path: path.join(OUT, `${label}__${viewport.name}.png`), fullPage: true });
      }
      await anon.close();
    }
    const promoted = await learner.lesson.admin.from("users").update({ is_admin: true }).eq("id", learner.userId);
    if (promoted.error) throw promoted.error;
    for (const viewport of VIEWPORTS) {
      const context = await contextFor(seedContext, viewport.width, viewport.height);
      const page = await context.newPage();
      await page.goto("/vi/admin");
      await settle(page);
      if (page.url().includes("/admin")) await page.screenshot({ path: path.join(OUT, `out-admin__${viewport.name}.png`), fullPage: true });
      else log.push(`out-admin @${viewport.name}: NOT CAPTURED — redirected to ${page.url()}`);
      await context.close();
    }
  } finally {
    writeFileSync(path.join(OUT, "ratios.json"), JSON.stringify(ratios, null, 2));
    writeFileSync(path.join(OUT, "log.txt"), log.join("\n") || "every route captured");
    await learner.cleanup();
    await seedContext.close();
  }
});
```

- [ ] **Step 8: Write `scripts/typography-report.mjs`**

```js
// Spec V3: before | after per page and viewport, with a pixel-difference % that is an INDICATOR ONLY.
// Usage: node scripts/typography-report.mjs <dir containing baseline/ and after/>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.argv[2];
if (!root) throw new Error("usage: node scripts/typography-report.mjs <capture root>");
const before = path.join(root, "baseline");
const after = path.join(root, "after");

async function diff(a, b) {
  const [ia, ib] = await Promise.all([a, b].map((file) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  const width = Math.min(ia.info.width, ib.info.width);
  const height = Math.min(ia.info.height, ib.info.height);
  let changed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * ia.info.width + x) * 4;
      const j = (y * ib.info.width + x) * 4;
      const delta = Math.abs(ia.data[i] - ib.data[j]) + Math.abs(ia.data[i + 1] - ib.data[j + 1]) + Math.abs(ia.data[i + 2] - ib.data[j + 2]);
      if (delta > 24) changed++;
    }
  }
  const resized = ia.info.width !== ib.info.width || ia.info.height !== ib.info.height
    ? ` · size ${ia.info.width}x${ia.info.height} → ${ib.info.width}x${ib.info.height}` : "";
  return `${((100 * changed) / (width * height)).toFixed(1)}% pixels differ${resized}`;
}

const names = [...new Set([...readdirSync(before), ...readdirSync(after)])].filter((name) => name.endsWith(".png")).sort();
const rows = [];
for (const name of names) {
  const a = path.join(before, name);
  const b = path.join(after, name);
  const note = existsSync(a) && existsSync(b) ? await diff(a, b) : existsSync(a) ? "missing AFTER image" : "missing BASELINE image";
  rows.push(`<section><h2>${name}</h2><p>${note}</p><div class="pair"><img src="baseline/${name}" alt="before"><img src="after/${name}" alt="after"></div></section>`);
}
const read = (file) => (existsSync(file) ? readFileSync(file, "utf8") : "(missing)");
const html = `<!doctype html><meta charset="utf-8"><title>Type normalization — before / after</title>
<style>body{font:14px system-ui;margin:16px;background:#111;color:#eee}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px}img{width:100%;border:1px solid #444}pre{white-space:pre-wrap;background:#222;padding:8px}</style>
<h1>Type normalization — before (master) | after (branch)</h1>
<p><strong>At 1920 every page differs by design</strong> (spec S1: the app zooms 1.0 → 1.25 between 1440 and 1920). The pixel % is an indicator, not a verdict.</p>
<h2>Capture log — baseline</h2><pre>${read(path.join(before, "log.txt"))}</pre>
<h2>Capture log — after</h2><pre>${read(path.join(after, "log.txt"))}</pre>
<h2>Ratios (spec V4) — baseline</h2><pre>${read(path.join(before, "ratios.json"))}</pre>
<h2>Ratios (spec V4) — after</h2><pre>${read(path.join(after, "ratios.json"))}</pre>
${rows.join("\n")}`;
writeFileSync(path.join(root, "report.html"), html);
console.log(`${names.length} images -> ${path.join(root, "report.html")}`);
```

- [ ] **Step 9: Typecheck the new files**

Run: `npx tsc --noEmit -p .`
Expected: exit 0. (If `messages/vi/nav.json` lacks `toggle.hide`/`toggle.show`, stop: the nav label moved — find the current key, do not invent one.)

- [ ] **Step 10: Build the master baseline in its own worktree**

```bash
cd C:/Users/tplon/Documents/GitHub/JPWeb/japan-web
git worktree add --detach .worktrees/type-baseline c648bff0
cd .worktrees/type-baseline
ln -s /c/Users/tplon/Documents/GitHub/JPWeb/japan-web/.worktrees/port-profile/node_modules node_modules
cp ../type-normalization/.env.local .
npm run build
```
Expected: build succeeds. Then start it (background): `E2E_ROUTE_ERROR=1 npx next start -p 3101`.

- [ ] **Step 11: Capture the baseline**

From `.worktrees/type-normalization`:
```bash
CAPTURE_BASE_URL=http://localhost:3101 CAPTURE_OUT=.superpowers/typography/baseline-v1 npx playwright test --config=playwright.capture.config.ts
```
Expected: 1 passed. `.superpowers/typography/baseline-v1/` holds 44×3 route images + 3 Dashboard nav-collapsed + 9 out-of-scope images (fewer only where `log.txt` says why), `ratios.json`, `log.txt`. Record the image count and every `log.txt` line in the run state under "Baseline / measurements". `.superpowers/` is git-ignored: images are never committed.

- [ ] **Step 12: Commit**

```bash
git add docs/superpowers/run-state/type-normalization.md tests/e2e/typography tests/e2e/typography-capture.capture.ts playwright.capture.config.ts scripts/typography-report.mjs
git commit -m "test(type-normalization): capture harness + master baseline (spec V1, V2, P1, P2)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The density curve (spec S1–S3)

**Files:**
- Modify: `app/globals.css:1-16` (result-preview comment + thresholds at :29, :35, :41, :47), `app/globals.css:163-186` (density comment + declaration)
- Test: `lib/design-tokens.test.ts:416-475`

**Interfaces:**
- Consumes: `SCALE`, `TOKENS`, `VIEWPORTS` from `tests/e2e/typography/scale.ts`.

- [ ] **Step 1: Replace the two curve tests with the S1/S2 pins**

In `lib/design-tokens.test.ts` add the import at the top:

```ts
import { SCALE, TOKENS, VIEWPORTS } from "../tests/e2e/typography/scale";
```

Replace the tests `"declares the density unit with both bounds in rem, never in px"` and `"bounds the rule to 1280-1440 and to nothing else"` with:

```ts
  // Spec S1 (type-normalization, 2026-10-14): 0.889 at 1280, 1.0 at 1440, a gentler line to 1.25 at 1920, held.
  const CURVE = /--density-unit:\s*calc\(\s*clamp\(\s*([\d.]+)rem\s*,\s*min\(\s*100vw\s*\/\s*(\d+)\s*,\s*([\d.]+)rem\s*\+\s*100vw\s*\/\s*(\d+)\s*\)\s*,\s*([\d.]+)rem\s*\)\s*\*\s*var\(--display-scale,\s*1\)\s*\)/;

  it("declares the density unit with every bound in rem", () => {
    // Spec §5.2 of the density spec: a vw-derived unit ignores the reader's own font size (WCAG 1.4.4); rem
    // bounds AND the rem intercept rise when the reader raises their default size.
    expect(css).toMatch(CURVE);
    const declaration = css.match(/--density-unit:[^;]+;/)?.[0] ?? "";
    expect(declaration).not.toMatch(/\d+px/);
  });

  it("puts 1280, 1440 and 1920 exactly where spec S1 says, held beyond", () => {
    // Read OUT OF THE STYLESHEET, not copied: a pin on two literals would keep passing while the CSS changed.
    const match = css.match(CURVE);
    expect(match).not.toBeNull();
    const [lower, steep, intercept, gentle, upper] = match!.slice(1).map(Number);
    const unit = (vw: number) => Math.min(Math.max(lower * 16, Math.min(vw / steep, intercept * 16 + vw / gentle)), upper * 16);
    expect(unit(1280)).toBeCloseTo(1280 / 1440, 4);
    expect(unit(1440)).toBeCloseTo(1, 6);
    expect(unit(1680)).toBeCloseTo(1.125, 6);
    expect(unit(1920)).toBeCloseTo(1.25, 6);
    expect(unit(2560)).toBeCloseTo(1.25, 6);
    expect(unit(1200)).toBeCloseTo(1280 / 1440, 4);
  });

  it("resolves every type token to the approved table (spec S2)", () => {
    const match = css.match(CURVE)!;
    const [lower, steep, intercept, gentle, upper] = match.slice(1).map(Number);
    const unit = (vw: number) => Math.min(Math.max(lower * 16, Math.min(vw / steep, intercept * 16 + vw / gentle)), upper * 16);
    const resolve = (name: string, vw: number) => {
      const decl = css.match(new RegExp(`--${name}:\\s*(?:max\\(\\s*([\\d.]+)rem\\s*,\\s*)?calc\\((\\d+)\\s*\\*\\s*var\\(--density-unit\\)\\)`));
      expect(decl, `--${name}`).not.toBeNull();
      const floor = decl![1] ? Number(decl![1]) * 16 : 0;
      return Math.max(floor, Number(decl![2]) * unit(vw));
    };
    for (const viewport of VIEWPORTS) {
      for (const token of TOKENS) {
        const [size, leading] = SCALE[viewport.name][token];
        expect(Math.abs(resolve(`text-${token}`, viewport.width) - size), `${token} size @${viewport.name}`).toBeLessThanOrEqual(0.05);
        expect(Math.abs(resolve(`leading-${token}`, viewport.width) - leading), `${token} leading @${viewport.name}`).toBeLessThanOrEqual(0.05);
      }
    }
  });
```

In `"keeps result previews to one row at every display scale"` replace the `unitCeilings` line with (the old regex now captures the curve's intercept instead of its ceiling):

```ts
    // The LAST rem before `* var(--display-scale` in each declaration is that declaration's ceiling.
    const unitCeilings = [...css.matchAll(/--density-unit:[^;]*?([\d.]+)rem\s*\)?\s*\*\s*var\(--display-scale/g)].map((match) => Number(match[1]));
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/design-tokens.test.ts`
Expected: FAIL — the CURVE regex does not match the current declaration; "result previews" still passes (ceiling still 0.0625).

- [ ] **Step 3: Change the curve**

In `app/globals.css` `:root`, replace the declaration

```css
  --density-unit: calc(clamp(0.0555556rem, calc(100vw / 1440), 0.0625rem) * var(--display-scale, 1));
```
with
```css
  --density-unit: calc(
    clamp(0.0555556rem, min(100vw / 1440, 0.015625rem + 100vw / 1920), 0.078125rem)
    * var(--display-scale, 1)
  );
```

and append to the comment block directly above it:

```css
     Above 1440 (type-normalization spec S1, owner 2026-10-14) the whole app zooms
     uniformly on a gentler line, 0.25px + 100vw/1920: 1.0 at 1440, 1.125 at 1680,
     1.25 at 1920, held above by the 0.078125rem cap. 1920 / 1.25 = 1536, the
     canvas the Figma app frames are drawn on. The intercept is rem for the same
     WCAG reason as the bounds. tests/e2e/typography.spec.ts measures the result.
```

Do not touch `[data-density="reference"]`.

- [ ] **Step 4: Run — the result-preview test now fails**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/design-tokens.test.ts`
Expected: the three new tests PASS; "keeps result previews to one row" FAILS expecting `[25.5625, 39.125, 52.6875]` (max gap = 16 × 0.078125 × 1.25 = 1.5625rem).

- [ ] **Step 5: Recompute the result-preview thresholds**

In `app/globals.css`: `25.25rem` → `25.5625rem` (two places, :29 and :35), `38.5rem` → `39.125rem` (:35, :41), `51.75rem` → `52.6875rem` (:41, :47). In the comment at :10-15 replace "the gap reaches 1.25rem at the largest scale" with "the gap reaches 1.5625rem at the largest scale (unit ceiling 1.25 × Display scale 1.25)" and "25.25rem / 38.5rem / 51.75rem thresholds reserve n × 12rem + (n - 1) × 1.25rem" with "25.5625rem / 39.125rem / 52.6875rem thresholds reserve n × 12rem + (n - 1) × 1.5625rem".

- [ ] **Step 6: Run the token tests, then the other curve pins**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/design-tokens.test.ts components/layout/two-column-shell.test.tsx lib/preferences`
Expected: PASS. Then `grep -rn "100vw / 1440\|0\.0625rem" app lib components tests --include=*.ts --include=*.tsx --include=*.css` — every hit must be the reference scope, a 1280/1440 pin (unchanged by S1), or a comment that is still true; fix any comment that now states the old ceiling.

- [ ] **Step 7: Full vitest, typecheck, commit**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2` and `npx tsc --noEmit`
Expected: all green.
```bash
git add app/globals.css lib/design-tokens.test.ts
git commit -m "feat(type-normalization): density curve zooms uniformly to 1.25 at 1920 (spec S1-S3)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Source scan + allowlist (spec G1, G2, G3 part 1)

**Files:**
- Create: `lib/typography-allowlist.ts`, `lib/typography-scan.test.ts`
- Modify: `components/ui/token-scale.test.ts` (remove `DEFAULT_TYPE_UTILITY`)

**Interfaces:**
- Produces: `TypeExemption`, `TYPE_EXEMPTIONS` (allowlist; Task 10 imports it), `PENDING_MIGRATION` (edited by Tasks 4–9).

- [ ] **Step 1: Write the allowlist module (empty)**

```ts
/**
 * Spec G2 — content presentation, not interface type: large kanji/glyph art, pitch/pronunciation glyphs, furigana
 * <rt>, the user's own reading line-height. ONE entry per element or CSS rule — never a page or a directory.
 *
 * `match`: for a .tsx/.ts file, an exact substring of the offending line; for app/globals.css, the rule's full
 * selector as written. `scope`: what is exempt — both size and line-height ("all") or line-height only.
 * The browser gate (G4) skips an element only when it (or an ancestor) carries data-type-exempt="<id>".
 * The scan fails on an entry that exempts nothing and whose data-type-exempt marker is absent from `file`.
 */
export interface TypeExemption {
  id: string;
  file: string;
  match: string;
  scope: "all" | "line-height";
  reason: string;
}

export const TYPE_EXEMPTIONS: readonly TypeExemption[] = [];
```

- [ ] **Step 2: Write the scan test**

```ts
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TYPE_EXEMPTIONS } from "./typography-allowlist";

/**
 * Spec G1 (type-normalization, 2026-10-14). Interface type in the learner app uses the --text-* tokens only.
 * Walks DIRECTORIES, not a list of files: a new screen is in scope the day it is created, which is exactly
 * what the per-directory scopes of components/ui/token-scale.test.ts could not give.
 */
const ROOTS = ["components", "app/[locale]/(protected)/(app)", "app/[locale]/(protected)/(focus)"];
/** Declared out of scope by the spec (§1), not exemptions. */
const OUT_OF_SCOPE = ["components/admin/", "components/auth/", "components/marketing/", "components/vocabulary-print/", "components/style-guide/"];
/** CSS rules out of scope: the printable worksheet, set in physical units. */
const OUT_OF_SCOPE_SELECTOR = /^\.vp-/;
/**
 * TEMPORARY (spec O5): clusters whose migration has not landed. A prefix is a file-path prefix, or `css:` plus
 * a selector prefix. Each migration task deletes its entries; Task 9 leaves it EMPTY and the test below then
 * forbids it from growing again.
 */
export const PENDING_MIGRATION: readonly string[] = [];

const SIZE_CLASS = /(?<![\w-])(text-(?:xs|sm|base|lg|xl|[2-9]xl)|text-\[(?:\d|length:|calc\(|clamp\(|min\(|max\()[^\]]*\])(?![\w-])/g;
const LEADING_CLASS = /(?<![\w-])(leading-(?:none|tight|snug|normal|relaxed|loose|\d+)|leading-\[[^\]]+\])(?![\w-])/g;
const INLINE = /\b(fontSize|lineHeight)\s*:/g;
const TOKEN_VALUE = /^var\(--(?:text|leading)-[a-z-]+\)$/;

interface Violation { file: string; line: number; text: string; kind: "size" | "leading"; selector?: string }

const posix = (p: string) => p.split(path.sep).join("/");

function sourceFiles(): string[] {
  return ROOTS.flatMap((root) =>
    (readdirSync(root, { recursive: true }) as string[])
      .map((rel) => posix(path.join(root, rel)))
      .filter((file) => /\.tsx?$/.test(file) && !/\.(test|spec)\.tsx?$/.test(file))
      .filter((file) => !OUT_OF_SCOPE.some((dir) => file.startsWith(dir))));
}

export function scanSource(file: string, text: string): Violation[] {
  const out: Violation[] = [];
  text.split(/\r?\n/).forEach((lineText, index) => {
    for (const m of lineText.matchAll(SIZE_CLASS)) out.push({ file, line: index + 1, text: m[1]!, kind: "size" });
    for (const m of lineText.matchAll(LEADING_CLASS)) out.push({ file, line: index + 1, text: m[1]!, kind: "leading" });
    for (const m of lineText.matchAll(INLINE)) out.push({ file, line: index + 1, text: `${m[1]}:`, kind: m[1] === "lineHeight" ? "leading" : "size" });
  });
  return out;
}

export function scanCss(file: string, css: string): Violation[] {
  const blanked = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " ")); // keep line numbers
  const out: Violation[] = [];
  for (const rule of blanked.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1]!.trim().replace(/\s+/g, " ");
    if (OUT_OF_SCOPE_SELECTOR.test(selector)) continue;
    const line = blanked.slice(0, rule.index! + rule[1]!.length).split("\n").length;
    for (const decl of rule[2]!.matchAll(/(?:^|;)\s*(font-size|line-height)\s*:\s*([^;]+)/g)) {
      const value = decl[2]!.trim();
      if (TOKEN_VALUE.test(value) || value === "inherit") continue;
      out.push({ file, line, text: `${selector} { ${decl[1]}: ${value} }`, kind: decl[1] === "line-height" ? "leading" : "size", selector });
    }
  }
  return out;
}

const lines = new Map<string, string[]>();
const lineOf = (v: Violation) => {
  if (!lines.has(v.file)) lines.set(v.file, readFileSync(v.file, "utf8").split(/\r?\n/));
  return lines.get(v.file)![v.line - 1] ?? "";
};
const exempts = (v: Violation) => TYPE_EXEMPTIONS.find((entry) =>
  entry.file === v.file
  && (v.selector !== undefined ? entry.match === v.selector : lineOf(v).includes(entry.match))
  && (entry.scope === "all" || v.kind === "leading"));
const under = (v: Violation, prefix: string) =>
  prefix.startsWith("css:") ? v.selector?.startsWith(prefix.slice(4)) === true : v.file.startsWith(prefix);
const pending = (v: Violation) => PENDING_MIGRATION.some((prefix) => under(v, prefix));

const files = sourceFiles();
const all = [
  ...files.flatMap((file) => scanSource(file, readFileSync(file, "utf8"))),
  ...scanCss("app/globals.css", readFileSync("app/globals.css", "utf8")),
];
const format = (v: Violation) => `${v.file}:${v.line}  ${v.text}`;

describe("typography scan (spec G1)", () => {
  it("walks a real tree", () => {
    expect(files.length).toBeGreaterThan(300);
    expect(files).toContain("components/dashboard/dashboard-header.tsx");
    expect(files.some((file) => file.startsWith("components/admin/"))).toBe(false);
  });

  it("recognises what it must and nothing it must not", () => {
    const hits = scanSource("x.tsx", 'a="md:text-sm text-xl/7 text-[13px] leading-7 leading-[1.2]" style={{ fontSize: 3 }}').map((v) => v.text);
    expect(hits).toEqual(["text-sm", "text-xl", "text-[13px]", "leading-7", "leading-[1.2]", "fontSize:"]);
    const clean = 'a="text-body text-caption text-heading-lg text-muted-foreground text-[hsl(var(--x))] context-sm leading-body"';
    expect(scanSource("x.tsx", clean)).toEqual([]);
    const css = ".a { font-size: var(--text-body); line-height: var(--leading-body); }\n.b { font-size: calc(11 * var(--d)); }\n.vp-x { font-size: 9pt; }";
    expect(scanCss("x.css", css).map((v) => v.text)).toEqual([".b { font-size: calc(11 * var(--d)) }"]);
  });

  it("finds no interface type outside the tokens", () => {
    const open = all.filter((v) => !exempts(v) && !pending(v)).map(format);
    expect(open, open.join("\n")).toEqual([]);
  });

  it("keeps every allowlist entry alive and specific", () => {
    for (const entry of TYPE_EXEMPTIONS) {
      const used = all.some((v) => exempts(v) === entry);
      const marked = readFileSync(entry.file, "utf8").includes(`data-type-exempt="${entry.id}"`);
      expect(used || marked, `stale allowlist entry ${entry.id}`).toBe(true);
      expect(entry.reason.length, `${entry.id} needs a reason`).toBeGreaterThan(20);
      expect(entry.match.trim().length, `${entry.id} needs a specific match`).toBeGreaterThan(3);
    }
    expect(new Set(TYPE_EXEMPTIONS.map((entry) => entry.id)).size).toBe(TYPE_EXEMPTIONS.length);
  });

  it("keeps PENDING_MIGRATION honest: every prefix still has work", () => {
    for (const prefix of PENDING_MIGRATION) {
      expect(all.some((v) => !exempts(v) && under(v, prefix)), `${prefix} has no violations left — delete it`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run it to get the work list**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts`
Expected: "finds no interface type outside the tokens" FAILS listing every violation (≈380 class hits + Dashboard/footer/reading CSS rules). Save the output to `.superpowers/typography/work-list-v1.txt` and record the total in the run state.

- [ ] **Step 4: Fill `PENDING_MIGRATION` from the work list**

Set it to exactly these prefixes (each owned by one later task), then re-run until only prefixes with no violation would make the honesty test fail — delete such a prefix rather than keep it:

```ts
export const PENDING_MIGRATION: readonly string[] = [
  // Task 4 — Dashboard
  "css:.dashboard-",
  // Task 5 — Profile
  "components/profile/",
  // Task 6 — shadowing / player / summary / korume / mining
  "components/video-player/", "components/lesson-summary/", "components/korume/", "components/motion/",
  "app/[locale]/(protected)/(focus)/", "app/[locale]/(protected)/(app)/mining/",
  // Task 7 — JLPT / certification / learning
  "components/jlpt/", "components/learning/", "app/[locale]/(protected)/(app)/certification/",
  // Task 8 — reading / conversation / kanji / vocab / grammar
  "components/reading/", "components/conversation/", "css:.reading-", "app/[locale]/(protected)/(app)/reading/",
  "app/[locale]/(protected)/(app)/conversation/", "app/[locale]/(protected)/(app)/kanji/",
  "app/[locale]/(protected)/(app)/vocab/", "app/[locale]/(protected)/(app)/grammar/",
  // Task 9 — community and the rest
  "components/community/", "components/companion/", "components/layout/", "components/ui/", "css:.app-footer__",
  "app/[locale]/(protected)/(app)/community/", "app/[locale]/(protected)/(app)/leaderboard/",
  "app/[locale]/(protected)/(app)/playlists/",
];
```

If the work list shows a violation under a path not covered above, add its prefix to the task whose area it belongs to (Task 9 if none) and note it in the run state.

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts`
Expected: PASS.

- [ ] **Step 5: Mutation — the scan bites on TSX (spec G3, first half)**

```bash
cp components/settings/settings-row.tsx components/settings/settings-row.tsx.mutbak
sed -i '0,/text-body/s//text-sm/' components/settings/settings-row.tsx
npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts
mv components/settings/settings-row.tsx.mutbak components/settings/settings-row.tsx
```
Expected: FAIL naming `components/settings/settings-row.tsx:<line>  text-sm`; then, after the restore, PASS. If `settings-row.tsx` has no `text-body`, pick any non-pending file that does (`grep -l text-body components/settings/*.tsx`). Record the red output line in the run state.

- [ ] **Step 6: Retire the duplicate rule in `components/ui/token-scale.test.ts`**

Delete the `DEFAULT_TYPE_UTILITY` constant and its comment block, and change every `rules: [...FORBIDDEN, DEFAULT_TYPE_UTILITY]` to `rules: FORBIDDEN`. Add above `SCANNED_DIRS`:

```ts
// Default Tailwind type utilities are no longer policed here: lib/typography-scan.test.ts (type-normalization
// spec G1) walks every learner-app directory and maps each role to a token (spec M1), including text-lg and
// text-3xl, which this file used to leave alone for lack of a rung.
```

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 components/ui lib/typography-scan.test.ts`
Expected: PASS.

- [ ] **Step 7: Full vitest, typecheck, commit**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2` and `npx tsc --noEmit`
```bash
git add lib/typography-allowlist.ts lib/typography-scan.test.ts components/ui/token-scale.test.ts docs/superpowers/run-state/type-normalization.md
git commit -m "test(type-normalization): typography source scan + per-element allowlist (spec G1, G2, G3 TSX)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Migration tasks 4–9: the common procedure

Every migration task runs this loop for its own `PENDING_MIGRATION` entries (listed in the task). It is written out once here and each task names only what differs; the reviewer checks each task against it.

1. Delete the task's entries from `PENDING_MIGRATION` in `lib/typography-scan.test.ts`.
2. `npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts` → the failure lists this cluster's work.
3. For each hit, decide the ROLE of that text and apply the spec M1 table:

   | Role | Token class | CSS value |
   |---|---|---|
   | Page H1 | `text-title` | `var(--text-title)` / `var(--leading-title)` |
   | Large figure, emphasis | `text-display` or `text-heading-lg` | same pattern |
   | Card / section heading | `text-heading` | |
   | Body, button, link, input | `text-body` | |
   | Emphasised body, Japanese sentence in body | `text-body-lg` | |
   | Meta, chip, secondary label, eyebrow | `text-caption` | |

   Raw `leading-*` is deleted (the token class carries its line-height). `text-lg` is `text-heading` when the element is a heading (`h1`–`h4`, a card title) and `text-body-lg` otherwise. Responsive variants map the same way (`md:text-sm` → `md:text-body`), and a variant that becomes identical to its base is deleted.
4. The only alternative to a token is an allowlist entry in `lib/typography-allowlist.ts`, and only for content presentation (large kanji/glyph art, pitch glyphs, `<rt>`, the reader's own reading line-height). Each entry: `id` (kebab-case, e.g. `kanji-detail-glyph`), `file`, `match`, `scope`, a reason longer than 20 characters, AND `data-type-exempt="<id>"` on the element in that file. Never a page, never a directory.
5. Update unit tests that assert the old class (`toHaveClass("text-sm")` → `toHaveClass("text-body")`); never delete the assertion.
6. `npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts <the cluster's test files>` → PASS.
7. `npx tsc --noEmit` and `npm run lint` → exit 0.
8. Commit `refactor(type-normalization): <cluster> on the shared type tokens (spec M1)` with the Co-Authored-By line.

---

### Task 4: Dashboard + base size (spec M2, M3, G3 part 2)

**Files:**
- Modify: `app/globals.css` (the `/dashboard` block, ≈:1666-1770), `app/[locale]/(protected)/(app)/layout.tsx`, `app/[locale]/(protected)/(focus)/layout.tsx`
- Test: `lib/typography-scan.test.ts` (PENDING entry `css:.dashboard-`; `components/dashboard/*.tsx` has no raw class today), `tests/e2e/dashboard.spec.ts`

- [ ] **Step 1: Remove the Dashboard entry from `PENDING_MIGRATION` and run the scan**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts`
Expected: FAIL listing the `.dashboard-*` / `.dash-*` font-size and line-height declarations (26 today).

- [ ] **Step 2: Move every Dashboard type declaration to its token**

In each rule below, delete the existing `font-size` and `line-height` declarations and write the pair shown. Every other declaration (weight, letter-spacing, colour, family, sizes in `--d`) stays.

| Rule | Role | New declarations |
|---|---|---|
| `.dashboard-layout` | body | `font-size: var(--text-body); line-height: var(--leading-body);` |
| `.dashboard-layout .dash-eyebrow` | eyebrow | `font-size: var(--text-caption); line-height: var(--leading-caption);` |
| `.dashboard-layout .dash-h1` | page H1 | `font-size: var(--text-title); line-height: var(--leading-title);` |
| `.dashboard-layout .dash-title-lg` | Continue lesson title (large emphasis) | `font-size: var(--text-heading-lg); line-height: var(--leading-heading-lg);` |
| `.dashboard-layout .dash-title` | card heading | `font-size: var(--text-heading); line-height: var(--leading-heading);` |
| `.dashboard-layout .dash-quote` | Korume quote (emphasised body) | `font-size: var(--text-body-lg); line-height: var(--leading-body-lg);` |
| `.dashboard-layout .dash-meta`, `.dash-small`, `.dash-link` | meta | `font-size: var(--text-caption); line-height: var(--leading-caption);` |
| `.dashboard-layout .dash-btn` | button | `font-size: var(--text-body); line-height: var(--leading-body);` |
| `.dashboard-layout .dash-btn--sm` | small secondary control | `font-size: var(--text-caption); line-height: var(--leading-caption);` |
| `.dashboard-search input` | input | `font-size: var(--text-body); line-height: var(--leading-body);` |
| `.dashboard-streak`, `.dashboard-chip`, `.dashboard-journey-node` | chip / label | `font-size: var(--text-caption); line-height: var(--leading-caption);` |
| `.dashboard-avatar` | avatar initial | `font-size: var(--text-body); line-height: var(--leading-body);` |
| `.dashboard-quick-link` | tile label | `font-size: var(--text-body); line-height: var(--leading-body);` |

Any remaining hit in `.dashboard-*` that this table does not name: apply the M1 role table and add a row for it in the run state.

Replace the block comment above `.dashboard-page` ("…`--d` is one authored Figma px at a 1180px main column, and type, spacing and art are all written in it…") with:

```css
/* /dashboard (port-dashboard spec §7; owner feedback 2026-10-13; type-normalization 2026-10-14). Figma `111:515`
   is a 1180px-wide main column scaled to fit its frame, so LAYOUT and ART scale the same way: `--d` is one
   authored Figma px at a 1180px main column, and padding, gaps, radii, icons, bars and cells are written in it.
   TYPE is not: every font-size and line-height here is a shared --text-* token (lesson L-052), so the Dashboard
   reads like every other screen; no property is written in both units. `--d` holds `cqi`, which resolves where
   it is USED, against `.dashboard-page`; nothing inside may declare a container. Desktop only. */
```

- [ ] **Step 3: Base size for the learner app (spec M2)**

`app/[locale]/(protected)/(app)/layout.tsx`: `<div className="flex min-h-screen flex-row">` → `<div className="flex min-h-screen flex-row text-body">`.
`app/[locale]/(protected)/(focus)/layout.tsx`: `<div className="flex min-h-screen flex-col md:flex-row">` → `<div className="flex min-h-screen flex-col text-body md:flex-row">`.

- [ ] **Step 4: Scan green, then the CSS mutation (spec G3, second half)**

Run: `npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts` → PASS.
```bash
cp app/globals.css app/globals.css.mutbak
sed -i 's/\.dashboard-layout \.dash-title { font-size: var(--text-heading);/.dashboard-layout .dash-title { font-size: calc(11 * var(--d));/' app/globals.css
npx vitest run --minWorkers=1 --maxWorkers=2 lib/typography-scan.test.ts
mv app/globals.css.mutbak app/globals.css
```
Expected: FAIL naming `app/globals.css:<line>  .dashboard-layout .dash-title { font-size: calc(11 * var(--d)) }`; after restore, PASS. (If the sed matched nothing, the scan stays green — then the mutation proved nothing: check `grep -n "dash-title {" app/globals.css` and redo it on the actual text.) Record the red line in the run state.

- [ ] **Step 5: Dashboard E2E, including the fold rule**

Stop anything on :3000 (Global Constraints), then:
Run: `npm run test:e2e -- tests/e2e/dashboard.spec.ts`
Expected: PASS. If ONLY the fold test fails (row-1 container bottom below 529px at 1280): do not change any type. Measure the overshoot in px from the failure message, write it in the run state under "Open owner calls" as "Dashboard fold: row 1 overshoots by N px at 1280x529 after M3", and leave the test red for the owner's ruling in Task 11 (V5). Any other failure is a bug: fix it.

- [ ] **Step 6: Full vitest, typecheck, lint, commit**

```bash
git add app/globals.css "app/[locale]/(protected)/(app)/layout.tsx" "app/[locale]/(protected)/(focus)/layout.tsx" lib/typography-scan.test.ts docs/superpowers/run-state/type-normalization.md
git commit -m "refactor(type-normalization): Dashboard type on the shared tokens, --d for layout only; app base text-body (spec M2, M3, G3)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Profile (spec M1)

**Files:** `components/profile/**`, `app/[locale]/(protected)/(app)/profile/**` (≈33 hits). PENDING entry: `components/profile/` (the profile routes have no raw class today).

- [ ] **Step 1:** Run the common procedure steps 1–2.
- [ ] **Step 2:** Apply steps 3–5 to every hit. Profile's page H1 is `text-title`; stat figures are `text-display` if they are the card's headline number, else `text-heading-lg`.
- [ ] **Step 3:** Steps 6–7 with test files `components/profile`; then `npm run test:e2e -- tests/e2e/profile.spec.ts` (nothing on :3000) → PASS.
- [ ] **Step 4:** Step 8 commit: `refactor(type-normalization): Profile on the shared type tokens (spec M1)`.

---

### Task 6: Shadowing, player, summary, Korume, mining (spec M1)

**Files:** `components/video-player/**` (≈59), `components/lesson-summary/**`, `components/korume/**`, `components/motion/**`, `app/[locale]/(protected)/(app)/shadowing/**`, `app/[locale]/(protected)/(focus)/**`, `app/[locale]/(protected)/(app)/mining/**`. PENDING entries: the six prefixes listed under "Task 6" in Task 3 Step 4.

- [ ] **Step 1:** Common procedure steps 1–2.
- [ ] **Step 2:** Steps 3–5. `components/video-player/furigana-text.tsx` renders `<rt>`: add an allowlist entry `{ id: "furigana-rt-player", file: "components/video-player/furigana-text.tsx", match: "<rt", scope: "all", reason: "Ruby annotation is smaller than its base text by definition (HTML <rt>); it is not interface type." }` and `data-type-exempt="furigana-rt-player"` on that `<rt>`. Japanese subtitle/transcript lines are `text-body-lg` (spec M1: Japanese sentences in body).
- [ ] **Step 3:** Steps 6–7 with test files `components/video-player components/lesson-summary components/korume components/motion`; then `npm run test:e2e -- tests/e2e/shadowing-workspace.spec.ts tests/e2e/summary.spec.ts tests/e2e/korume.spec.ts` → PASS except the known red `summary.spec.ts:29` (pre-existing on master, `AI_PROVIDER=gemini` in `.env.local`).
- [ ] **Step 4:** Step 8 commit: `refactor(type-normalization): shadowing, player, summary, Korume and mining on the shared type tokens (spec M1)`.

---

### Task 7: JLPT, certification, learning (spec M1)

**Files:** `components/jlpt/**` (≈48), `components/learning/**` (≈20), `app/[locale]/(protected)/(app)/certification/**`. PENDING entries: the three prefixes under "Task 7".

- [ ] **Step 1:** Common procedure steps 1–2.
- [ ] **Step 2:** Steps 3–5. Question stems in Japanese are `text-body-lg`; answer choices are `text-body`; timers/score figures `text-heading-lg`.
- [ ] **Step 3:** Steps 6–7 with test files `components/jlpt components/learning`.
- [ ] **Step 4:** Step 8 commit: `refactor(type-normalization): JLPT, certification and learning on the shared type tokens (spec M1)`.

---

### Task 8: Reading, conversation, kanji, vocab, grammar (spec M1)

**Files:** `components/reading/**` (≈33), `components/conversation/**` (≈24), `app/[locale]/(protected)/(app)/{reading,conversation,kanji,vocab,grammar}/**`, `app/globals.css` `.reading-*` rules. PENDING entries: the eight prefixes under "Task 8".

- [ ] **Step 1:** Common procedure steps 1–2.
- [ ] **Step 2:** The `.reading-jp-body`, `.reading-jp-body-lg`, `.reading-jp-heading`, `.reading-jp-heading-lg`, `.reading-latin-caption`, `.reading-latin-body` rules set `line-height: var(--reading-leading…, …)` — the reader's own line-height preference. Keep them; add ONE allowlist entry per rule, e.g.:

```ts
  { id: "reading-jp-body", file: "app/globals.css", match: ".reading-jp-body", scope: "line-height", reason: "The reader's own Japanese line-height preference (--reading-leading) overrides the token leading by design." },
```
(match = the rule's selector exactly as `scanCss` reports it), and put `data-type-exempt="<id>"` on the element(s) rendering each class (grep `reading-jp-body` etc. in `components/reading`). The size in those rules must already be a token; if not, migrate it.
- [ ] **Step 3:** `components/reading/reading-body.tsx` renders `<rt>`: entry `furigana-rt-reading` exactly like Task 6's, with the marker on that `<rt>`.
- [ ] **Step 4:** Steps 3–5 for the remaining hits; `components/reading/reading-quiz.test.tsx` asserts a raw class — update it to the token class. A large kanji glyph on `kanji/[id]` or `vocab/[id]` (content art) is an allowlist entry with scope `all`, not a token.
- [ ] **Step 5:** Steps 6–7 with test files `components/reading components/conversation "app/[locale]/(protected)/(app)/kanji" "app/[locale]/(protected)/(app)/vocab" "app/[locale]/(protected)/(app)/grammar"`; then `npm run test:e2e -- tests/e2e/print-vocabulary.spec.ts tests/e2e/review.spec.ts` → PASS.
- [ ] **Step 6:** Step 8 commit: `refactor(type-normalization): reading, conversation, kanji, vocab and grammar on the shared type tokens (spec M1)`.

---

### Task 9: Community and the rest; `PENDING_MIGRATION` empty (spec M1, M4, G1)

**Files:** `components/community/**` (≈94), `components/companion/**`, `components/layout/**` (incl. the footer), `components/ui/**`, `app/globals.css` `.app-footer__*` rules, `app/[locale]/(protected)/(app)/{community,leaderboard,playlists}/**`, `lib/typography-scan.test.ts`.

- [ ] **Step 1:** Common procedure steps 1–2 for every remaining PENDING entry.
- [ ] **Step 2:** Footer CSS: each `.app-footer__*` rule with a unitless `line-height` (1.5, 1.8, 1.15, 1.3, 1.2, 1) — delete that `line-height`, and make sure the element's size comes from a token class or `var(--text-*)` so the matching `--leading-*` applies (write `line-height: var(--leading-<same token>)` in the rule when the size is set in CSS). `.app-footer__chip-z` (`font-size: 0.7em`, the snore "z" glyph art) becomes an allowlist entry `{ id: "footer-snore-z", file: "app/globals.css", match: ".app-footer__chip-z", scope: "all", reason: "Decorative snore glyph in the mascot chip, sized relative to its chip; art, not text." }` with `data-type-exempt="footer-snore-z"` on its element in `components/layout/app-footer.tsx`. This changes an owner-approved footer: list it in "Open owner calls" for V5.
- [ ] **Step 3:** Steps 3–5 for the rest. `components/community/leaderboard-opt-in-toggle.test.tsx` asserts a raw class — update it.
- [ ] **Step 4:** Make `PENDING_MIGRATION` permanently empty. Replace its declaration and doc comment with:

```ts
/** Spec O5 is complete: no cluster is pending. This stays empty — a new exclusion is an allowlist entry
 *  (one element, one reason) or a migration, never a pending directory. */
export const PENDING_MIGRATION: readonly string[] = [];
```
and add to the `describe` block:
```ts
  it("has nothing pending (spec §9: no out-of-list exclusion at merge)", () => {
    expect(PENDING_MIGRATION).toEqual([]);
  });
```
- [ ] **Step 5:** Steps 6–7 with test files `components/community components/companion components/layout components/ui lib/typography-scan.test.ts`; then `npm run test:e2e -- tests/e2e/app-footer.spec.ts tests/e2e/settings.spec.ts tests/e2e/display-scale.spec.ts` → PASS.
- [ ] **Step 6:** Full vitest (`npx vitest run --minWorkers=1 --maxWorkers=2`) → PASS. Step 8 commit: `refactor(type-normalization): community, companion, layout, ui and footer on the shared type tokens; nothing pending (spec M1, M4, G1)`.

---

### Task 10: Browser gate (spec G4)

**Files:**
- Create: `tests/e2e/typography.spec.ts`

**Interfaces:**
- Consumes: `VIEWPORTS`, `SCALE`, `TOKENS`, `TOLERANCE`; `resolveRoutes`, `RouteTarget`; `seedLearner`, `Learner`; `readTokens`, `inspectPage`, `TypeFinding`; `TYPE_EXEMPTIONS`.

- [ ] **Step 1: Write the gate**

```ts
import { expect, test, type Browser, type BrowserContext } from "@playwright/test";
import nav from "../../messages/vi/nav.json";
import { TYPE_EXEMPTIONS } from "../../lib/typography-allowlist";
import { SCALE, TOKENS, TOLERANCE, VIEWPORTS } from "./typography/scale";
import { inspectPage, readTokens, type TypeFinding } from "./typography/measure";
import { resolveRoutes, type RouteTarget } from "./typography/routes";
import { seedLearner, type Learner } from "./typography/learner";

/**
 * Spec G4: every P1 route at 1280/1440/1920 in `vi` — the pinned scale (literal table), every visible text on
 * an approved pair, no clipped control/label/Japanese line, no horizontal scroll. A route that cannot be
 * reached or measured FAILS with its reason. The Dashboard is measured a second time with the nav collapsed.
 */
test.describe.configure({ mode: "serial" });
const exempt = Object.fromEntries(TYPE_EXEMPTIONS.map((entry) => [entry.id, entry.scope]));
let learner: Learner;
let routes: RouteTarget[];
let session: Awaited<ReturnType<BrowserContext["storageState"]>>;

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ locale: "vi" });
  learner = await seedLearner(await context.newPage());
  routes = await resolveRoutes(learner);
  session = await context.storageState();
  await context.close();
});
test.afterAll(async () => { await learner?.cleanup(); });

async function open(browser: Browser, width: number, height: number) {
  const context = await browser.newContext({ storageState: session, viewport: { width, height }, locale: "vi", reducedMotion: "reduce" });
  await context.route(/youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
  return { context, page: await context.newPage() };
}

const show = (route: string, f: TypeFinding) => `${route} · ${f.kind} · ${f.where} · ${f.detail}`;

for (const viewport of VIEWPORTS) {
  const pairs = TOKENS.map((token) => SCALE[viewport.name][token]);

  test(`every learner page reads on the type scale at ${viewport.name}`, async ({ browser }) => {
    test.setTimeout(20 * 60_000);
    const { context, page } = await open(browser, viewport.width, viewport.height);
    const report: string[] = [];
    await page.goto("/vi/dashboard");
    const measured = await page.evaluate(readTokens, TOKENS);
    for (const token of TOKENS) {
      const [size, leading] = SCALE[viewport.name][token];
      const [s, l] = measured[token];
      if (Math.abs(s - size) > TOLERANCE || Math.abs(l - leading) > TOLERANCE) report.push(`scale · ${token} renders ${s}/${l}, spec S2 says ${size}/${leading}`);
    }
    for (const route of routes) {
      if ("unavailable" in route) { report.push(`${route.label} · NOT MEASURED · ${route.unavailable}`); continue; }
      const response = await page.goto(`/vi/${route.path}`);
      await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined); // bounded: some pages poll
      await page.evaluate(() => document.fonts.ready);
      if (page.url().includes("/login")) { report.push(`${route.label} · NOT MEASURED · redirected to login`); continue; }
      const status = response?.status() ?? 0;
      if (route.label !== "e2e-route-error" && status >= 400) { report.push(`${route.label} · NOT MEASURED · HTTP ${status}`); continue; }
      for (const finding of await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt })) report.push(show(route.label, finding));
    }
    await context.close();
    expect(report, report.join("\n")).toEqual([]);
  });

  test(`the Dashboard with the nav collapsed at ${viewport.name}`, async ({ browser }) => {
    const { context, page } = await open(browser, viewport.width, viewport.height);
    await page.goto("/vi/dashboard");
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await page.getByRole("button", { name: nav.toggle.hide }).click();
    await expect(page.getByRole("button", { name: nav.toggle.show })).toBeVisible();
    const findings = await page.evaluate(inspectPage, { pairs, tolerance: TOLERANCE, exempt });
    await context.close();
    expect(findings.map((f) => show("dashboard (nav collapsed)", f))).toEqual([]);
  });
}

test("extra-large display scale at 1920 keeps Dashboard and Settings whole (Review Focus 1)", async ({ browser }) => {
  const { context, page } = await open(browser, 1920, 1080);
  await page.goto("/vi/dashboard");
  const set = await page.request.patch("/api/user/preferences", { data: { displayScale: "extra_large" } });
  expect(set.status()).toBe(200);
  const report: string[] = [];
  for (const route of ["dashboard", "settings"]) {
    await page.goto(`/vi/${route}`);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    // Type sizes are 1.25x the table here by design; only clipping and horizontal scroll are asserted.
    const findings = await page.evaluate(inspectPage, { pairs: [], tolerance: TOLERANCE, exempt });
    report.push(...findings.filter((f) => f.kind !== "type").map((f) => show(route, f)));
  }
  await page.request.patch("/api/user/preferences", { data: { displayScale: "normal" } });
  await context.close();
  expect(report, report.join("\n")).toEqual([]);
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 3: Prove the gate bites before trusting it**

```bash
cp app/globals.css app/globals.css.mutbak
sed -i 's/\.dashboard-layout \.dash-title { font-size: var(--text-heading); line-height: var(--leading-heading);/.dashboard-layout .dash-title { font-size: 19px; line-height: var(--leading-heading);/' app/globals.css
npm run test:e2e -- tests/e2e/typography.spec.ts -g "1440"
mv app/globals.css.mutbak app/globals.css
```
(Nothing on :3000 first; the run builds.) Expected: the 1440 test FAILS with `dashboard · type · …19px…` lines. If it passes, the gate measures nothing — stop and debug before going on. Record the red line in the run state.

- [ ] **Step 4: Run the whole gate**

Run: `npm run test:e2e -- tests/e2e/typography.spec.ts`
Expected: PASS. For each failure: a migration miss → fix it in the owning cluster's files (same commit as this task, note it in the run state); a page that renders only an empty state for this seed → note it in the run state as "measured in empty state: <route>"; a route that cannot be measured → leave the failure, record its reason under "Open owner calls" (spec §9: the owner accepts or rejects it).

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/typography.spec.ts docs/superpowers/run-state/type-normalization.md
git commit -m "test(type-normalization): browser gate - pinned scale, every text on a token pair, no clipping, nav collapsed (spec G4)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: After-captures, report, owner review (spec V3–V5)

**Files:** none committed except the run state.

- [ ] **Step 1: Build and serve the branch on :3100**

From `.worktrees/type-normalization`: `npm run build`, then (background) `E2E_ROUTE_ERROR=1 npx next start -p 3100`. The baseline server (:3101, Task 1) must still be up; restart it from `.worktrees/type-baseline` if not.

- [ ] **Step 2: Capture baseline and branch back to back with one clock**

```bash
T=$(date -u +%Y-%m-%dT%H:%M:%SZ)
CAPTURE_TIME=$T CAPTURE_BASE_URL=http://localhost:3101 CAPTURE_OUT=.superpowers/typography/review/baseline npx playwright test --config=playwright.capture.config.ts
CAPTURE_TIME=$T CAPTURE_BASE_URL=http://localhost:3100 CAPTURE_OUT=.superpowers/typography/review/after npx playwright test --config=playwright.capture.config.ts
node scripts/typography-report.mjs .superpowers/typography/review
```
Expected: both runs pass; `report.html` lists every image with its indicator. Compare the image counts with Task 1's baseline-v1 count — a different count must be explained in the run state.

- [ ] **Step 3: Write the owner summary in the run state**

Under "Open owner calls": every approved screen (Dashboard, Settings, Shadowing, Pronunciation, Profile, footer) and every out-of-scope capture (landing, login, admin) whose layout changed noticeably (taller cards, lost fold, new wraps), each with its measured numbers and the image names; the V4 ratio table (baseline vs after, Dashboard and Settings, 1440 and 1920); Task 4's fold result; every "measured in empty state" and "NOT MEASURED" line.

- [ ] **Step 4: Open the report for the owner and STOP**

`Start-Process chrome.exe "<absolute path>/.superpowers/typography/review/report.html"` (PowerShell), plus the live branch at `http://localhost:3100/vi/dashboard` for the owner's own look. Present the run-state summary. Do not change any design or type in response to a diff without the owner's ruling (spec V5). Rulings that require code go into this branch as their own commits, each followed by `lib/typography-scan.test.ts` + `tests/e2e/typography.spec.ts`.

- [ ] **Step 5: Commit the run state**

```bash
git add docs/superpowers/run-state/type-normalization.md
git commit -m "docs(type-normalization): before/after review delivered to the owner (spec V3-V5)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Rules for later ports (spec R1–R3)

**Files:**
- Modify: `docs/lessons.md` (L-051 at :540-545, L-052 at :547-551), `AGENTS.md`

- [ ] **Step 1: Amend L-051**

In L-051's **Rule**, replace "Build the page to fill the main column and scale with it (one unit derived from `cqi`, every size written in it, a legibility floor for small text)" with "Build the page to fill the main column and scale its LAYOUT and ART with it (one unit derived from `cqi` for widths, gaps, radii, icons and art); TYPE is always the shared `--text-*` tokens (L-052)". Append to its first **Evidence** line: " *(Superseded for type by `type-normalization`, 2026-10-14: the Dashboard's type left `--d` for the shared tokens; `--d` kept for layout.)*"

- [ ] **Step 2: Widen L-052**

Change the title to "### L-052 — Every screen takes the app's type tokens; a frame's scale is for layout only". In **Rule**, replace "Type in a component that renders under many pages (footer, nav, shared panels) uses" with "Type on every learner-app screen and in every component uses". Add a line after **Applies to:**

```markdown
**Enforced by:** `lib/typography-scan.test.ts` (source: no raw size/leading class, no inline font style, no non-token
`font-size`/`line-height` in `app/globals.css`; per-element exemptions in `lib/typography-allowlist.ts`) and
`tests/e2e/typography.spec.ts` (computed type against the literal table in `tests/e2e/typography/scale.ts` at
1280/1440/1920). `type-normalization`, 2026-10-14, closed the Dashboard and fixed-size pages the evidence names.
```
Replace "the Dashboard and the unported pages still need a type-normalization pass." in **Applies to** with "every port; see Enforced by."

- [ ] **Step 3: Add the repository rule to `AGENTS.md`**

Find the section that lists UI/design-system rules (`grep -n "token" AGENTS.md`); add one bullet there, in that section's style:

```markdown
- Interface type uses the `--text-*` tokens only (`text-caption` … `text-display`); a Figma frame's own unit scales layout and art, never type (L-051, L-052). `lib/typography-scan.test.ts` and `tests/e2e/typography.spec.ts` must stay green; an exemption is one element in `lib/typography-allowlist.ts` with a reason, never a page.
```

- [ ] **Step 4: Protocol gate and commit**

Run: `npm run verify:protocol` → exit 0.
```bash
git add docs/lessons.md AGENTS.md
git commit -m "docs(type-normalization): L-051/L-052 + AGENTS.md rule - type on tokens on every screen (spec R1-R3)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Finish (not a task: the branch gate, spec O8 / §9)

1. Whole-branch `code-reviewer` on `git diff master...type-normalization`, its findings fixed, the fix wave reviewed again.
2. After the last edit: `npx vitest run --minWorkers=1 --maxWorkers=2`, `npx tsc --noEmit`, `npm run lint`, `npm run verify:protocol`, `npm run test:e2e -- tests/e2e/typography.spec.ts tests/e2e/dashboard.spec.ts tests/e2e/app-footer.spec.ts tests/e2e/settings.spec.ts`; the full E2E suite no worse than master (pre-existing reds: landing :287/:608/:700, summary :29).
3. Owner's Chrome look on :3100. Merge `--no-ff` only on the owner's word. Remove `.worktrees/type-baseline` after the merge (`git worktree remove .worktrees/type-baseline`).
