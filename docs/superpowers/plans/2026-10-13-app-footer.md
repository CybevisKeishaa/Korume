# App Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Figma Footer `203:13813` as `AppFooter` on the 13 "outer" app pages, in one scaled single-row composition, with a real per-account newsletter opt-in shared with Settings.

**Architecture:** One async server component (`components/layout/app-footer.tsx`) reads the newsletter state and renders static markup; two client islands handle the newsletter form and back-to-top. Consent lives in `users.newsletter_opt_in_at`, written only through a `security definer` RPC behind `PATCH /api/user/newsletter` — the same route shape as the AI-training consent. Layout is one container-query unit `--f` (L-051), no variants.

**Tech Stack:** Next.js 14.2 App Router, next-intl, Supabase (Postgres + RLS), Tailwind + `app/globals.css`, Vitest + Testing Library, Playwright, PowerShell DB gates.

**Spec:** `docs/superpowers/specs/2026-10-13-app-footer-design.md` (approved by the owner 2026-10-13 after three review rounds). Read it before any task; rulings are cited by ID (F, L, N, T, O).

## Global Constraints

- Desktop-only. Review viewports 1280x529 and 1440x900, nav expanded AND collapsed, plus a 1920-wide same-origin iframe.
- One composition everywhere: three sections on one row, `230 : 330 : 361`, 24px padding and gaps at a 1017px footer (L1). Never a second row (L2). No wide/compact variants.
- Text ≥ 12px; links, buttons and the email pill ≥ 14px (L2). Controls ≥ `--hit-target-min` (44px).
- The only ellipsis/clipping allowed is the account email (L3).
- A label without a destination is text, never `#` or a placeholder route (§0). Labels cut by F3 are not rendered at all.
- Never send the email from the client; the route takes `{ optIn: boolean }` only (N3a).
- SQL function: `security definer`, `set search_path = ''`, every reference schema-qualified, `revoke ... from public, anon` (N2).
- Copy lives in `messages/{en,vi}/*.json`, never in components; `vi` and `en` keysets stay identical (`lib/i18n/catalog.test.ts`).
- Never build or serve in the main checkout (`.next` is shared with the owner's dev server). Build/serve only in `.worktrees/app-footer`, on a port other than 3000.
- Run the full `npm test` after the LAST edit of every task that touches code (L-044, `gate-after-last-edit`).

## Plan-time corrections (deviations from the spec's wording, same intent)

- **P1 — API route, not a server action (N3a).** The repo's only consent precedent is `PATCH /api/user/model-training-consent` + `usePreferenceSave` with an endpoint override; the Settings row must reuse that hook, so the footer uses the same route. One write boundary for both surfaces.
- **P2 — `router.refresh()`, not `revalidatePath` (N3b).** On Next 14.2 a `revalidatePath` inside a route handler does not clear the client router cache (30s for dynamic pages). Both surfaces call `router.refresh()` after a confirmed save; `AppFooter` keys its island on the server value so a refreshed prop resets the island.
- **P3 — T2 split.** Several pages have more than one UI `return` branch, so "exactly once" cannot be a static count. Static test (Task 5): exactly the 13 listed `page.tsx` files mention `<AppFooter`, no other page and neither layout does. Runtime test (Task 7): each reachable listed route renders exactly one `[data-app-footer]`; non-footer routes render none.
- **P4 — Mascot file.** The landing footer's actual art is `public/mascot/poses/sleeping.png` (276x213, the alpha-trimmed derivative of `actions/sleeping.png`, `scripts/mascot/poses.json`). Use that file, as F6 intends.
- **P5 — Session expired (N3a).** No new login parameter: the "Sign in" control reloads the page, and `lib/supabase/middleware.ts` already redirects a signed-out request to `/login?redirectTo=<current path>`.
- **P6 — Email source.** The pill shows the auth user's `email` (the account address the session holds), not a second copy.

## Review Focus

1. **Session expires before Subscribe** — the learner must see `newsletter.signedOut`, nothing must read as saved. (Task 4, test "401 shows the signed-out state".)
2. **Double-click Subscribe** — the button is disabled while pending, so one click is one request; the DB keeps the first instant anyway. (Task 4, test "disables while pending"; Task 1 gate idempotence.)
3. **Turn off in Settings, then client-navigate back within 30s** — the footer must show the form again, not a cached "saved". (Task 6 refresh test; Task 7 E2E step.)
4. **A long account email (60+ chars)** — ellipsis inside the pill, no column overflow, full address in `title` and text. (Task 4 unit; Task 8 measure.)
5. **Vietnamese locale** — longer VI strings must keep headings, links and badge labels on one line at 1017. (Task 8 measures `/vi/shadowing` too.)

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261013000046_app_footer_newsletter.sql` | column, RPC, grants |
| `supabase/migrations/app-footer-newsletter.test.ts` | static pin of the migration's security shape |
| `supabase/tests/app-footer.sql`, `scripts/verify-app-footer-gate.ps1`, `package.json` | live gate `verify:db:footer` |
| `lib/validation/newsletter.ts` | zod body + shared `NewsletterState` type |
| `lib/data/newsletter.ts` (+ test) | read state, write via RPC |
| `app/api/user/newsletter/route.ts` (+ test) | PATCH boundary |
| `components/layout/app-footer.tsx` (+ test) | server component, markup |
| `components/layout/footer-newsletter.tsx` (+ test) | client form island |
| `components/layout/back-to-top.tsx` (+ test) | client button |
| `components/layout/app-footer-icon.tsx` | decorative glyphs |
| `app/globals.css` | `.app-footer` block |
| `app/[locale]/(protected)/(app)/layout.tsx` | `<main id="main-content" tabIndex={-1}>` |
| 13 `page.tsx` files (Task 5) | render `<AppFooter />` |
| `components/layout/app-footer-placement.test.ts` | static placement pin |
| `components/settings/privacy-data-section.tsx`, `settings-page.tsx`, `settings-icon.tsx`, `app/[locale]/(protected)/(app)/settings/page.tsx` | Settings row |
| `messages/{en,vi}/marketing.json`, `messages/{en,vi}/settings.json` | copy |
| `tests/e2e/app-footer.spec.ts` | E2E + runtime placement |
| `docs/superpowers/run-state/app-footer.md` | checkpoints, L2d pinned values |

---

### Task 1: Newsletter column, RPC and live DB gate

**Files:**
- Create: `supabase/migrations/20261013000046_app_footer_newsletter.sql`
- Create: `supabase/migrations/app-footer-newsletter.test.ts`
- Create: `supabase/tests/app-footer.sql`
- Create: `scripts/verify-app-footer-gate.ps1`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: column `public.users.newsletter_opt_in_at timestamptz null`; RPC `public.set_newsletter_opt_in(p_opt_in boolean) returns timestamptz` (callable by `authenticated` only); npm script `verify:db:footer`.

- [ ] **Step 1: Write the failing static test**

```ts
// supabase/migrations/app-footer-newsletter.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SQL = "supabase/migrations/20261013000046_app_footer_newsletter.sql";

describe("app footer newsletter migration (spec N1–N2)", () => {
  const sql = readFileSync(SQL, "utf8");

  it("adds a nullable consent instant on users", () => {
    expect(sql).toContain("alter table public.users add column newsletter_opt_in_at timestamptz;");
  });

  it("writes it only through a definer function with an empty search_path", () => {
    expect(sql).toContain("create function public.set_newsletter_opt_in(p_opt_in boolean) returns timestamptz");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain("auth.uid()");
    expect(sql).toContain("where id = v_uid");
  });

  it("is closed to anon and grants no column update", () => {
    expect(sql).toContain("revoke all on function public.set_newsletter_opt_in(boolean) from public, anon;");
    expect(sql).toContain("grant execute on function public.set_newsletter_opt_in(boolean) to authenticated;");
    expect(sql).not.toMatch(/grant\s+update\s*\(\s*newsletter_opt_in_at/i);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL (ENOENT)**

Run: `npx vitest run supabase/migrations/app-footer-newsletter.test.ts`

- [ ] **Step 3: Write the migration**

```sql
-- App footer newsletter opt-in (spec docs/superpowers/specs/2026-10-13-app-footer-design.md N1–N2).
-- Null = not subscribed. Written ONLY by set_newsletter_opt_in(): no column update grant, so a client can never
-- store an arbitrary consent instant. No mail is sent yet (EMAIL_PROVIDER=none, N5). `users` is already in the
-- user export (select *) and goes with the account on erasure, so both cover this column with no extra code.
alter table public.users add column newsletter_opt_in_at timestamptz;

comment on column public.users.newsletter_opt_in_at is
  'Newsletter consent instant (app-footer spec N1). Null = not subscribed. Written only by '
  'set_newsletter_opt_in(); true keeps the FIRST consent instant, false clears it.';

create function public.set_newsletter_opt_in(p_opt_in boolean) returns timestamptz
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'set_newsletter_opt_in: not authenticated' using errcode = 'insufficient_privilege';
  end if;
  if p_opt_in is null then
    raise exception 'set_newsletter_opt_in: p_opt_in is required' using errcode = 'null_value_not_allowed';
  end if;

  if p_opt_in then
    update public.users
       set newsletter_opt_in_at = coalesce(newsletter_opt_in_at, pg_catalog.now())
     where id = v_uid
     returning newsletter_opt_in_at into v_at;
  else
    update public.users
       set newsletter_opt_in_at = null
     where id = v_uid
     returning newsletter_opt_in_at into v_at;
  end if;

  return v_at;
end;
$$;

revoke all on function public.set_newsletter_opt_in(boolean) from public, anon;
grant execute on function public.set_newsletter_opt_in(boolean) to authenticated;
```

- [ ] **Step 4: Run the static test — expect PASS**

Run: `npx vitest run supabase/migrations/app-footer-newsletter.test.ts`

- [ ] **Step 5: Write the live gate SQL** (pattern: `supabase/tests/settings-page.sql`)

```sql
-- supabase/tests/app-footer.sql — spec T3 (SQL half). Run by scripts/verify-app-footer-gate.ps1.
\set ON_ERROR_STOP on

delete from auth.users where email like 'footergate-%@example.invalid';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'footergate-a@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'footergate-b@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

select id as uid_a from public.users where email = 'footergate-a@example.invalid' \gset
select id as uid_b from public.users where email = 'footergate-b@example.invalid' \gset

-- Shape: definer, empty search_path, no anon EXECUTE, no column UPDATE for authenticated.
do $$
declare v_def boolean; v_cfg text[];
begin
  select prosecdef, proconfig into v_def, v_cfg from pg_proc where proname = 'set_newsletter_opt_in';
  if not v_def then raise exception 'FAIL shape: not security definer'; end if;
  if v_cfg is distinct from array['search_path=""'] then raise exception 'FAIL shape: proconfig %', v_cfg; end if;
  if has_function_privilege('anon', 'public.set_newsletter_opt_in(boolean)', 'execute') then
    raise exception 'FAIL shape: anon can execute';
  end if;
  if has_column_privilege('authenticated', 'public.users', 'newsletter_opt_in_at', 'update') then
    raise exception 'FAIL shape: authenticated has a column update grant';
  end if;
  raise notice 'PASS shape';
end $$;

-- A subscribes twice, in two TRANSACTIONS (now() is constant inside one, so a single transaction could not
-- tell "kept the first instant" from "overwrote with now()"): the first instant is kept.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select public.set_newsletter_opt_in(true) as first_at \gset
commit;

select pg_sleep(0.05);

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select public.set_newsletter_opt_in(true) as second_at \gset
commit;

select (:'first_at' <> '' and :'first_at'::timestamptz = :'second_at'::timestamptz) as same_instant \gset
\if :same_instant
  \echo 'PASS idempotent: first consent instant kept'
\else
  \echo 'FAIL idempotent: consent instant changed on the second opt-in'
  select 1/0;
\endif

-- B opts in and out; A is untouched.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
begin
  if public.set_newsletter_opt_in(true) is null then raise exception 'FAIL B: opt-in returned null'; end if;
  if public.set_newsletter_opt_in(false) is not null then raise exception 'FAIL B: opt-out kept a value'; end if;
  raise notice 'PASS B opts in and out';
end $$;
commit;

select newsletter_opt_in_at is not null as a_still_in from public.users where id = :'uid_a' \gset
\if :a_still_in
  \echo 'PASS isolation: B never touched A'
\else
  \echo 'FAIL isolation: A lost its consent'
  select 1/0;
\endif

-- No auth.uid(): raises.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  perform public.set_newsletter_opt_in(true);
  raise exception 'FAIL unauthenticated: call succeeded';
exception when insufficient_privilege then
  raise notice 'PASS unauthenticated call raises';
end $$;
commit;

-- anon cannot call it at all.
begin;
set local role anon;
do $$
begin
  perform public.set_newsletter_opt_in(true);
  raise exception 'FAIL anon: call succeeded';
exception when insufficient_privilege then
  raise notice 'PASS anon has no EXECUTE';
end $$;
commit;

-- T4 data rights. Export: lib/data/user-export.ts reads `users` with select("*") (USER_EXPORT_TABLES), so a
-- column on public.users is exported; pin that it IS on public.users. Erasure: the account's users row (and so
-- the consent) is gone when the auth user is deleted.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'users' and column_name = 'newsletter_opt_in_at') then
    raise exception 'FAIL T4: newsletter_opt_in_at is not on public.users';
  end if;
  raise notice 'PASS T4: consent column lives on the exported users table';
end $$;

delete from auth.users where id = :'uid_a';
select count(*) = 0 as a_erased from public.users where id = :'uid_a' \gset
\if :a_erased
  \echo 'PASS T4: erasing the account removes its consent'
\else
  \echo 'FAIL T4: users row survived account deletion'
  select 1/0;
\endif

delete from auth.users where email like 'footergate-%@example.invalid';
```

- [ ] **Step 6: Write the gate script** — copy `scripts/verify-settings-gate.ps1` verbatim, then change only: the `.SYNOPSIS` line to `Live PostgreSQL acceptance gate for the app footer newsletter opt-in (spec T3).`, `$sqlPath` to `supabase/tests/app-footer.sql`, the FAIL line to `"FAIL: app footer gate exited $LASTEXITCODE"`, the success line to `'app footer: live PostgreSQL gate passed'`. Add to `package.json` scripts, after `verify:db:dashboard`:

```json
"verify:db:footer": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-app-footer-gate.ps1",
```

- [ ] **Step 7: Apply the migration and run the gate**

Run (from the worktree): `npx supabase migration up` then `npm run verify:db:footer`
Expected: every `PASS …` notice, final line `app footer: live PostgreSQL gate passed`. If `migration up` refuses, ask the owner before any `db reset` (standing approval is per branch).
Mutation checks (run each against the live DB, then restore by re-running the migration's own statements): (a) `grant execute on function public.set_newsletter_opt_in(boolean) to anon;` → the shape block must FAIL; `revoke` it again. (b) `create or replace` the function with `set newsletter_opt_in_at = pg_catalog.now()` instead of the `coalesce(...)` → the idempotence check must FAIL; restore the original body. Record both outcomes in the run state.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261013000046_app_footer_newsletter.sql supabase/migrations/app-footer-newsletter.test.ts supabase/tests/app-footer.sql scripts/verify-app-footer-gate.ps1 package.json
git commit -m "feat(app-footer): newsletter consent column, definer RPC and live gate (N1-N2, T3)"
```

---

### Task 2: Data layer, validation and `PATCH /api/user/newsletter`

**Files:**
- Create: `lib/validation/newsletter.ts`
- Create: `lib/data/newsletter.ts`, `lib/data/newsletter.test.ts`
- Create: `app/api/user/newsletter/route.ts`, `app/api/user/newsletter/route.test.ts`

**Interfaces:**
- Consumes: RPC `set_newsletter_opt_in` (Task 1).
- Produces:
  - `newsletterSchema` (`{ optIn: boolean }`), `type NewsletterInput`, `interface NewsletterState { email: string; optedIn: boolean }` — from `lib/validation/newsletter.ts` (client-safe).
  - `getNewsletterState(): Promise<NewsletterState | null>` — null only when signed out; a read failure fails CLOSED to `optedIn: false`.
  - `setNewsletterOptIn(input: NewsletterInput, now?: Date): Promise<{ ok: true; data: { optedIn: boolean } } | { ok: false; status: 401 } | { ok: false; status: 429; retryAfter: number }>` — throws on DB error.
  - `PATCH /api/user/newsletter` body `{ optIn: boolean }` → `200 { data: { optedIn } }` | `400` | `401` | `429` | opaque `500`.

- [ ] **Step 1: Validation module**

```ts
// lib/validation/newsletter.ts
import { z } from "zod";

/** PATCH /api/user/newsletter body (app-footer spec N2–N4). The email is never accepted from the client. */
export const newsletterSchema = z.object({ optIn: z.boolean() });
export type NewsletterInput = z.infer<typeof newsletterSchema>;

/** What the footer and the Settings row render from. Client-safe (no server import). */
export interface NewsletterState {
  email: string;
  optedIn: boolean;
}
```

- [ ] **Step 2: Failing data-layer tests** (pattern: `lib/data/model-training-consent.test.ts`)

```ts
// lib/data/newsletter.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { getNewsletterState, setNewsletterOptIn } from "./newsletter";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const asClient = (mock: ReturnType<typeof createMockSupabase>) => mock as ReturnType<typeof createClient>;

describe("getNewsletterState", () => {
  it("reports the account email and an opted-in learner", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: { users: () => ({ data: { newsletter_opt_in_at: "2026-10-13T00:00:00Z" }, error: null }) },
    })));
    expect(await getNewsletterState()).toEqual({ email: "learner@example.com", optedIn: true });
  });

  it("reports not subscribed when the instant is null", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: { users: () => ({ data: { newsletter_opt_in_at: null }, error: null }) },
    })));
    expect(await getNewsletterState()).toEqual({ email: "learner@example.com", optedIn: false });
  });

  it("returns null when signed out", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({ user: null, tables: {} })));
    expect(await getNewsletterState()).toBeNull();
  });

  it("fails closed on a read error and never throws", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: { users: () => ({ data: null, error: { message: "connection reset" } }) },
    })));
    await expect(getNewsletterState()).resolves.toEqual({ email: "learner@example.com", optedIn: false });
  });
});

describe("setNewsletterOptIn", () => {
  it("refuses a signed-out caller without calling the RPC", async () => {
    const mock = createMockSupabase({ user: null, tables: {}, rpcs: {} });
    vi.mocked(createClient).mockReturnValue(asClient(mock));
    expect(await setNewsletterOptIn({ optIn: true })).toEqual({ ok: false, status: 401 });
    expect(mock.rpcCalls).toEqual([]);
  });

  it("calls the definer RPC with only the boolean and reports the stored state", async () => {
    const mock = createMockSupabase({
      user: { id: "u1", email: "learner@example.com" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: "2026-10-13T00:00:00Z", error: null }) },
    });
    vi.mocked(createClient).mockReturnValue(asClient(mock));
    expect(await setNewsletterOptIn({ optIn: true })).toEqual({ ok: true, data: { optedIn: true } });
    expect(mock.rpcCalls).toEqual([{ name: "set_newsletter_opt_in", args: { p_opt_in: true } }]);
  });

  it("reports opted out when the RPC returns null", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: null, error: null }) },
    })));
    expect(await setNewsletterOptIn({ optIn: false })).toEqual({ ok: true, data: { optedIn: false } });
  });

  it("rate-limits per user", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "rate-limited-user" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: null, error: null }) },
    })));
    const now = new Date("2026-10-13T00:00:00Z");
    for (let i = 0; i < 10; i += 1) await setNewsletterOptIn({ optIn: false }, now);
    const limited = await setNewsletterOptIn({ optIn: false }, now);
    expect(limited).toMatchObject({ ok: false, status: 429 });
  });

  it("rethrows a database error for the route to make opaque", async () => {
    vi.mocked(createClient).mockReturnValue(asClient(createMockSupabase({
      user: { id: "u1" },
      tables: {},
      rpcs: { set_newsletter_opt_in: () => ({ data: null, error: { message: "boom" } }) },
    })));
    await expect(setNewsletterOptIn({ optIn: true })).rejects.toBeTruthy();
  });
});
```

Note: `createMockSupabase`'s `rpcCalls` is typed optional on the return; if `tsc` complains, read it as `mock.rpcCalls ?? []`.

- [ ] **Step 3: Run — expect FAIL (module not found)**

Run: `npx vitest run lib/data/newsletter.test.ts`

- [ ] **Step 4: Implement**

```ts
// lib/data/newsletter.ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import type { NewsletterInput, NewsletterState } from "@/lib/validation/newsletter";

const NEWSLETTER_LIMIT = { limit: 10, windowMs: 60_000 };

export type SetNewsletterOptInResult =
  | { ok: true; data: { optedIn: boolean } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

/**
 * App-footer spec N1/N3b: the footer and the Settings row both render from this. Null only for a signed-out
 * caller. A failed read fails CLOSED (`optedIn: false`): showing the form to a subscriber is harmless because
 * `set_newsletter_opt_in(true)` keeps the first consent instant; showing "saved" to a non-subscriber is not.
 * The email is the session's account address (plan P6).
 */
export async function getNewsletterState(): Promise<NewsletterState | null> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return null;
  const email = user.email ?? "";
  try {
    const { data, error } = await supabase
      .from("users")
      .select("newsletter_opt_in_at")
      .eq("id", user.id)
      .single();
    if (error) throw error;
    return { email, optedIn: (data as { newsletter_opt_in_at: string | null }).newsletter_opt_in_at !== null };
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; a failed read must not crash the page.
    console.error("[data/newsletter] getNewsletterState failed:", error);
    return { email, optedIn: false };
  }
}

/** Writes through the definer RPC only (N2); the client never sends an email or an instant. */
export async function setNewsletterOptIn(
  input: NewsletterInput,
  now: Date = new Date(),
): Promise<SetNewsletterOptInResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`newsletter:${user.id}`, NEWSLETTER_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase.rpc("set_newsletter_opt_in", { p_opt_in: input.optIn });
  if (error) throw error;
  return { ok: true, data: { optedIn: data !== null } };
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run lib/data/newsletter.test.ts`

- [ ] **Step 6: Route + tests.** Copy `app/api/user/model-training-consent/route.ts` and its `route.test.ts`; in the copies replace `setModelTrainingConsent` → `setNewsletterOptIn` (from `@/lib/data/newsletter`), `modelTrainingConsentSchema` → `newsletterSchema` (from `@/lib/validation/newsletter`), the log prefix → `[api/user/newsletter]`, every request body `{ consent: … }` → `{ optIn: … }`, and every expected `data` → `{ optedIn: … }`. Keep every case the original test has (invalid JSON 400, schema 400, 401, 429 with `Retry-After`, 200 echo, opaque 500 that never leaks the DB message). Add one case:

```ts
it("ignores any email the client sends and passes only the boolean", async () => {
  vi.mocked(setNewsletterOptIn).mockResolvedValue({ ok: true, data: { optedIn: true } });
  const response = await PATCH(new Request("http://localhost/api/user/newsletter", {
    method: "PATCH",
    body: JSON.stringify({ optIn: true, email: "attacker@example.com" }),
  }));
  expect(response.status).toBe(200);
  expect(vi.mocked(setNewsletterOptIn)).toHaveBeenCalledWith({ optIn: true });
});
```

(zod `object` strips unknown keys, so `parsed.data` is `{ optIn: true }`.)

- [ ] **Step 7: Run route tests, then the full suite**

Run: `npx vitest run app/api/user/newsletter` then `npm test` and `npm run typecheck`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add lib/validation/newsletter.ts lib/data/newsletter.ts lib/data/newsletter.test.ts app/api/user/newsletter
git commit -m "feat(app-footer): newsletter data layer and PATCH route (N2-N3a, T3)"
```

---

### Task 3: Copy

**Files:**
- Modify: `messages/en/marketing.json`, `messages/vi/marketing.json` — add a top-level `appFooter` object beside `footer`.
- Modify: `messages/en/settings.json`, `messages/vi/settings.json` — add a top-level `newsletter` object beside `aiTraining`.

**Interfaces:**
- Produces keys used by Tasks 4 and 6: `marketing.appFooter.{ariaLabel, tagline, closing, app.{eyebrow,heading,body}, newsletter.{heading,purpose,emailLabel,submit,subscribed,manage,signedOut,signIn,error}}`, `settings.newsletter.{title, body}` (`body` takes `{email}`).

- [ ] **Step 1: en `marketing.json` → `appFooter`**

```json
"appFooter": {
  "ariaLabel": "Site footer",
  "tagline": "Your quiet place to grow with Japanese.",
  "closing": "Wherever you are, we'll keep learning together.",
  "app": {
    "eyebrow": "Continue learning anywhere",
    "heading": "Take your next small step with you.",
    "body": "Sync your learning across every device, and come back whenever the day leaves a little room."
  },
  "newsletter": {
    "heading": "A gentle note, once in a while.",
    "purpose": "Sign up for occasional notes on new lessons and study tips, once Korume starts sending them. Unsubscribe anytime in Settings.",
    "emailLabel": "Account email",
    "submit": "Subscribe",
    "subscribed": "Your newsletter sign-up is saved.",
    "manage": "Manage in Settings",
    "signedOut": "Your session has ended. Sign in again to save this.",
    "signIn": "Sign in",
    "error": "Couldn't save that. Please try again."
  }
}
```

- [ ] **Step 2: vi `marketing.json` → `appFooter`** (spec §4, owner-reviewed wording)

```json
"appFooter": {
  "ariaLabel": "Chân trang",
  "tagline": "Góc yên tĩnh để bạn lớn lên cùng tiếng Nhật.",
  "closing": "Dù bạn ở đâu, chúng ta vẫn tiếp tục học cùng nhau.",
  "app": {
    "eyebrow": "Học tiếp ở bất cứ đâu",
    "heading": "Bước học tiếp theo, ở bất cứ đâu.",
    "body": "Đồng bộ việc học trên mọi thiết bị, và quay lại bất cứ khi nào ngày còn chút khoảng trống."
  },
  "newsletter": {
    "heading": "Thỉnh thoảng, một lá thư nhẹ nhàng.",
    "purpose": "Đăng ký để nhận thư về bài học mới và mẹo học khi Korume bắt đầu gửi. Hủy bất cứ lúc nào trong Cài đặt.",
    "emailLabel": "Email tài khoản",
    "submit": "Đăng ký nhận thư",
    "subscribed": "Đã lưu đăng ký nhận thư của bạn.",
    "manage": "Quản lý trong Cài đặt",
    "signedOut": "Phiên đăng nhập đã hết. Đăng nhập lại để lưu nhé.",
    "signIn": "Đăng nhập",
    "error": "Chưa lưu được. Bạn thử lại nhé."
  }
}
```

- [ ] **Step 3: `settings.json` → `newsletter`**

en: `"newsletter": { "title": "Newsletter", "body": "Save your sign-up for Korume's occasional note at {email}. Nothing is sent yet." }`
vi: `"newsletter": { "title": "Thư từ Korume", "body": "Lưu đăng ký nhận thư thỉnh thoảng từ Korume qua {email}. Hiện chưa gửi thư nào." }`

(The spec's §4 wording said "at your account email"; the row now names the address itself, because N4 makes this row the place where the footer's ellipsized email is read whole.)

- [ ] **Step 4: Run catalog tests**

Run: `npx vitest run lib/i18n messages`
Expected: PASS (keysets identical in both locales).

- [ ] **Step 5: Commit**

```bash
git add messages/en/marketing.json messages/vi/marketing.json messages/en/settings.json messages/vi/settings.json
git commit -m "feat(app-footer): footer and settings newsletter copy, en + vi (spec §4)"
```

---

### Task 4: `AppFooter`, its islands, icons and CSS

**Files:**
- Create: `components/layout/app-footer-icon.tsx`
- Create: `components/layout/back-to-top.tsx`, `components/layout/back-to-top.test.tsx`
- Create: `components/layout/footer-newsletter.tsx`, `components/layout/footer-newsletter.test.tsx`
- Create: `components/layout/app-footer.tsx`, `components/layout/app-footer.test.tsx`
- Modify: `app/globals.css` (append the `.app-footer` block after the `.dashboard-*` block)
- Modify: `app/[locale]/(protected)/(app)/layout.tsx` (`<main>`)

**Interfaces:**
- Consumes: `getNewsletterState` (Task 2), `NewsletterState` (Task 2), copy keys (Task 3), `SUPPORT_EMAIL` (`lib/contact.ts`), `APP_STORE_URL`/`PLAY_STORE_URL` (`lib/app-stores.ts`), `motionEnabled()` (`lib/motion/motion-enabled.ts`).
- Produces: `export async function AppFooter(): Promise<JSX.Element>` — rendered by Task 5. Root carries `data-app-footer`. Elements L2b may remove carry `data-footer-reducible="1" | "2" | "3"` (1 = app body, 2 = tagline, 3 = mascot card). The email text carries `data-footer-email`.

- [ ] **Step 1: Icons** (decorative only; geometry = Lucide `mail`, `send`, `arrow-up-right`, `sparkles` on a 24 grid; house style of `components/dashboard/dashboard-icon.tsx`)

```tsx
// components/layout/app-footer-icon.tsx
/** Decorative glyphs for `AppFooter` (Figma 203:13813). ALWAYS `aria-hidden`: the adjacent label names the control. */
export type AppFooterIconKey = "mail" | "send" | "arrowUpRight" | "sparkles";

const GLYPHS: Record<AppFooterIconKey, React.ReactNode> = {
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  send: <><path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.03.93l7.93 3.18a2 2 0 0 1 1.11 1.11Z" /><path d="M21.85 2.15L10.91 13.09" /></>,
  arrowUpRight: <><path d="M7 7h10v10" /><path d="M7 17L17 7" /></>,
  sparkles: <><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0Z" /><path d="M20 3v4" /><path d="M22 5h-4" /></>,
};

export function AppFooterIcon({ name, className }: { name: AppFooterIconKey; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      {GLYPHS[name]}
    </svg>
  );
}
```

- [ ] **Step 2: `<main>` target** — in `app/[locale]/(protected)/(app)/layout.tsx` replace `<main className="min-w-0 flex-1">` with:

```tsx
{/* `id` + `tabIndex={-1}`: AppFooter's "Back to the beginning" moves focus here (app-footer spec F3), so it
    works on a page with no h1. Programmatic focus only — never in the tab order. */}
<main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
```

- [ ] **Step 3: BackToTop — failing test**

```tsx
// components/layout/back-to-top.test.tsx
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { BackToTop } from "./back-to-top";
import { motionEnabled } from "@/lib/motion/motion-enabled";

vi.mock("@/lib/motion/motion-enabled", () => ({ motionEnabled: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

function mountMain() {
  const main = document.createElement("main");
  main.id = "main-content";
  main.tabIndex = -1;
  document.body.appendChild(main);
  return main;
}

describe("BackToTop (spec F3)", () => {
  it("scrolls the window to the top smoothly and focuses <main>", () => {
    vi.mocked(motionEnabled).mockReturnValue(true);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const main = mountMain();
    render(<BackToTop label="Back to the beginning" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to the beginning" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    expect(document.activeElement).toBe(main);
    main.remove();
  });

  it("jumps without animation when motion is reduced", () => {
    vi.mocked(motionEnabled).mockReturnValue(false);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<BackToTop label="Back to the beginning" />);
    fireEvent.click(screen.getByRole("button", { name: "Back to the beginning" }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
```

Run: `npx vitest run components/layout/back-to-top.test.tsx` — expect FAIL. (If `@/test/render` does not re-export `fireEvent`, import it from `@testing-library/react`.)

- [ ] **Step 4: BackToTop — implement**

```tsx
// components/layout/back-to-top.tsx
"use client";

import { motionEnabled } from "@/lib/motion/motion-enabled";
import { AppFooterIcon } from "./app-footer-icon";

/**
 * App-footer spec F3. The `(app)` layout has no scroll container, so the WINDOW scrolls. Focus then moves to
 * `<main id="main-content">` (tabIndex -1) so keyboard and screen-reader users land at the top too.
 */
export function BackToTop({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="app-footer__top"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: motionEnabled() ? "smooth" : "auto" });
        document.getElementById("main-content")?.focus({ preventScroll: true });
      }}
    >
      {label}
      <AppFooterIcon name="arrowUpRight" className="app-footer__top-icon" />
    </button>
  );
}
```

Run the test — expect PASS.

- [ ] **Step 5: FooterNewsletter — failing tests**

```tsx
// components/layout/footer-newsletter.test.tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@/test/render";
import { FooterNewsletter } from "./footer-newsletter";
import en from "@/messages/en/marketing.json";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

const copy = en.appFooter.newsletter;
const EMAIL = "a.very.long.learner.address.for.the.footer.test@korume-example.com";

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function respond(status: number) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { optedIn: true } }), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("FooterNewsletter (spec N3/N3a)", () => {
  it("shows the account email as labelled text, never as an input, with the full address kept", () => {
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText(copy.emailLabel)).toBeInTheDocument();
    const email = document.querySelector("[data-footer-email]");
    expect(email).toHaveTextContent(EMAIL);
    expect(email).toHaveAttribute("title", EMAIL);
    expect(screen.getByText(copy.purpose)).toBeInTheDocument();
  });

  it("sends only { optIn: true }, then shows the saved line and refreshes the router", async () => {
    const fetchMock = respond(200);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await screen.findByText(copy.subscribed);
    expect(fetchMock).toHaveBeenCalledWith("/api/user/newsletter", expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ optIn: true }),
    }));
    expect(screen.getByRole("link", { name: copy.manage })).toHaveAttribute("href", "/en/settings#newsletter");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("disables the button while pending, so a double click is one request", async () => {
    let resolve!: (r: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => { resolve = r; }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    const button = screen.getByRole("button", { name: copy.submit });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve(new Response("{}", { status: 200 }));
    await screen.findByText(copy.subscribed);
  });

  it("401 shows the signed-out state and claims nothing", async () => {
    respond(401);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.signedOut);
    expect(screen.queryByText(copy.subscribed)).toBeNull();
    expect(screen.getByRole("button", { name: copy.signIn })).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("a server or network error keeps the form and shows an alert", async () => {
    respond(500);
    render(<FooterNewsletter email={EMAIL} initialOptedIn={false} />);
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.error);
    expect(screen.getByRole("button", { name: copy.submit })).toBeEnabled();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    fireEvent.click(screen.getByRole("button", { name: copy.submit }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(copy.error));
  });

  it("an already subscribed learner sees the saved line, not the form", () => {
    render(<FooterNewsletter email={EMAIL} initialOptedIn />);
    expect(screen.getByText(copy.subscribed)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.submit })).toBeNull();
  });
});
```

Run: `npx vitest run components/layout/footer-newsletter.test.tsx` — expect FAIL.

- [ ] **Step 6: FooterNewsletter — implement**

```tsx
// components/layout/footer-newsletter.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { AppFooterIcon } from "./app-footer-icon";

type Status = "idle" | "pending" | "subscribed" | "signedOut" | "error";

/**
 * App-footer spec N3/N3a. Saving a consent is the only claim made — never that mail will arrive (N5).
 * The request carries `{ optIn: true }` only; the server uses the session user (N3a). A confirmed save calls
 * `router.refresh()` so Settings, and this page's server props, re-read the column (plan P2).
 * Signed out (401): "Sign in" reloads, and the auth middleware sends the request to
 * `/login?redirectTo=<this page>` (plan P5).
 */
export function FooterNewsletter({ email, initialOptedIn }: { email: string; initialOptedIn: boolean }) {
  const t = useTranslations("marketing");
  const router = useRouter();
  const [status, setStatus] = useState<Status>(initialOptedIn ? "subscribed" : "idle");

  async function subscribe() {
    if (status === "pending") return;
    setStatus("pending");
    try {
      const response = await fetch("/api/user/newsletter", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optIn: true }),
      });
      if (response.status === 401) return setStatus("signedOut");
      if (!response.ok) return setStatus("error");
      setStatus("subscribed");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="app-footer__newsletter">
      <p className="app-footer__newsletter-heading">{t("appFooter.newsletter.heading")}</p>
      {status === "subscribed" ? (
        <p role="status" className="app-footer__newsletter-done">
          {t("appFooter.newsletter.subscribed")}{" "}
          <Link href="/settings#newsletter" className="app-footer__link">{t("appFooter.newsletter.manage")}</Link>
        </p>
      ) : (
        <>
          <p className="app-footer__purpose">{t("appFooter.newsletter.purpose")}</p>
          <div className="app-footer__field">
            <div className="app-footer__pill">
              <span className="app-footer__pill-label">{t("appFooter.newsletter.emailLabel")}</span>
              <span data-footer-email title={email} className="app-footer__email">{email}</span>
            </div>
            <button
              type="button"
              onClick={subscribe}
              disabled={status === "pending"}
              aria-busy={status === "pending"}
              aria-label={t("appFooter.newsletter.submit")}
              className="app-footer__send"
            >
              <AppFooterIcon name="send" className="app-footer__send-icon" />
            </button>
          </div>
          {status === "signedOut" ? (
            <p role="alert" className="app-footer__message">
              {t("appFooter.newsletter.signedOut")}{" "}
              <button type="button" className="app-footer__link" onClick={() => window.location.reload()}>
                {t("appFooter.newsletter.signIn")}
              </button>
            </p>
          ) : null}
          {status === "error" ? (
            <p role="alert" className="app-footer__message">{t("appFooter.newsletter.error")}</p>
          ) : null}
        </>
      )}
    </div>
  );
}
```

Run the test — expect PASS. Mutation: change the body to `JSON.stringify({ optIn: true, email })` → the "sends only" test must go red; restore.

- [ ] **Step 7: AppFooter — failing test**

```tsx
// components/layout/app-footer.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { AppFooter } from "./app-footer";
import { getNewsletterState } from "@/lib/data/newsletter";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import en from "@/messages/en/marketing.json";

vi.mock("@/lib/data/newsletter", () => ({ getNewsletterState: vi.fn() }));
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh: vi.fn() }),
}));

const f = en.footer;
const a = en.appFooter;

/** Spec F3: interactive elements and their destinations. Home is /dashboard, not the landing. */
const LINKS: ReadonlyArray<readonly [string, string]> = [
  [f.columns.explore.home, "/en/dashboard"],
  [f.columns.explore.roadmap, "/en/roadmap"],
  [f.columns.explore.contact, `mailto:${SUPPORT_EMAIL}`],
  [f.mascot.cta, "/en/companion"],
];
/** Spec F3: kept as text. */
const TEXT_ONLY = [f.columns.legal.privacy, f.columns.legal.terms] as const;
/** Spec F3 round 3: not rendered at all. */
const CUT = [
  f.columns.explore.pricing, f.columns.explore.faq, f.columns.explore.blog, f.columns.explore.about,
  f.columns.explore.careers, f.columns.community.discord, f.columns.community.facebook,
  f.columns.community.tiktok, f.columns.community.heading, SUPPORT_EMAIL,
] as const;

async function renderFooter(state: Awaited<ReturnType<typeof getNewsletterState>>) {
  vi.mocked(getNewsletterState).mockResolvedValue(state);
  return render(await AppFooter());
}

describe("AppFooter (spec F3, L1, T1)", () => {
  it("links exactly the F3 destinations", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    for (const [name, href] of LINKS) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByRole("link", { name: new RegExp(en.footer.app.appStore.name) })).toHaveAttribute("href", APP_STORE_URL);
    expect(screen.getByRole("link", { name: new RegExp(en.footer.app.playStore.name) })).toHaveAttribute("href", PLAY_STORE_URL);
  });

  it("keeps Legal as text and renders none of the cut labels", async () => {
    await renderFooter({ email: "learner@example.com", optedIn: false });
    for (const label of TEXT_ONLY) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: label })).toBeNull();
    }
    for (const label of CUT) expect(screen.queryByText(label)).toBeNull();
  });

  it("has three sections and the frame's bottom band", async () => {
    const { container } = await renderFooter({ email: "learner@example.com", optedIn: false });
    const footer = container.querySelector("footer[data-app-footer]");
    expect(footer).toHaveAttribute("aria-label", a.ariaLabel);
    expect(footer?.querySelectorAll(".app-footer__row > *")).toHaveLength(3);
    for (const heading of [f.columns.explore.heading, f.columns.support.heading, f.columns.legal.heading]) {
      expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
    }
    expect(screen.getByText(a.closing)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: new RegExp(f.backToTop) })).toBeInTheDocument();
  });

  it("marks only the L2b-reducible elements, in their fixed order", async () => {
    const { container } = await renderFooter({ email: "learner@example.com", optedIn: false });
    const marked = [...container.querySelectorAll("[data-footer-reducible]")].map((el) => el.getAttribute("data-footer-reducible"));
    expect(marked.sort()).toEqual(["1", "2", "3"]);
    expect(container.querySelector('[data-footer-reducible="1"]')).toHaveTextContent(a.app.body);
    expect(container.querySelector('[data-footer-reducible="2"]')).toHaveTextContent(a.tagline);
    expect(container.querySelector('[data-footer-reducible="3"]')).toHaveAttribute("href", "/en/companion");
  });

  it("omits the newsletter form when there is no signed-in user", async () => {
    await renderFooter(null);
    expect(screen.queryByRole("button", { name: a.newsletter.submit })).toBeNull();
  });
});
```

Run: `npx vitest run components/layout/app-footer.test.tsx` — expect FAIL.

- [ ] **Step 8: AppFooter — implement**

```tsx
// components/layout/app-footer.tsx
import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getNewsletterState } from "@/lib/data/newsletter";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";
import { AppFooterIcon } from "./app-footer-icon";
import { BackToTop } from "./back-to-top";
import { FooterNewsletter } from "./footer-newsletter";

/**
 * Figma Footer `203:13813` on the outer app pages (spec docs/superpowers/specs/2026-10-13-app-footer-design.md).
 * F1/F2: pages render this as the last element of their tree — never a layout (pin:
 * `app-footer-placement.test.ts`). L1: the frame's three sections with the owner's reallocated space; sizes live
 * in `app/globals.css` `.app-footer`. F3: a label with no destination is text; the round-3 cuts are not rendered.
 * `data-footer-reducible` marks the only content L2b may remove, in its fixed order.
 */
export async function AppFooter() {
  const [t, newsletter] = await Promise.all([getTranslations("marketing"), getNewsletterState()]);

  return (
    <footer data-app-footer aria-label={t("appFooter.ariaLabel")} className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__row">
          <div className="app-footer__brand">
            <p className="app-footer__logo">
              <span aria-hidden="true" className="app-footer__logo-tile">K</span>
              <span className="app-footer__wordmark">{t("footer.wordmark")}</span>
            </p>
            <p className="app-footer__tagline" data-footer-reducible="2">{t("appFooter.tagline")}</p>
            <Link href="/companion" aria-label={t("footer.mascot.cta")} className="app-footer__mascot" data-footer-reducible="3">
              <span className="app-footer__mascot-art">
                {/* F6 + plan P4: the landing footer's own trimmed art, not the frame's captioned sheet crop. */}
                <Image data-mascot src="/mascot/poses/sleeping.png" alt="" width={276} height={213} aria-hidden="true" unoptimized />
              </span>
              <span className="app-footer__word-tile">
                <span lang="ja" className="app-footer__word-tile-jp">{t("footer.wordmarkJp")}</span>
                <span className="app-footer__word-tile-en">{t("footer.wordmark")}</span>
              </span>
              <span aria-hidden="true" className="app-footer__chip">▣</span>
              <AppFooterIcon name="sparkles" className="app-footer__sparkle" />
            </Link>
          </div>

          <div className="app-footer__links">
            <nav aria-labelledby="app-footer-explore">
              <h2 id="app-footer-explore" className="app-footer__heading">{t("footer.columns.explore.heading")}</h2>
              <ul className="app-footer__list">
                <li><Link href="/dashboard" className="app-footer__link">{t("footer.columns.explore.home")}</Link></li>
                <li><Link href="/roadmap" className="app-footer__link">{t("footer.columns.explore.roadmap")}</Link></li>
              </ul>
            </nav>
            <div className="app-footer__stack">
              <nav aria-labelledby="app-footer-support">
                <h2 id="app-footer-support" className="app-footer__heading">{t("footer.columns.support.heading")}</h2>
                <ul className="app-footer__list">
                  <li>
                    <a href={`mailto:${SUPPORT_EMAIL}`} className="app-footer__link">
                      <AppFooterIcon name="mail" className="app-footer__link-icon" />
                      {t("footer.columns.explore.contact")}
                    </a>
                  </li>
                </ul>
              </nav>
              <div>
                <h2 className="app-footer__heading">{t("footer.columns.legal.heading")}</h2>
                <ul className="app-footer__list">
                  <li className="app-footer__text">{t("footer.columns.legal.privacy")}</li>
                  <li className="app-footer__text">{t("footer.columns.legal.terms")}</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="app-footer__app">
            <p className="app-footer__heading">{t("appFooter.app.eyebrow")}</p>
            <h2 className="app-footer__title">{t("appFooter.app.heading")}</h2>
            <p className="app-footer__body" data-footer-reducible="1">{t("appFooter.app.body")}</p>
            {/* O1 (owner 2026-10-13): Korume is not published; these open the stores' front pages, as on the landing. */}
            <div className="app-footer__badges">
              <a href={APP_STORE_URL} target="_blank" rel="noreferrer noopener" className="app-footer__badge">
                <span aria-hidden="true" className="app-footer__badge-chip">●</span>
                <span className="app-footer__badge-text">
                  <span className="app-footer__badge-prefix">{t("footer.app.appStore.prefix")}</span>
                  <span className="app-footer__badge-name">{t("footer.app.appStore.name")}</span>
                </span>
              </a>
              <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer noopener" className="app-footer__badge">
                <span aria-hidden="true" className="app-footer__badge-chip app-footer__badge-chip--play">▶</span>
                <span className="app-footer__badge-text">
                  <span className="app-footer__badge-prefix">{t("footer.app.playStore.prefix")}</span>
                  <span className="app-footer__badge-name">{t("footer.app.playStore.name")}</span>
                </span>
              </a>
            </div>
            <hr className="app-footer__rule" />
            {newsletter ? (
              // Keyed on the server value (plan P2): a router.refresh() that changes it resets the island.
              <FooterNewsletter key={String(newsletter.optedIn)} email={newsletter.email} initialOptedIn={newsletter.optedIn} />
            ) : null}
          </div>
        </div>

        <div className="app-footer__bottom">
          <p className="app-footer__closing">{t("appFooter.closing")}</p>
          <p className="app-footer__copyright">{t("footer.copyright", { year: new Date().getFullYear() })}</p>
          <BackToTop label={t("footer.backToTop")} />
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 9: CSS** — append to `app/globals.css` after the `.dashboard-*` rules. Values are the L1 targets; Task 8 measures and adjusts only numbers, never structure.

```css
/* App footer (spec docs/superpowers/specs/2026-10-13-app-footer-design.md L1–L3). Figma `203:13813`'s three
   sections with the owner's reallocated space: `--f` is one design px at a 1017px footer (1280 viewport, nav
   open). One composition at every width, one row, never a variant (L2). Text floor 12px; links, buttons and
   the email pill 14px. `--f` holds `cqi`, which resolves against `.app-footer`; nothing inside declares a
   container. Floor/ceiling pinned by measurement (L2d, run state). */
.app-footer { container: app-footer / inline-size; border-top: 1px solid hsl(var(--border)); }
.app-footer__inner {
  --f: clamp(0.9px, calc(100cqi / 1017), 1.6px);
  padding: calc(48 * var(--f)) calc(24 * var(--f)) calc(28 * var(--f));
  font-size: max(14px, calc(14 * var(--f)));
  line-height: 1.5;
  color: hsl(var(--muted-foreground));
}
.app-footer__row {
  display: grid;
  grid-template-columns: minmax(0, 230fr) minmax(0, 330fr) minmax(0, 361fr);
  column-gap: calc(24 * var(--f));
  align-items: start;
}
.app-footer__heading { margin: 0 0 calc(12 * var(--f)); font-size: max(12px, calc(11 * var(--f))); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; white-space: nowrap; color: hsl(var(--primary)); }
.app-footer__logo { display: flex; align-items: center; gap: calc(8 * var(--f)); margin: 0; }
.app-footer__logo-tile { display: grid; place-items: center; inline-size: calc(36 * var(--f)); block-size: calc(36 * var(--f)); border-radius: calc(8 * var(--f)); background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); font-weight: 700; font-size: max(14px, calc(16 * var(--f))); }
.app-footer__wordmark { font-family: var(--font-display), var(--font-sans), sans-serif; font-size: calc(22 * var(--f)); font-weight: 600; letter-spacing: -0.02em; white-space: nowrap; color: hsl(var(--foreground)); }
.app-footer__tagline { margin: calc(12 * var(--f)) 0 0; }
.app-footer__mascot { position: relative; display: block; margin-top: calc(20 * var(--f)); aspect-ratio: 310 / 190; border: 1px solid hsl(var(--border)); border-radius: calc(20 * var(--f)); background: hsl(var(--card)); }
.app-footer__mascot:hover { border-color: hsl(var(--primary) / 0.4); }
.app-footer__mascot-art { position: absolute; inset-block-start: 8.5%; inset-inline-end: 4%; inline-size: 50%; }
.app-footer__mascot-art img { inline-size: 100%; block-size: auto; }
.app-footer__word-tile { position: absolute; inset-inline-start: 6.7%; inset-block-end: 9%; inline-size: 61%; aspect-ratio: 190 / 70; display: flex; flex-direction: column; justify-content: space-between; padding: calc(10 * var(--f)) calc(12 * var(--f)); border: 1px solid hsl(var(--primary) / 0.35); border-radius: calc(10 * var(--f)); background: hsl(var(--primary) / 0.08); }
.app-footer__word-tile-jp { font-family: var(--font-jp); font-size: max(14px, calc(16 * var(--f))); color: hsl(var(--primary)); }
.app-footer__word-tile-en { align-self: flex-end; font-size: max(12px, calc(9 * var(--f))); letter-spacing: 0.2em; text-transform: uppercase; color: hsl(var(--primary) / 0.6); }
.app-footer__chip { position: absolute; inset-inline-end: 22%; inset-block-end: 13%; display: grid; place-items: center; inline-size: calc(26 * var(--f)); block-size: calc(26 * var(--f)); border-radius: calc(6 * var(--f)); background: hsl(var(--primary) / 0.2); color: hsl(var(--primary)); font-size: max(12px, calc(12 * var(--f))); }
.app-footer__sparkle { position: absolute; inset-inline-end: 4%; inset-block-start: 7%; inline-size: calc(13 * var(--f)); block-size: calc(13 * var(--f)); color: hsl(var(--primary)); }
.app-footer__links { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: calc(24 * var(--f)); }
.app-footer__stack { display: grid; row-gap: calc(24 * var(--f)); }
.app-footer__list { margin: 0; padding: 0; list-style: none; }
.app-footer__link, .app-footer__text { display: inline-flex; align-items: center; gap: calc(8 * var(--f)); min-block-size: var(--hit-target-min); white-space: nowrap; font-size: max(14px, calc(14 * var(--f))); }
.app-footer__link { color: hsl(var(--muted-foreground)); background: none; border: 0; padding: 0; cursor: pointer; }
.app-footer__link:hover { color: hsl(var(--foreground)); }
.app-footer__link-icon { inline-size: calc(14 * var(--f)); block-size: calc(14 * var(--f)); flex: none; }
.app-footer__title { margin: 0; font-family: var(--font-display), var(--font-sans), sans-serif; font-size: calc(24 * var(--f)); font-weight: 600; line-height: 1.25; letter-spacing: -0.02em; color: hsl(var(--foreground)); }
.app-footer__body { margin: calc(12 * var(--f)) 0 0; font-size: max(13px, calc(13 * var(--f))); }
.app-footer__badges { display: flex; gap: calc(12 * var(--f)); margin-top: calc(20 * var(--f)); }
.app-footer__badge { flex: 0 1 calc(164 * var(--f)); min-inline-size: 0; display: flex; align-items: center; gap: calc(12 * var(--f)); min-block-size: max(var(--hit-target-min), calc(56 * var(--f))); padding: calc(10 * var(--f)) calc(14 * var(--f)); border: 1px solid hsl(var(--border)); border-radius: calc(14 * var(--f)); background: hsl(var(--card)); color: hsl(var(--foreground)); }
.app-footer__badge:hover { border-color: hsl(var(--primary) / 0.4); }
.app-footer__badge-chip { display: grid; place-items: center; flex: none; inline-size: calc(32 * var(--f)); block-size: calc(32 * var(--f)); border-radius: 9999px; background: hsl(var(--secondary)); font-size: max(12px, calc(14 * var(--f))); }
.app-footer__badge-chip--play { color: hsl(var(--primary)); background: hsl(var(--primary) / 0.15); }
.app-footer__badge-text { display: flex; flex-direction: column; min-inline-size: 0; }
.app-footer__badge-prefix { font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; color: hsl(var(--muted-foreground)); }
.app-footer__badge-name { font-size: max(14px, calc(15 * var(--f))); font-weight: 700; white-space: nowrap; }
.app-footer__rule { margin: calc(24 * var(--f)) 0; border: 0; border-top: 1px solid hsl(var(--border)); }
.app-footer__newsletter-heading { margin: 0; font-size: max(13px, calc(13 * var(--f))); font-weight: 600; color: hsl(var(--foreground)); }
.app-footer__purpose, .app-footer__message, .app-footer__newsletter-done { margin: calc(6 * var(--f)) 0 0; font-size: max(12px, calc(12 * var(--f))); }
.app-footer__field { display: flex; align-items: center; gap: calc(8 * var(--f)); margin-top: calc(12 * var(--f)); }
.app-footer__pill { flex: 1 1 auto; min-inline-size: 0; display: flex; flex-direction: column; justify-content: center; min-block-size: var(--hit-target-min); padding: calc(4 * var(--f)) calc(14 * var(--f)); border: 1px solid hsl(var(--border)); border-radius: 9999px; background: hsl(var(--card)); }
.app-footer__pill-label { font-size: 12px; line-height: 1.2; }
/* The ONE ellipsis the footer allows (L3): the full address stays in the DOM and in `title`. */
.app-footer__email { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: max(14px, calc(14 * var(--f))); line-height: 1.3; color: hsl(var(--foreground)); }
.app-footer__send { display: grid; place-items: center; flex: none; inline-size: var(--hit-target-min); block-size: var(--hit-target-min); border-radius: 9999px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); }
.app-footer__send:disabled { opacity: 0.6; cursor: progress; }
.app-footer__send-icon { inline-size: calc(16 * var(--f)); block-size: calc(16 * var(--f)); }
.app-footer__bottom { display: grid; justify-items: center; gap: calc(6 * var(--f)); margin-top: calc(40 * var(--f)); padding-top: calc(28 * var(--f)); border-top: 1px solid hsl(var(--border)); text-align: center; }
.app-footer__closing { margin: 0; font-family: var(--font-display), var(--font-sans), sans-serif; font-size: max(14px, calc(16 * var(--f))); white-space: nowrap; color: hsl(var(--foreground)); }
.app-footer__copyright { margin: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; }
.app-footer__top { display: inline-flex; align-items: center; gap: calc(4 * var(--f)); min-block-size: var(--hit-target-min); font-size: max(12px, calc(12 * var(--f))); font-weight: 600; color: hsl(var(--primary)); }
.app-footer__top-icon { inline-size: calc(11 * var(--f)); block-size: calc(11 * var(--f)); }
.app-footer a:focus-visible, .app-footer button:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
```

Before committing, grep that every token used exists: `grep -n -- "--secondary:\|--ring:\|--foreground:" app/globals.css`. If one is missing, use the nearest existing semantic token and note it in the run state.

- [ ] **Step 10: Run the three component tests, then the full suite and typecheck**

Run: `npx vitest run components/layout` then `npm test` and `npm run typecheck` and `npm run lint`
Expected: all green. Mutation: drop `data-footer-reducible="2"` → the reducible test goes red; restore.

- [ ] **Step 11: Commit**

```bash
git add components/layout/app-footer*.tsx components/layout/back-to-top*.tsx components/layout/footer-newsletter*.tsx app/globals.css "app/[locale]/(protected)/(app)/layout.tsx"
git commit -m "feat(app-footer): AppFooter, newsletter island, back-to-top and scaled layout (F3, L1-L3, N3a, T1)"
```

---

### Task 5: Placement on the 13 pages

**Files:**
- Create: `components/layout/app-footer-placement.test.ts`
- Modify the 13 page files below (all under `app/[locale]/(protected)/(app)/`).

**Interfaces:**
- Consumes: `AppFooter` (Task 4).

- [ ] **Step 1: Failing placement test**

```ts
// components/layout/app-footer-placement.test.ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Spec F1, verbatim. Static half of T2 (plan P3); the runtime "exactly one" half is tests/e2e/app-footer.spec.ts. */
const APP = "app/[locale]/(protected)/(app)";
const WITH_FOOTER = new Set([
  "shadowing", "shadowing/explore",
  "pronunciation", "pronunciation/collections/[slug]", "pronunciation/paths",
  "kanji", "grammar", "conversation", "certification",
  "playlists", "playlists/[id]", "mining", "profile",
].map((route) => `${APP}/${route}/page.tsx`));

const posix = (p: string) => p.split(path.sep).join("/");
const pages = readdirSync("app", { recursive: true, encoding: "utf8" })
  .map((rel) => posix(path.join("app", rel)))
  .filter((file) => file.endsWith("/page.tsx"));

describe("AppFooter placement (spec F1/F2, T2 static)", () => {
  it("lists 13 routes and every one exists", () => {
    expect(WITH_FOOTER.size).toBe(13);
    for (const file of WITH_FOOTER) expect(pages, file).toContain(file);
  });

  it("is rendered by exactly the listed pages", () => {
    for (const file of pages) {
      const renders = /<AppFooter\b/.test(readFileSync(file, "utf8"));
      expect(renders, file).toBe(WITH_FOOTER.has(file));
    }
  });

  it("is never rendered by a layout", () => {
    const layouts = readdirSync("app", { recursive: true, encoding: "utf8" })
      .map((rel) => posix(path.join("app", rel)))
      .filter((file) => file.endsWith("/layout.tsx"));
    for (const file of layouts) expect(/AppFooter/.test(readFileSync(file, "utf8")), file).toBe(false);
  });
});
```

Run: `npx vitest run components/layout/app-footer-placement.test.ts` — expect FAIL (13 files without it).

- [ ] **Step 2: Add the footer to each page.** For every file in the list:
  1. `import { AppFooter } from "@/components/layout/app-footer";`
  2. In the **default export** only (not `generateMetadata`), find every `return` that returns page UI (`grep -n "return" <file>`; skip `redirect(...)`/`notFound()` paths). Wrap each such return in a fragment with the footer last, outside the page's own container:

```tsx
return (
  <>
    {/* existing returned JSX, unchanged */}
    <AppFooter />
  </>
);
```

  Files: `shadowing/page.tsx`, `shadowing/explore/page.tsx`, `pronunciation/page.tsx`, `pronunciation/collections/[slug]/page.tsx`, `pronunciation/paths/page.tsx`, `kanji/page.tsx`, `grammar/page.tsx`, `conversation/page.tsx`, `certification/page.tsx`, `playlists/page.tsx`, `playlists/[id]/page.tsx`, `mining/page.tsx`, `profile/page.tsx`.

  ⚠️ `pronunciation/page.tsx` has several `return`s; read the default export (`PronunciationPage`, line ~53) whole before editing, and add the footer to every UI branch it returns. A helper's `return` is not a page branch.

- [ ] **Step 3: Run the placement test, existing page tests, full suite**

Run: `npx vitest run components/layout/app-footer-placement.test.ts` then `npm test` and `npm run typecheck`
Expected: green. Page tests that render a page component will now hit `AppFooter` → `getNewsletterState`; if one fails on an unmocked `createClient`, add `vi.mock("@/components/layout/app-footer", () => ({ AppFooter: () => null }))` to THAT test file (the footer has its own tests) and say so in the commit body.

- [ ] **Step 4: Commit**

```bash
git add components/layout/app-footer-placement.test.ts "app/[locale]/(protected)/(app)"
git commit -m "feat(app-footer): render AppFooter on the 13 outer app pages (F1-F2, T2 static)"
```

---

### Task 6: Settings newsletter row

**Files:**
- Modify: `components/settings/settings-icon.tsx` (add `mail`)
- Modify: `components/settings/privacy-data-section.tsx` (`NewsletterRow`, new prop)
- Modify: `components/settings/settings-page.tsx` (thread the prop)
- Modify: `app/[locale]/(protected)/(app)/settings/page.tsx` (read the state)
- Modify: `components/settings/settings-row.tsx` only if its description element lacks wrapping for an unbroken address (add `[overflow-wrap:anywhere]` to that element)
- Test: `components/settings/privacy-data-section.test.tsx` (create if absent, else extend), plus every existing test that renders `SettingsPage`/`PrivacyDataSection` (add the new prop)

**Interfaces:**
- Consumes: `getNewsletterState`, `NewsletterState` (Task 2); `settings.newsletter.*` (Task 3); `usePreferenceSave(control, endpoint)` returning `save(body, optimistic) → Promise<"saved" | "failed" | "superseded">`.
- Produces: `PrivacyDataSection({ initialAiTrainingConsent, initialNewsletter }: { initialAiTrainingConsent: boolean; initialNewsletter: NewsletterState | null })`; `SettingsPage` gains `initialNewsletter: NewsletterState | null`; element `#newsletter` wraps the row.

- [ ] **Step 1: Failing tests**

```tsx
// components/settings/privacy-data-section.test.tsx — NEW file (none exists today). Copy the provider/mock
// wrapper that components/settings/sections.test.tsx or settings-page.test.tsx uses to render the privacy
// section: PrivacyDataSection needs PreferencesProvider and the toast provider.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@/test/render";
import en from "@/messages/en/settings.json";

const refresh = vi.fn();
vi.mock("@/lib/i18n/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/i18n/navigation")>()),
  useRouter: () => ({ refresh }),
}));

describe("PrivacyDataSection newsletter row (spec N4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the full account email and the saved state, anchored #newsletter", () => {
    renderSection({ email: "learner@example.com", optedIn: true });
    expect(document.getElementById("newsletter")).not.toBeNull();
    expect(screen.getByText(/learner@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: en.newsletter.title })).toBeChecked();
  });

  it("PATCHes { optIn } to /api/user/newsletter and refreshes on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { optedIn: false } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderSection({ email: "learner@example.com", optedIn: true });
    fireEvent.click(screen.getByRole("switch", { name: en.newsletter.title }));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/user/newsletter", expect.objectContaining({ body: JSON.stringify({ optIn: false }) }));
  });

  it("rolls the switch back when the save fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    renderSection({ email: "learner@example.com", optedIn: true });
    const toggle = screen.getByRole("switch", { name: en.newsletter.title });
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toBeChecked());
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders no row without a signed-in state", () => {
    renderSection(null);
    expect(screen.queryByRole("switch", { name: en.newsletter.title })).toBeNull();
  });
});
```

`renderSection(state)` = the existing wrapper used for `PrivacyDataSection` in its sibling tests, passing `initialAiTrainingConsent={false} initialNewsletter={state}`. Read how `usePreferenceSave`'s fetch is invoked (`method`, headers) in `components/settings/use-preference-save.ts` and match `expect.objectContaining` to it.

Run: `npx vitest run components/settings/privacy-data-section.test.tsx` — expect FAIL.

- [ ] **Step 2: `mail` icon** — add `| "mail"` to `SettingsIconKey` in `components/settings/settings-icon.tsx`, and to its glyph map, in that file's own format:

```tsx
mail: (
  <>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </>
),
```

- [ ] **Step 3: Row** — in `privacy-data-section.tsx`: add `import { useRouter } from "@/lib/i18n/navigation";` and `import type { NewsletterState } from "@/lib/validation/newsletter";`; extend the props with `initialNewsletter: NewsletterState | null`; add `const newsletterId = useId();`; render after `<AiTrainingRow … />`:

```tsx
{initialNewsletter ? <NewsletterRow id={newsletterId} initial={initialNewsletter} /> : null}
```

and the component, beside `AiTrainingRow`:

```tsx
/**
 * App-footer spec N4: the same `users.newsletter_opt_in_at` the footer writes, through the same route. Like AI
 * Training it is not a `user_preferences` column, so it keeps local state and rolls back only on `"failed"`
 * (see `AiTrainingRow`). A confirmed save refreshes the router so the footer re-reads it (plan P2). The body
 * names the full address: this row is where the footer's ellipsized email is read whole (L3).
 */
function NewsletterRow({ id, initial }: { id: string; initial: NewsletterState }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [optedIn, setOptedIn] = useState(initial.optedIn);
  const save = usePreferenceSave("newsletter", "/api/user/newsletter");

  return (
    <div id="newsletter">
      <SettingsRow
        icon="mail"
        label={t("newsletter.title")}
        description={t("newsletter.body", { email: initial.email })}
        htmlFor={id}
        control={
          <Switch
            id={id}
            checked={optedIn}
            onCheckedChange={(checked) => {
              const previous = optedIn;
              setOptedIn(checked);
              void save.save({ optIn: checked }, {}).then((outcome) => {
                if (outcome === "failed") setOptedIn(previous);
                if (outcome === "saved") router.refresh();
              });
            }}
          />
        }
      />
    </div>
  );
}
```

- [ ] **Step 4: Thread the prop** — `SettingsPageProps` gains `initialNewsletter: NewsletterState | null` (type-only import from `@/lib/validation/newsletter`) passed to `<PrivacyDataSection … initialNewsletter={initialNewsletter} />`. In `settings/page.tsx`:

```tsx
import { getNewsletterState } from "@/lib/data/newsletter";
// …
const [{ consent }, pending, newsletter] = await Promise.all([
  getModelTrainingConsent(),
  readPendingDeletionSafe(),
  getNewsletterState(),
]);
return <SettingsPage initialAiTrainingConsent={consent} initialNewsletter={newsletter} pending={pending} version={version} />;
```

Update the page's doc comment ("Only two server reads" → three). Fix every test that renders `SettingsPage`/`PrivacyDataSection` (TypeScript lists them) by passing `initialNewsletter={null}` unless the test is about the row.

- [ ] **Step 5: Run settings tests, full suite, typecheck, lint**

Run: `npx vitest run components/settings "app/[locale]/(protected)/(app)/settings"` then `npm test`, `npm run typecheck`, `npm run lint`
Expected: green. Mutation: remove the `router.refresh()` line → "refreshes on success" goes red; restore.

- [ ] **Step 6: Commit**

```bash
git add components/settings "app/[locale]/(protected)/(app)/settings/page.tsx"
git commit -m "feat(app-footer): Settings newsletter row sharing the footer's consent (N4, N3b)"
```

---

### Task 7: E2E — subscribe, manage, unsubscribe, and one footer per page

**Files:**
- Create: `tests/e2e/app-footer.spec.ts`

**Interfaces:**
- Consumes: `registerViaUi`, `uniqueEmail` from `tests/e2e/fixtures/auth.ts`; copy from `messages/en/*.json`.

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/app-footer.spec.ts
import { test, expect, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import marketing from "../../messages/en/marketing.json";
import settings from "../../messages/en/settings.json";

/**
 * App footer (spec T5 + the runtime half of T2, plan P3). Unit tests prove each surface calls the route; only a
 * real round trip proves the two surfaces agree through `users.newsletter_opt_in_at`, including after a client
 * navigation inside Next's router-cache window (Review Focus 3).
 */
const copy = marketing.appFooter.newsletter;

async function signUp(page: Page, tag: string) {
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Footer Tester", email: uniqueEmail(`e2e_footer_${tag}`), password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15000 });
}

/** Statically reachable routes from spec F1 (the two [param] routes are covered by the static test). */
const WITH_FOOTER = ["/en/shadowing", "/en/shadowing/explore", "/en/pronunciation", "/en/pronunciation/paths",
  "/en/kanji", "/en/grammar", "/en/conversation", "/en/certification", "/en/playlists", "/en/mining", "/en/profile"];
const WITHOUT_FOOTER = ["/en/dashboard", "/en/settings", "/en/kanji/review", "/en/korume/chat"];

test.describe("app footer", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("subscribe in the footer, see it in Settings, turn it off, footer offers it again", async ({ page }) => {
    await signUp(page, "flow");
    await page.goto("/en/shadowing");
    const footer = page.locator("[data-app-footer]");
    await footer.getByRole("button", { name: copy.submit }).click();
    await expect(footer.getByText(copy.subscribed)).toBeVisible();

    await footer.getByRole("link", { name: copy.manage }).click();
    await expect(page).toHaveURL(/\/en\/settings#newsletter$/);
    const toggle = page.getByRole("switch", { name: settings.newsletter.title, exact: true });
    await expect(toggle).toBeChecked();

    const saved = page.waitForResponse((r) => r.url().endsWith("/api/user/newsletter") && r.request().method() === "PATCH");
    await toggle.click();
    expect((await saved).status()).toBe(200);

    // Client navigation, inside the 30s router-cache window.
    await page.getByRole("navigation", { name: /main|điều hướng/i }).getByRole("link", { name: "Lessons" }).click();
    await expect(page).toHaveURL(/\/en\/shadowing$/);
    await expect(page.locator("[data-app-footer]").getByRole("button", { name: copy.submit })).toBeVisible();
  });

  test("exactly one footer on each listed page, none elsewhere", async ({ page }) => {
    await signUp(page, "placement");
    for (const route of WITH_FOOTER) {
      await page.goto(route);
      await expect(page.locator("[data-app-footer]"), route).toHaveCount(1);
    }
    for (const route of WITHOUT_FOOTER) {
      await page.goto(route);
      await expect(page.locator("[data-app-footer]"), route).toHaveCount(0);
    }
  });
});
```

Nav link name: read `messages/en/nav.json` (`lessons` = "Lessons", `ariaLabel` = "Main") and use them from the catalog instead of literals if the import style allows; the AppNav landmark is `aria-label={t("ariaLabel")}`.

- [ ] **Step 2: Run** (worktree only; never the main checkout — `never-build-in-main-checkout`)

If the demo seed was run, first restore the curriculum titles: `npx vite-node --config vitest.config.ts .worktrees/port-dashboard/.superpowers/sdd/2026-10-08-port-dashboard/demo-seed.ts -- --cleanup` (from the main repo root; memory `port-dashboard`).
Run: `npx playwright test tests/e2e/app-footer.spec.ts` (its `webServer` builds and starts in this worktree; make sure nothing else listens on its `PORT`).
Expected: 2 passed. If `goto` times out on `/_next/image`, restart the server (memory `next-image-optimizer-wedge`).

- [ ] **Step 3: Run the neighbouring E2E specs the footer touches**

Run: `npx playwright test tests/e2e/settings.spec.ts tests/e2e/profile.spec.ts tests/e2e/shadowing-hub.spec.ts tests/e2e/pronunciation.spec.ts tests/e2e/route-group-provider-identity.spec.ts`
Expected: green. A `getByRole("contentinfo")` / footer-count assertion elsewhere that now sees the footer is a real conflict — report it, do not loosen it.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app-footer.spec.ts
git commit -m "test(app-footer): e2e subscribe/manage/unsubscribe and runtime placement (T5, T2 runtime)"
```

---

### Task 8: Chrome measurement (T6), pin L2d, owner review

**Files:**
- Modify: `app/globals.css` (numbers only, if measurement requires)
- Modify: `docs/superpowers/run-state/app-footer.md` (measurements)

- [ ] **Step 1: Serve the worktree build on a free port** (not 3000): `npm run build` then `npx next start -p 3100` in `.worktrees/app-footer`. Sign in as the demo learner `demo.dashboard@korume.local` / `password123` in a NEW Chrome tab (claude-in-chrome; never reuse the owner's tabs).

- [ ] **Step 2: Measure on `/en/shadowing`** at 1280x529 nav expanded, 1280x529 nav collapsed (the `‹` rail button), 1440x900 both nav states, and a 1920-wide same-origin iframe (`<iframe src="/en/shadowing" style="width:1920px;height:1000px">` injected into a page of the same origin). For each, run in the page (or the iframe's `contentWindow`) and record the JSON:

```js
(() => {
  const f = document.querySelector("[data-app-footer]");
  const row = [...f.querySelectorAll(".app-footer__row > *")].map((el) => el.getBoundingClientRect());
  const all = [...f.querySelectorAll("*")].filter((el) => el.getClientRects().length);
  const overflow = all.filter((el) => !el.matches("[data-footer-email]") && el.scrollWidth > el.clientWidth + 1).map((el) => el.className);
  const email = f.querySelector("[data-footer-email]");
  const smallest = Math.min(...all.filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())).map((el) => parseFloat(getComputedStyle(el).fontSize)));
  const pill = email?.closest(".app-footer__pill");
  return JSON.stringify({
    footer: f.getBoundingClientRect().width,
    sections: row.map((r) => Math.round(r.width)),
    tops: row.map((r) => Math.round(r.top)),
    overflow,
    email: email && { ellipsis: getComputedStyle(email).textOverflow, title: email.title, pillOk: pill.scrollWidth <= pill.clientWidth },
    smallestText: smallest,
    pageScrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  });
})();
```

Pass criteria (T6): `tops` equal ±2; `sections` within ±5% of `230 : 330 : 361` scaled to `footer − 2·24f − 2·24f`; `overflow` empty; `pageScrollX` false; `smallestText ≥ 12`; badges side by side (`.app-footer__badge` tops equal), wordmark/headings/links/closing on one line (`getClientRects().length === 1` for `.app-footer__wordmark, .app-footer__heading, .app-footer__link, .app-footer__closing, .app-footer__badge-name`).

- [ ] **Step 3: Review Focus 4 and 5.** (a) In the 1280 nav-expanded state, set the email span's text and `title` to a 70-character address in DevTools and re-run: `email.ellipsis === "ellipsis"`, `pillOk` true, `overflow` empty. (b) Repeat Step 2's 1280 nav-expanded measurement on `/vi/shadowing`.

- [ ] **Step 4: Pin L2d.** Record in the run state: footer width at the supported floor (1280, nav expanded), the `--f` floor/ceiling kept or changed, measured section widths per viewport, and whether L2b is needed. If something does not fit at the floor: first adjust NUMBERS within L1 (type sizes ≥ floors, internal gaps); only if that cannot fit, add the L2b rule below with `--footer-reduced` = the measured width at which the step becomes necessary, removing steps 1 → 2 → 3 only as far as needed, and add matching T1/T6 assertions:

```css
@container app-footer (max-width: <measured>px) {
  .app-footer [data-footer-reducible="1"] { display: none; }
}
```

If L2b is unused, write "L2b unused at the floor" in the run state.

- [ ] **Step 5: Gate after the last edit.** If Step 4 changed CSS: `npm test`, `npm run typecheck`, rebuild, re-run Step 2 at 1280 nav expanded. Commit:

```bash
git add app/globals.css docs/superpowers/run-state/app-footer.md
git commit -m "chore(app-footer): T6 Chrome measurements, L2d values pinned"
```

- [ ] **Step 6: STOP for the owner.** Leave the server running, give the owner the URL (`http://localhost:3100/vi/shadowing`, demo account) and the measurements. Apply the owner's feedback as numbers within L1 unless the owner rules otherwise. Do not merge.

---

### Task 9: Whole-branch gate, review, lessons, run state

- [ ] **Step 1:** `npm test` (full), `npm run typecheck`, `npm run lint`, `npm run verify:db:footer`, `npm run verify:protocol` — all after the last edit; paste the summary lines into the run state.
- [ ] **Step 2:** Dispatch the `code-reviewer` subagent on `git diff master...app-footer` with the spec, this plan, `AGENTS.md`, `docs/lessons.md` (L-011, L-044, L-051) and Review Focus 1–5. Fix every Critical/Important finding, re-run Step 1, and have the fix wave reviewed.
- [ ] **Step 3:** Record lessons in `docs/lessons.md` (merge into an existing entry where one applies — e.g. L-051 evidence for a footer whose frame wasted ~27% of its width on padding).
- [ ] **Step 4:** Update the run state (accepted commits, verification, next action = owner merge decision) and commit. Merge only on the owner's word: `git merge --no-ff app-footer` from the main checkout.
