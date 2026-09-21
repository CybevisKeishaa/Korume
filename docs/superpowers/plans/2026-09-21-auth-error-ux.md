# Auth + Error UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **In this repo the implementer is Codex**, one task per `codex exec` dispatch, in
> `.worktrees/auth-error-ux`, with `- Owner: Codex` in `docs/superpowers/run-state/auth-error-ux.md`.
> Claude reviews each task's commit before the next dispatch. Do only the task you were given.

**Goal:** Restyle Login/Register onto a shared auth shell, add email verification by 6-digit code and
password reset, and add a standalone 404 plus an in-shell route-error surface.

**Architecture:** Auth screens compose `AuthSplitShell` + `AuthStory` + `AuthCard` with one form per
flow; server actions stay in `app/[locale]/(auth)/actions.ts`. A neutral `components/mascot/` module
is the one home of the pose mapping. 404 is a standalone page; route errors render
`RouteErrorPanel` through thin client-boundary adapters, inside the live `(app)` shell.

**Tech Stack:** Next.js 14.2 App Router, React 18, TypeScript strict, Tailwind (repo tokens),
next-intl 4, Supabase Auth via `@supabase/ssr` (auth-js 2.110.2), Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-auth-error-ux-design.md` — read it in full first. The
plan argues from it; where they disagree, stop and report instead of choosing.

## Global Constraints

- Do not render Apple or GitHub sign-in, the ToS checkbox, Terms/Privacy links, the legal footer
  line, "Need help?", the mascot sticker strip, or any OTP expiry text (spec §3).
- Figma values are composition reference only. Use repo tokens: spacing `2xs xs sm md md-lg lg xl
  2xl 3xl`; type `caption body body-lg heading heading-lg title display hero`; `h-control-sm|md|lg`;
  colours `background foreground card muted border input primary accent danger`; fonts `font-sans`
  (Figma's Inter) and `font-display` (Outfit). In new or touched files, **never** use
  `text-xs|sm|base|lg|xl`, and never a **numeric** step for padding, margin, gap, `space-*` or
  insets (`p-4`, `gap-2`, `space-y-1.5`, `top-4`). The **token** forms of the same utilities are
  the required vocabulary (`p-xl`, `gap-sm`, `space-y-xs`, `pe-2xl`); `0` needs no token
  (`inset-y-0`, `end-0`); fractions are fine (`grid-cols-[3fr_2fr]`); px/rem literals are not.
  This is exactly what `components/ui/token-scale-adoption.test.ts`'s patterns forbid — when this
  line and that guard seem to disagree, the guard is the authority. *(Clarified 2026-09-21 after
  Codex stopped on `space-y-xs`.)*
- Auth routes and the 404 are `data-density="reference"` surfaces. The route-error surface sets
  **no** `data-density` and never recreates sidebar or top bar (spec §6.3).
- Every new string exists in `messages/en/*.json` **and** `messages/vi/*.json` in the same commit.
  Vietnamese is written, not machine-translated.
- `app/[locale]/(auth)/actions.ts` pattern: zod key → `translateValidationKey` `case` → translated
  text; add one `case` per new `validation.*` key or the raw key leaks.
- One fact, one home (AGENTS.md §6): the password rule (min 8 / max 72) is defined once, in
  `lib/validation/auth.ts`, and reused.
- Guard tests over code that already exists are mutation-checked: break the subject, see red,
  restore, report both outputs (AGENTS.md §7). Pattern-gathered collections assert their size.
- Lint with `npm run lint`, never `npx eslint` (L-018). Full vitest run:
  `npm test -- --reporter=dot > <file>` and read the file (L-035).
- The worktree has no `.env.local` until copied (L-020). Kill `:3000` before Playwright (L-017).
  Playwright needs Docker Desktop + `npx supabase start`.
- Never `npm run build` or `next start` in the main checkout. Only in this worktree, with absolute
  paths.
- No `path:NN` line citations in code comments (L-032).

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `components/mascot/mascot-poses.ts` (+ `.test.ts`) | 1 | The one semantic-name → file/size mapping |
| `components/mascot/mascot-pose.tsx` (+ `.test.tsx`) | 1 | Renders a pose; owns size variants |
| `components/auth/auth-split-shell.tsx` | 2 | 60/40 split (no narrow layout; see spec §5.1) |
| `components/auth/auth-story.tsx` | 2 | Left column content |
| `components/auth/auth-card.tsx` | 2 | Right column card |
| `components/auth/form-parts.tsx` | 2 | `SubmitButton`, `FieldError`, `FormError`, `PasswordField`, `GoogleButton`, `OrDivider` |
| `components/auth/login-form.tsx`, `register-form.tsx` (+ tests) | 2 | Per-flow forms (replace `auth-form.tsx`) |
| `components/auth/no-extra-providers.test.tsx` | 2 | Guard: no Apple/GitHub |
| `tests/e2e/fixtures/auth.ts` | 2 | `registerViaUi`, `signInViaUi` helpers for all e2e specs |
| `components/auth/otp-input.tsx` (+ test) | 3 | 6-box code input |
| `supabase/templates/confirmation.html`, `supabase/config.toml` | 4 | Code email |
| `components/auth/verify-email-form.tsx` (+ test) | 4 | OTP form + resend cooldown |
| `app/[locale]/(auth)/verify-email/page.tsx` | 4 | Route |
| `components/auth/forgot-password-form.tsx`, `reset-password-form.tsx` (+ tests) | 5 | Forms |
| `app/[locale]/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx` | 5 | Routes |
| `components/errors/requested-path.tsx` (+ test) | 6 | Client leaf showing the path |
| `components/errors/not-found-view.tsx` | 6 | 404 surface |
| `app/[locale]/not-found.tsx`, `app/[locale]/[...rest]/page.tsx` | 6 | 404 wiring |
| `components/errors/route-error-panel.tsx` (+ test) | 7 | Route-error content |
| `app/[locale]/(protected)/(app)/error.tsx`, `app/[locale]/error.tsx`, `app/global-error.tsx` | 7 | Boundaries |
| `messages/{en,vi}/errors.json`, `lib/i18n/namespaces.ts` | 6 | `errors` namespace |

---

### Task 1: Mascot pose module

**Files:**
- Create: `components/mascot/mascot-poses.ts`, `components/mascot/mascot-poses.test.ts`
- Create: `components/mascot/mascot-pose.tsx`, `components/mascot/mascot-pose.test.tsx`

**Interfaces:**
- Produces: `type MascotPoseName = "login" | "register" | "forgot-password" | "verify-email" |
  "reset-password" | "not-found" | "route-error"`; `MASCOT_POSES: Record<MascotPoseName, { file:
  string; width: number; height: number }>`; `<MascotPose pose={MascotPoseName} size="md" | "lg"
  className?: string />`.

- [ ] **Step 1: Write the failing test** — `components/mascot/mascot-poses.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MASCOT_POSES } from "./mascot-poses";

const ROOT = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(ROOT, "scripts/mascot/poses.json"), "utf8"),
) as { poses: { out: string }[]; supplied: { out: string }[] };
const recorded = new Set([...manifest.poses, ...manifest.supplied].map((p) => p.out));

describe("MASCOT_POSES", () => {
  const entries = Object.entries(MASCOT_POSES);

  it("maps exactly the seven screens the spec names", () => {
    expect(entries.map(([name]) => name).sort()).toEqual(
      ["forgot-password", "login", "not-found", "register", "reset-password", "route-error", "verify-email"],
    );
  });

  it("pins the owner-approved pose for each screen (spec §5.4)", () => {
    expect(Object.fromEntries(entries.map(([n, p]) => [n, p.file]))).toEqual({
      login: "greeting.png",
      register: "excited.png",
      "forgot-password": "thinking.png",
      "verify-email": "noting.png",
      "reset-password": "looking-ahead.png",
      "not-found": "curious-question-mark.png",
      "route-error": "worry.png",
    });
  });

  it.each(entries)("%s names a file that exists and is recorded in poses.json", (_n, pose) => {
    expect(existsSync(join(ROOT, "public/mascot/poses", pose.file))).toBe(true);
    expect(recorded.has(pose.file)).toBe(true);
  });

  it.each(entries)("%s carries the PNG's real pixel size", (_n, pose) => {
    const png = readFileSync(join(ROOT, "public/mascot/poses", pose.file));
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([pose.width, pose.height]);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run components/mascot/mascot-poses.test.ts`
  → FAIL, cannot resolve `./mascot-poses`.

- [ ] **Step 3: Implement** — `components/mascot/mascot-poses.ts`

```ts
/**
 * The only place a screen's semantic state maps to a pose file (spec §5.4). Auth and error
 * surfaces both import this module, which is why it lives outside `components/auth/`.
 * `width`/`height` are the PNG's pixel size, pinned by the test against the file itself.
 */
export type MascotPoseName =
  | "login"
  | "register"
  | "forgot-password"
  | "verify-email"
  | "reset-password"
  | "not-found"
  | "route-error";

export const MASCOT_POSES: Record<MascotPoseName, { file: string; width: number; height: number }> = {
  login: { file: "greeting.png", width: 200, height: 272 },
  register: { file: "excited.png", width: 436, height: 364 },
  "forgot-password": { file: "thinking.png", width: 427, height: 406 },
  "verify-email": { file: "noting.png", width: 340, height: 304 },
  "reset-password": { file: "looking-ahead.png", width: 620, height: 1015 },
  "not-found": { file: "curious-question-mark.png", width: 423, height: 370 },
  "route-error": { file: "worry.png", width: 370, height: 397 },
};
```

- [ ] **Step 4: Write the component test** — `components/mascot/mascot-pose.test.tsx`

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MascotPose } from "./mascot-pose";

describe("MascotPose", () => {
  it("renders the mapped file as a decorative image", () => {
    const { container } = render(<MascotPose pose="not-found" size="md" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/mascot/poses/curious-question-mark.png");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });

  it("marks the element so size variants are testable", () => {
    const { container } = render(<MascotPose pose="login" size="lg" />);
    expect(container.querySelector("[data-mascot-pose='login'][data-size='lg']")).not.toBeNull();
  });
});
```

- [ ] **Step 5: Implement** — `components/mascot/mascot-pose.tsx`

```tsx
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MASCOT_POSES, type MascotPoseName } from "./mascot-poses";

// Height is the one size a caller may pick; width follows the PNG's aspect ratio.
const SIZE_CLASS = { md: "h-40 w-auto", lg: "h-56 w-auto" } as const;

export function MascotPose({
  pose,
  size,
  className,
}: {
  pose: MascotPoseName;
  size: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  const { file, width, height } = MASCOT_POSES[pose];
  return (
    <Image
      data-mascot-pose={pose}
      data-size={size}
      src={`/mascot/poses/${file}`}
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      unoptimized
      className={cn(SIZE_CLASS[size], "select-none", className)}
    />
  );
}
```

- [ ] **Step 6: Run** — `npx vitest run components/mascot` → PASS. Mutation-check the pin test:
  change `worry.png` to `sulking.png` in the map, see red, restore.

- [ ] **Step 7: Commit** — `git add components/mascot && git commit -m "feat(mascot): one home for screen poses"`

---

### Task 2: Auth shell, Login and Register on it, confirm-password

**Files:**
- Create: `components/auth/auth-split-shell.tsx`, `auth-story.tsx`, `auth-card.tsx`, `form-parts.tsx`,
  `login-form.tsx`, `register-form.tsx`, `login-form.test.tsx`, `register-form.test.tsx`,
  `no-extra-providers.test.tsx`
- Delete: `components/auth/auth-form.tsx`, `components/auth/auth-form.test.tsx` (their assertions
  move to the two new form tests — port every existing assertion that still applies; list any you
  drop and why in the commit body)
- Modify: `app/[locale]/(auth)/layout.tsx`, `login/page.tsx`, `register/page.tsx`
- Modify: `lib/validation/auth.ts`, `lib/validation/auth.test.ts`, `app/[locale]/(auth)/actions.ts`,
  `actions.validation.test.ts`
- Modify: `messages/{en,vi}/auth.json`
- Create: `tests/e2e/fixtures/auth.ts`; Modify: every spec under `tests/e2e/` that registers or signs
  in through the UI (today: `auth-locale-round-trip`, `journal`, `lesson-creation-jobs`, `review`,
  `route-group-provider-identity`, `shadowing-explore`, `shadowing-hub` — re-derive the list with
  `grep -l 'getByLabel("Password")' tests/e2e/*.ts` and expect 7 files)

**Interfaces:**
- Consumes: `MascotPose`, `MascotPoseName` (Task 1).
- Produces:
  - `AuthSplitShell({ story, children }: { story: ReactNode; children: ReactNode })`
  - `AuthStory({ eyebrow, heading, body, quote, quoteAttribution, pose }: { eyebrow: string;
    heading: string; body: string; quote: string; quoteAttribution: string; pose: MascotPoseName })`
  - `AuthCard({ eyebrow, heading, subtitle, children })` — all strings except `children`
  - from `form-parts.tsx`: `SubmitButton({ label })`, `FieldError({ id, messages })`,
    `FormError({ message })`, `PasswordField({ id, name, label, autoComplete, errors })`,
    `GoogleButton()`, `OrDivider()`
  - `passwordRule` (zod string schema) and `registerSchema` with `confirmPassword` from
    `lib/validation/auth.ts`
  - e2e: `registerViaUi(page, { name, email, password })`, `signInViaUi(page, { email, password })`

**Why the e2e helper is in this task:** the new "Confirm password" field and the show/hide button
("Show password") both match `getByLabel("Password")` as a substring, so every existing spec hits a
strict-mode violation the moment this task lands. The helper uses exact labels and is the one place
e2e specs fill auth forms.

- [ ] **Step 1: Failing validation test** — add to `lib/validation/auth.test.ts`

```ts
describe("registerSchema confirmPassword", () => {
  const base = { name: "A", email: "a@b.com", password: "password123" };

  it("accepts a matching confirmation", () => {
    expect(registerSchema.safeParse({ ...base, confirmPassword: "password123" }).success).toBe(true);
  });

  it("reports a mismatch on confirmPassword with the catalog key", () => {
    const r = registerSchema.safeParse({ ...base, confirmPassword: "password124" });
    expect(r.success).toBe(false);
    expect(r.error?.flatten().fieldErrors.confirmPassword).toEqual(["validation.passwordMismatch"]);
  });
});
```

Run `npx vitest run lib/validation/auth.test.ts` → FAIL.

- [ ] **Step 2: Implement** — `lib/validation/auth.ts`

```ts
/** The one password rule (spec §4.3). Register and reset both derive from it. */
export const passwordRule = z
  .string()
  .min(8, "validation.passwordTooShort")
  .max(72, "validation.passwordTooLong");

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "validation.nameRequired").max(80),
    email: z.string().trim().email("validation.emailInvalid"),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "validation.passwordMismatch",
    path: ["confirmPassword"],
  });
```

`RegisterInput` stays `z.infer<typeof registerSchema>`. Run → PASS.

- [ ] **Step 3: Failing action test** — in `actions.validation.test.ts`, add a register case posting
  mismatched passwords and assert `fieldErrors.confirmPassword` equals
  `["Passwords do not match."]` (the literal English text, never read from the JSON). The posted
  form must carry a **present but different** `confirmPassword`. Run → FAIL. *(Corrected
  2026-09-21 after Codex stopped on it: the red reason here is that `register()` does not read
  `confirmPassword` yet, so zod reports its own missing-field message — not a leaked
  `validation.passwordMismatch` key. The leak only becomes observable after `register()` reads the
  field; Step 4 fixes both at once. Any red on this assertion is the expected failure.)*

- [ ] **Step 4: Implement** — in `actions.ts`: `register` reads
  `confirmPassword: formData.get("confirmPassword")`; `signUp` still receives only
  `parsed.data.email`/`password`; add `case "validation.passwordMismatch": return t("validation.passwordMismatch");`.
  Add the key to both `auth.json` files (`"Passwords do not match."` /
  `"Mật khẩu xác nhận không khớp."`). Run → PASS.

- [ ] **Step 5: Shell primitives** — create the three components. Required structure (styling uses
  tokens only; tune against Figma `332:3` at 1280):

```tsx
// components/auth/auth-split-shell.tsx
/**
 * The auth composition (spec §5.1): a 60/40 split. No per-screen variants and no narrow layout —
 * below 1024 px the root layout shows MobileAppHandoff instead of the web app.
 */
export function AuthSplitShell({ story, children }: { story: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-cols-[3fr_2fr] bg-background">
      {story}
      <main className="flex items-center justify-center px-xl py-xl">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
```

`AuthStory` renders, in order: the logo (`common.appNameJp`, linking home — moved here from the
layout), eyebrow (`text-caption uppercase tracking-wide text-primary`), heading (`font-display
text-display` or `text-hero`, whichever matches the frame at 1280), body (`text-body-lg
text-muted-foreground`), `<MascotPose size="lg">`, quote (`<blockquote>`) and attribution
(`text-caption uppercase tracking-wide`). *(Corrected 2026-09-21: there is no below-`lg` variant —
spec §5.1 now sets the floor at 1024 px, where the web app starts rendering.)* The story's display
heading is a `<p>`, not a heading element: the card's `<h1>` is the page's only heading, so the
document outline does not start with an `h2` before the `h1`. `AuthCard` renders a `rounded-lg border border-border
bg-card p-xl shadow-raised` panel with eyebrow, `<h1>` heading (`font-display text-title`), subtitle
and children.

Update `app/[locale]/(auth)/layout.tsx` to only `<div data-density="reference" className="min-h-dvh
bg-background">{children}</div>` (the header and logo move into `AuthStory`).

- [ ] **Step 6: Form parts + forms, test first.** `register-form.test.tsx` (copy the `react-dom`
  `useFormState`/`useFormStatus` shim and the actions mock from the old `auth-form.test.tsx`
  verbatim, including its comments) must assert:
  - fields by exact label: `getByLabelText("Name")`, `"Email"`, `getByLabelText("Password", { exact: true })`,
    `getByLabelText("Confirm password")`;
  - `autocomplete` is `new-password` on both password inputs;
  - pressing "Show password" flips that input to `type="text"` and the button's name to
    "Hide password"; the confirm field keeps its own toggle;
  - buttons: "Create account", "Continue with Google"; link "Sign in" → `/en/login`.
  `login-form.test.tsx` asserts email + password (`current-password`), the hidden `redirectTo` when
  given, "Sign in", "Continue with Google", link "Create an account" → `/en/register`, and **no**
  "Forgot password?" link yet (Task 5 adds it). Run → FAIL.

`PasswordField` (in `form-parts.tsx`, `"use client"`):

```tsx
export function PasswordField({ id, name, label, autoComplete, errors }: {
  id: string; name: string; label: string;
  autoComplete: "current-password" | "new-password"; errors?: string[];
}) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("auth");
  return (
    <div className="space-y-xs">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} name={name} type={visible ? "text" : "password"} autoComplete={autoComplete}
          required aria-invalid={!!errors?.length} aria-describedby={`${id}-error`} className="pe-2xl" />
        <button type="button" onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("form.hidePassword") : t("form.showPassword")}
          aria-controls={id}
          className="absolute inset-y-0 end-0 flex aspect-square h-full items-center justify-center text-muted-foreground">
          {visible ? <EyeOff aria-hidden className="size-icon-sm" /> : <Eye aria-hidden className="size-icon-sm" />}
        </button>
      </div>
      <FieldError id={`${id}-error`} messages={errors} />
    </div>
  );
}
```

(**This repo has no icon package** — `lucide-react` is not a dependency and must not be added.
`Eye`/`EyeOff` are two small inline-SVG components defined in `form-parts.tsx`, following
`components/layout/site-menu-icon.tsx`'s pattern: `viewBox="0 0 24 24"`, `stroke="currentColor"`,
`fill="none"`, `aria-hidden`. `w-control-md` is not a width token; use `h-full aspect-square` for the
toggle's box.)

`SubmitButton`, `FieldError`, `FormError` move from the old `auth-form.tsx` unchanged. `GoogleButton`
is the old `<form action={signInWithGoogle}>` block; `OrDivider` the old divider. `LoginForm({ redirectTo })`
and `RegisterForm()` compose them. Catalog keys added in both locales: `form.confirmPasswordLabel`
("Confirm password" / "Xác nhận mật khẩu"), `form.showPassword` ("Show password" / "Hiện mật khẩu"),
`form.hidePassword` ("Hide password" / "Ẩn mật khẩu"), plus the story/card copy for both screens
under `login.story.*` / `register.story.*` and `login.card.*` / `register.card.*`, English from the
frames. **Remove** `login.checkEmail` only in Task 4, not here (its banner still works until then).

- [ ] **Step 7: No-extra-providers guard** — `components/auth/no-extra-providers.test.tsx` renders
  `LoginForm` and `RegisterForm` and asserts no element whose accessible name matches `/apple|github/i`
  (use `queryAllByRole("button")` + `queryAllByRole("link")`, assert the combined list is non-empty,
  then that none match). Mutation-check: temporarily add a "Continue with GitHub" button, see red,
  remove.

- [ ] **Step 8: Pages** — `login/page.tsx` and `register/page.tsx` render
  `<AuthSplitShell story={<AuthStory … pose="login" />}><AuthCard …><LoginForm redirectTo=… /></AuthCard></AuthSplitShell>`
  (register: `pose="register"`, `RegisterForm`). Keep `generateMetadata` and the `checkEmail`
  banner on login (inside the card, above the form). Delete `auth-form.tsx` and its test.

- [ ] **Step 9: e2e helper** — `tests/e2e/fixtures/auth.ts`

```ts
import type { Page } from "@playwright/test";

/** The one place e2e specs fill auth forms. Exact labels: "Password" is a substring of
 *  "Confirm password" and of the show/hide toggle's name. */
export async function registerViaUi(page: Page, u: { name: string; email: string; password: string }) {
  await page.getByLabel("Name", { exact: true }).fill(u.name);
  await page.getByLabel("Email", { exact: true }).fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByLabel("Confirm password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
}

export async function signInViaUi(page: Page, u: { email: string; password: string }) {
  await page.getByLabel("Email", { exact: true }).fill(u.email);
  await page.getByLabel("Password", { exact: true }).fill(u.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
```

Replace every inline register/sign-in fill sequence in the 7 specs with these calls (the `goto`
stays in the spec). Afterwards `grep -c 'getByLabel("Password")' tests/e2e/*.spec.ts` must print 0
for every spec.

- [ ] **Step 10: Layout e2e** — `tests/e2e/auth-layout.spec.ts`, driven by one exported array
  `const AUTH_ROUTES_UNDER_TEST = ["/en/login", "/en/register"]` (Tasks 4 and 5 append their
  routes; the spec asserts the array's length so an accidental emptying fails). For each route:
  - at 1280×800: the story column and the card column are both visible, and the card column's
    width is within 480–544 px (≈512, spec §5.1); no element whose accessible name matches
    `/apple|github/i`;
  - at 1024×768: `document.documentElement.scrollWidth <= document.documentElement.clientWidth`,
    the story and card columns are side by side, and the submit button is visible after
    `scrollIntoViewIfNeeded()`. *(Corrected 2026-09-21: the first version tested 320 px, where the
    root layout shows `MobileAppHandoff` instead of any auth page — spec §5.1.)*

- [ ] **Step 11: Verify** — `npx tsc --noEmit` 0 · `npm run lint` 0 errors ·
  `npm test -- --reporter=dot > .test-out.txt` exit 0 (read the file) · with local Supabase and
  `:3000` free: `npx playwright test auth-layout auth-locale-round-trip review journal` green.

- [ ] **Step 12: Commit** — `feat(auth): split shell, per-flow forms, confirm password`

---

### Task 3: `OtpInput`

**Files:**
- Create: `components/auth/otp-input.tsx`, `components/auth/otp-input.test.tsx`
- Modify: `messages/{en,vi}/auth.json` (`otp.groupLabel`, `otp.digitLabel`)

**Interfaces:**
- Produces: `OtpInput({ name, onComplete, errorId }: { name: string; onComplete?: () => void;
  errorId?: string })` — renders six inputs plus one hidden `<input name={name}>` holding the joined
  digits. `onComplete` fires when the sixth digit is filled; the parent uses it to focus the
  submit button.

- [ ] **Step 1: Failing tests** — `components/auth/otp-input.test.tsx`

```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "@/test/render";
import { OtpInput } from "./otp-input";

const boxes = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const hidden = (c: HTMLElement) => c.querySelector<HTMLInputElement>("input[name='token']")!;

describe("OtpInput (spec §5.2)", () => {
  it("renders six boxes in one labelled group", () => {
    render(<OtpInput name="token" />);
    expect(screen.getByRole("group", { name: "Verification code" })).toBeInTheDocument();
    expect(boxes()).toHaveLength(6);
    expect(boxes()[0]).toHaveAccessibleName("Digit 1 of 6");
    expect(boxes()[0]).toHaveAttribute("autocomplete", "one-time-code");
    expect(boxes()[1]).not.toHaveAttribute("autocomplete", "one-time-code");
    boxes().forEach((b) => expect(b).toHaveAttribute("inputmode", "numeric"));
  });

  it("discards non-digits and advances on a digit", async () => {
    render(<OtpInput name="token" />);
    await userEvent.type(boxes()[0], "a");
    expect(boxes()[0].value).toBe("");
    await userEvent.type(boxes()[0], "4");
    expect(boxes()[0].value).toBe("4");
    expect(boxes()[1]).toHaveFocus();
  });

  it("backspace in an empty box clears and focuses the previous box", async () => {
    render(<OtpInput name="token" />);
    await userEvent.type(boxes()[0], "12");
    expect(boxes()[2]).toHaveFocus();
    await userEvent.keyboard("{Backspace}");
    expect(boxes()[1]).toHaveFocus();
    expect(boxes()[1].value).toBe("");
  });

  it("distributes a paste from the focused box, stripping non-digits", async () => {
    const { container } = render(<OtpInput name="token" />);
    boxes()[1].focus();
    await userEvent.paste("9-8 7a");
    expect(boxes().map((b) => b.value)).toEqual(["", "9", "8", "7", "", ""]);
    expect(boxes()[4]).toHaveFocus();
    expect(hidden(container).value).toBe("987");
  });

  it("distributes a six-digit input event with no paste event (one-time-code autofill)", () => {
    const onComplete = vi.fn();
    const { container } = render(<OtpInput name="token" onComplete={onComplete} />);
    fireEvent.change(boxes()[0], { target: { value: "123456" } });
    expect(boxes().map((b) => b.value)).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(hidden(container).value).toBe("123456");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("truncates at six and never focuses a box that does not exist", async () => {
    const onComplete = vi.fn();
    render(<OtpInput name="token" onComplete={onComplete} />);
    boxes()[3].focus();
    await userEvent.paste("98765");
    expect(boxes().map((b) => b.value)).toEqual(["", "", "", "9", "8", "7"]);
    expect(onComplete).not.toHaveBeenCalled(); // boxes 1-3 still empty
  });
});
```

Run `npx vitest run components/auth/otp-input.test.tsx` → FAIL.

- [ ] **Step 2: Implement** — `components/auth/otp-input.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * One logical six-digit value across six boxes (spec §5.2). Any multi-character insertion —
 * a paste, or platform one-time-code autofill arriving as a plain input event — goes through
 * `fill`, so both paths behave identically.
 */
export function OtpInput({ name, onComplete, errorId }: {
  name: string; onComplete?: () => void; errorId?: string;
}) {
  const t = useTranslations("auth");
  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function fill(start: number, raw: string) {
    const incoming = raw.replace(/\D/g, "").slice(0, LENGTH - start).split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    incoming.forEach((d, i) => { next[start + i] = d; });
    setDigits(next);
    const firstEmpty = next.findIndex((d) => d === "");
    if (firstEmpty === -1) onComplete?.();
    else refs.current[Math.max(firstEmpty, Math.min(start + incoming.length, LENGTH - 1))]?.focus();
  }

  return (
    <div role="group" aria-label={t("otp.groupLabel")} aria-describedby={errorId} className="flex gap-sm">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          value={digit}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={t("otp.digitLabel", { index: i + 1, total: LENGTH })}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") { const next = [...digits]; next[i] = ""; setDigits(next); return; }
            fill(i, value.length > 1 ? value.replace(digit, "") || value : value);
          }}
          onPaste={(e) => { e.preventDefault(); fill(i, e.clipboardData.getData("text")); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && digit === "" && i > 0) {
              e.preventDefault();
              const next = [...digits]; next[i - 1] = ""; setDigits(next);
              refs.current[i - 1]?.focus();
            }
          }}
          className={cn(
            "h-control-lg w-full min-w-0 rounded-md border border-input bg-input-background text-center font-mono text-heading",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        />
      ))}
      <input type="hidden" name={name} value={digits.join("")} />
    </div>
  );
}
```

Note the `focus` rule: after a fill, focus goes to the first empty box; when none is empty,
`onComplete` runs and the parent moves focus to the submit button. Adjust the implementation until
every test passes — the tests are the contract, the sketch is not. Catalog keys:
`otp.groupLabel` "Verification code" / "Mã xác minh"; `otp.digitLabel` "Digit {index} of {total}" /
"Chữ số {index} trên {total}".

- [ ] **Step 3: Run** → PASS. `npx tsc --noEmit` 0 · `npm run lint` 0.
- [ ] **Step 4: Commit** — `feat(auth): six-digit code input`

---

### Task 4: OTP vertical slice — `/verify-email` and the redirects into it

Everything in this task lands in **one** commit: no redirect to `/verify-email` may exist without
the route.

**Files:**
- Create: `supabase/templates/confirmation.html`; Modify: `supabase/config.toml`
- Modify: `lib/validation/auth.ts` (+ test): `verifyEmailSchema`, `emailOnlySchema`
- Modify: `app/[locale]/(auth)/actions.ts`: `verifyEmail`, `resendCode`, `register`, `login`
- Create: `app/[locale]/(auth)/actions.otp.test.ts`
- Create: `components/auth/verify-email-form.tsx`, `verify-email-form.test.tsx`
- Create: `app/[locale]/(auth)/verify-email/page.tsx`
- Modify: `lib/supabase/route-protection.ts` (+ its test): add `/verify-email`
- Modify: `app/[locale]/(auth)/login/page.tsx` (remove the `checkEmail` banner), `messages/{en,vi}/auth.json`

**Interfaces:**
- Consumes: `OtpInput` (Task 3), shell/card/form parts (Task 2).
- Produces: `verifyEmail(prev: AuthState, fd: FormData): Promise<AuthState>`,
  `resendCode(prev: ResendState, fd: FormData): Promise<ResendState>` where
  `type ResendState = { status?: "sent" | "rateLimited" }`; `emailOnlySchema` (reused by Task 5).

- [ ] **Step 1: Schemas, test first** — `verifyEmailSchema = z.object({ email: z.string().trim().email("validation.emailInvalid"), token: z.string().regex(/^\d{6}$/, "validation.codeInvalid") })`;
  `emailOnlySchema = z.object({ email: z.string().trim().email("validation.emailInvalid") })`.
  Tests: `"12345"`, `"1234567"`, `"12345a"` fail with `validation.codeInvalid`; `"012345"` passes.

- [ ] **Step 2: Failing action tests** — `actions.otp.test.ts`, same mocking style as
  `actions.test.ts` (Supabase client mocked, `redirectDestination` helper copied, translator via
  `createTranslator` as in `actions.validation.test.ts`). Required cases:

```ts
describe("register — both confirmation modes (spec §4.1)", () => {
  it("session present → /en/dashboard", async () => {
    signUp.mockResolvedValueOnce({ data: { user: { id: "u" }, session: { access_token: "t" } }, error: null });
    const e = await register({}, fd({ name: "A", email: "a@b.com", password: "password123", confirmPassword: "password123" })).catch((x: unknown) => x);
    expect(redirectDestination(e)).toBe("/en/dashboard");
  });

  it("user without session → /en/verify-email with the email URL-encoded", async () => {
    signUp.mockResolvedValueOnce({ data: { user: { id: "u" }, session: null }, error: null });
    const e = await register({}, fd({ name: "A", email: "a+b@c.com", password: "password123", confirmPassword: "password123" })).catch((x: unknown) => x);
    expect(redirectDestination(e)).toBe("/en/verify-email?email=a%2Bb%40c.com");
  });
});

describe("login — unconfirmed email", () => {
  it("email_not_confirmed → verify-email with resend=1", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { code: "email_not_confirmed", message: "Email not confirmed" } });
    const e = await login({}, fd({ email: "a@b.com", password: "x" })).catch((x: unknown) => x);
    expect(redirectDestination(e)).toBe("/en/verify-email?email=a%40b.com&resend=1");
  });

  it("any other error keeps the single invalid-credentials message", async () => {
    signInWithPassword.mockResolvedValueOnce({ error: { code: "invalid_credentials", message: "x" } });
    expect(await login({}, fd({ email: "a@b.com", password: "x" }))).toEqual({ error: "Invalid email or password." });
  });
});

describe("verifyEmail", () => {
  it("calls verifyOtp with type email and redirects to the dashboard", async () => {
    verifyOtp.mockResolvedValueOnce({ data: {}, error: null });
    const e = await verifyEmail({}, fd({ email: "a@b.com", token: "123456" })).catch((x: unknown) => x);
    expect(verifyOtp).toHaveBeenCalledWith({ email: "a@b.com", token: "123456", type: "email" });
    expect(redirectDestination(e)).toBe("/en/dashboard");
  });

  it("maps any Supabase error to one generic message", async () => {
    verifyOtp.mockResolvedValueOnce({ data: {}, error: { code: "otp_expired", message: "x" } });
    expect(await verifyEmail({}, fd({ email: "a@b.com", token: "123456" }))).toEqual({ error: "That code is wrong or has expired." });
  });

  it("rejects a malformed code before calling Supabase", async () => {
    const r = await verifyEmail({}, fd({ email: "a@b.com", token: "12a456" }));
    expect(r.fieldErrors?.token).toEqual(["Enter the 6-digit code."]);
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});

describe("resendCode", () => {
  it("resends a signup code and reports sent", async () => {
    resend.mockResolvedValueOnce({ data: {}, error: null });
    expect(await resendCode({}, fd({ email: "a@b.com" }))).toEqual({ status: "sent" });
    expect(resend).toHaveBeenCalledWith({ type: "signup", email: "a@b.com" });
  });

  it("maps the email rate limit to rateLimited", async () => {
    resend.mockResolvedValueOnce({ data: {}, error: { code: "over_email_send_rate_limit", message: "x" } });
    expect(await resendCode({}, fd({ email: "a@b.com" }))).toEqual({ status: "rateLimited" });
  });

  it("reports sent for any other error (no enumeration)", async () => {
    resend.mockResolvedValueOnce({ data: {}, error: { code: "user_not_found", message: "x" } });
    expect(await resendCode({}, fd({ email: "a@b.com" }))).toEqual({ status: "sent" });
  });
});
```

Every expected string is a literal. `vi.clearAllMocks()` in `beforeEach`. Run → FAIL.

- [ ] **Step 3: Implement the actions.**
  - `register`: after `signUp`, `if (data.session) redirect({ href: "/dashboard", locale })`;
    else `redirect({ href: \`/verify-email?email=${encodeURIComponent(parsed.data.email)}\`, locale })`.
    Remove the `checkEmail` branch. `emailRedirectTo` stays (harmless with a code template).
  - `login`: `if (error?.code === "email_not_confirmed") redirect({ href: \`/verify-email?email=${encodeURIComponent(parsed.data.email)}&resend=1\`, locale })`
    before the existing generic error return.
  - `verifyEmail`: parse `verifyEmailSchema` from the form body; on success
    `supabase.auth.verifyOtp({ email, token, type: "email" })`; error → `{ error: t("errors.codeInvalid") }`;
    success → `revalidatePath("/", "layout")` and `redirect({ href: "/dashboard", locale })`.
  - `resendCode`: parse `emailOnlySchema`; invalid → `{ status: "sent" }` (never reveal); call
    `resend({ type: "signup", email })`; `error?.code === "over_email_send_rate_limit"` →
    `{ status: "rateLimited" }`, otherwise `{ status: "sent" }`.
  - `translateValidationKey`: add `validation.codeInvalid`.
  Catalog: `validation.codeInvalid` "Enter the 6-digit code." / "Nhập mã gồm 6 chữ số.";
  `errors.codeInvalid` "That code is wrong or has expired." / "Mã không đúng hoặc đã hết hạn.".
  Run → PASS. Check that the redirect helper's output for `redirect({ href: "/verify-email?email=…" })`
  keeps the query string encoded exactly as the test expects; if next-intl re-encodes it, fix the
  implementation, not the test.

- [ ] **Step 4: Verify-email form, test first** — `verify-email-form.test.tsx` (form-state shim as in
  Task 2) asserts, with `vi.useFakeTimers()`:
  - the email renders as text inside the pill and as a hidden `email` field in **both** forms
    (verify and resend);
  - `initialCooldown={true}` → "Resend code in 60s", button disabled; after
    `vi.advanceTimersByTime(60_000)` → enabled "Resend code";
  - `initialCooldown={false}` (the `resend=1` case) → enabled at once, and nothing was sent on
    render (`resendCode` mock not called);
  - "Change email" links to `/en/register` with **no** query string;
  - no text matching `/expire/i` anywhere (spec §3).
  Then implement `VerifyEmailForm({ email, initialCooldown }: { email: string; initialCooldown: boolean })`:
  `useFormState(verifyEmail)`, `OtpInput name="token" onComplete={() => submitRef.current?.focus()}`,
  and a second `useFormState(resendCode)` form whose submit restarts a 60 s cooldown only when the
  returned state is `{ status: "sent" }` (compare against the previous state object so each
  success restarts it); `rateLimited` shows "Please wait a moment before requesting another code."
  and also starts the cooldown. The cooldown is a `useEffect` interval over a `secondsLeft` state.

- [ ] **Step 5: Page** — `app/[locale]/(auth)/verify-email/page.tsx` (server component):

```tsx
export default async function VerifyEmailPage({ params, searchParams }: {
  params: { locale: Locale }; searchParams: { email?: string; resend?: string };
}) {
  const parsed = emailOnlySchema.safeParse({ email: searchParams.email ?? "" });
  if (!parsed.success) redirect({ href: "/register", locale: params.locale });
  const t = await getTranslations("auth");
  return (
    <AuthSplitShell story={<AuthStory {...story(t)} pose="verify-email" />}>
      <AuthCard eyebrow={t("verify.card.eyebrow")} heading={t("verify.card.heading")} subtitle={t("verify.card.subtitle")}>
        <VerifyEmailForm email={parsed.data.email} initialCooldown={searchParams.resend !== "1"} />
      </AuthCard>
    </AuthSplitShell>
  );
}
```

Add `generateMetadata` like the other auth pages. Story copy from frame `335:306`
("One last step" / "A small step before we begin." / body / quote "Everything is ready. We're just
waiting for you." / "Tokyo · late evening").

- [ ] **Step 6: Route protection** — add `"/verify-email"` to `AUTH_ROUTES`; add a test asserting
  `isAuthRoute("/verify-email") === true`.

- [ ] **Step 7: Email template** — `supabase/templates/confirmation.html`: a minimal bilingual HTML
  email showing `{{ .Token }}` prominently (no link, no tracking, no external images). In
  `supabase/config.toml` add:

```toml
[auth.email.template.confirmation]
subject = "Your Korume verification code"
content_path = "./supabase/templates/confirmation.html"
```

Leave `enable_confirmations = false` untouched.

- [ ] **Step 8: Remove** the `checkEmail` banner from `login/page.tsx` and `login.checkEmail` from
  both catalogs; `grep -rn checkEmail app components messages` → no hits.

- [ ] **Step 9: Verify** — append `"/en/verify-email?email=e2e%40example.com"` to `AUTH_ROUTES_UNDER_TEST` in `tests/e2e/auth-layout.spec.ts` (and its length assertion) · tsc 0 · lint 0 · full vitest dot run exit 0 · with Supabase running,
  add `tests/e2e/auth-verify-email.spec.ts` at viewport 1280: open
  `/en/verify-email?email=e2e%40example.com`; type `123` then paste `456` → six filled boxes and
  focus on "Verify email"; submit → "That code is wrong or has expired."; "Resend code in" visible.
  Then run it plus `auth-locale-round-trip` (register must still land on `/en/dashboard` with
  confirmations off).

- [ ] **Step 10: Commit** — `feat(auth): verify email by six-digit code`

---

### Task 5: Password reset slice

One commit: routes, actions and the "Forgot password?" link land together.

**Files:**
- Modify: `lib/validation/auth.ts` (+ test): `resetPasswordSchema`
- Modify: `app/[locale]/(auth)/actions.ts`: `requestPasswordReset`, `updatePassword`
- Create: `app/[locale]/(auth)/actions.reset.test.ts`
- Create: `components/auth/forgot-password-form.tsx`, `reset-password-form.tsx` (+ tests)
- Create: `app/[locale]/(auth)/forgot-password/page.tsx`, `reset-password/page.tsx`
- Modify: `lib/supabase/route-protection.ts` (+ test); `components/auth/login-form.tsx` (+ test)
- Modify: `messages/{en,vi}/auth.json`

**Interfaces:**
- Consumes: `emailOnlySchema` (Task 4), `passwordRule` (Task 2), `PasswordField` (Task 2).
- Produces: `requestPasswordReset(prev: ResetRequestState, fd): Promise<ResetRequestState>` with
  `type ResetRequestState = { sent?: boolean; fieldErrors?: Record<string, string[] | undefined> }`;
  `updatePassword(prev: AuthState, fd): Promise<AuthState>`.

- [ ] **Step 1: Schema** — `resetPasswordSchema = z.object({ password: passwordRule, confirmPassword: z.string() }).refine(...)`
  with the same mismatch refinement as `registerSchema` — extract the refinement into one local
  function used by both, so the rule is not written twice. Test: mismatch → `validation.passwordMismatch`
  on `confirmPassword`; 7 chars → `validation.passwordTooShort`.

- [ ] **Step 2: Failing action tests** — `actions.reset.test.ts`:
  - `requestPasswordReset` with a valid email calls
    `resetPasswordForEmail("a@b.com", { redirectTo: "http://localhost:3000/auth/callback?next=/en/reset-password" })`
    (mock `headers()` to return `origin: http://localhost:3000`) and returns `{ sent: true }`;
  - the **same** `{ sent: true }` when Supabase returns an error (`toEqual` on both results);
  - invalid email → `fieldErrors.email` `["Enter a valid email address."]`, Supabase not called;
  - `updatePassword` with `getUser` → `{ data: { user: null } }` returns
    `{ error: "This reset link has expired. Request a new one." }` and does not call `updateUser`;
  - `updatePassword` with a user and valid matching passwords calls `updateUser({ password })` and
    redirects to `/en/dashboard`;
  - `updatePassword` when `updateUser` errors with `same_password` returns
    `{ error: "Choose a password different from your current one." }`; any other error returns
    `{ error: "We couldn't update your password. Try again." }`.
  Run → FAIL.

- [ ] **Step 3: Implement** both actions per the tests. `requestPasswordReset` ignores the Supabase
  result entirely after validation.

- [ ] **Step 4: Forms and pages, tests first.**
  - `ForgotPasswordForm`: email field; on `{ sent: true }` replaces the form with the neutral
    confirmation ("If an account exists for that email, we've sent a reset link.") and keeps
    "Back to login". Test both states.
  - `ResetPasswordForm`: two `PasswordField`s (`new-password`), submit "Update password". Test labels
    and the mismatch error display.
  - `forgot-password/page.tsx`: shell + story from frame `333:210` ("Account recovery" / "Let's get
    you back to Korume." / quote "Every journey can begin again.") + `pose="forgot-password"`.
  - `reset-password/page.tsx` (derived, spec §1): server-side
    `const { data: { user } } = await createClient().auth.getUser()`; no user → the card shows the
    expired message and a link to `/forgot-password` instead of the form; with a user → the form.
    `pose="reset-password"`. Same shell, story and card primitives, no new composition.

- [ ] **Step 5: Routes** — `AUTH_ROUTES` gains `"/forgot-password"`. Test:
  `isAuthRoute("/forgot-password") === true` and `isAuthRoute("/reset-password") === false`, with a
  comment pointing to spec §4.2. Mutation-check the second assertion by adding `/reset-password` to
  the list, seeing red, removing it.

- [ ] **Step 6: Login link** — `LoginForm` gains "Forgot password?" linking to `/forgot-password`,
  placed on the password label row as in frame `65:2`. Update `login-form.test.tsx`: the Task 2
  "no forgot link" assertion flips to asserting the link and its `href` `/en/forgot-password`.

- [ ] **Step 7: Verify** — append `"/en/forgot-password"` and `"/en/reset-password"` to `AUTH_ROUTES_UNDER_TEST` (and its length assertion; the signed-out reset page has no submit button, so for it assert the "request a new link" link instead) · tsc 0 · lint 0 · vitest dot exit 0 · e2e: add to
  `tests/e2e/auth-verify-email.spec.ts` (or a new `auth-password-reset.spec.ts`) at 1280: login →
  "Forgot password?" → submit an email → the neutral confirmation shows; `/en/reset-password`
  signed out shows the expired state with a link to `/en/forgot-password`.

- [ ] **Step 8: Commit** — `feat(auth): password reset by email link`

---

### Task 6: 404

**Files:**
- Create: `messages/{en,vi}/errors.json`; Modify: `lib/i18n/namespaces.ts` (add `"errors"`)
- Create: `components/errors/requested-path.tsx` (+ test), `components/errors/not-found-view.tsx`
  (+ test)
- Create: `app/[locale]/not-found.tsx`, `app/[locale]/[...rest]/page.tsx`

**Interfaces:**
- Consumes: `MascotPose` (Task 1).
- Produces: `RequestedPath({ label }: { label: string })` — client leaf rendering
  `{label} <code>{pathname}</code>` from `usePathname()` of `next/navigation` (the raw, locale-
  prefixed path is what the user typed); reused by Task 7.

- [ ] **Step 1: Failing tests.** `requested-path.test.tsx` mocks `next/navigation`'s `usePathname` to
  `"/en/kanji/lesson/green"` and asserts the text renders inside a `<code>`, and that a path
  containing `<script>` renders as literal text (no element created). `not-found-view.test.tsx`
  asserts: `data-density="reference"` on the root; heading "We couldn't find this place."; a "Go
  Home" link to `/en`; a "Go Back" button; the pose image; no `nav` landmark.
  Run → FAIL.

- [ ] **Step 2: Implement.** `NotFoundView` is a server-renderable component that takes translated
  strings as props and renders the composition of frame `335:1976`: logo top-start, "Back" top-end,
  centred eyebrow "404 · Wrong turn", heading, body, "Go Home" (`buttonStyles({ size: "lg" })` link)
  and "Go Back", `RequestedPath`, `MascotPose pose="not-found" size="md"`. "Go Back" and "Back" are
  one small client component `BackButton` in `components/errors/back-button.tsx`:
  `onClick={() => (window.history.length > 1 ? window.history.back() : router.push("/"))}` using the
  locale-aware `useRouter`.
  `app/[locale]/not-found.tsx` loads `errors` translations and renders `NotFoundView`.
  `app/[locale]/[...rest]/page.tsx`: `import { notFound } from "next/navigation"; export default function CatchAll() { notFound(); }`.
  `errors.json` (en + vi) holds `notFound.*`, `routeError.*` (Task 7 fills the latter — add only
  `notFound.*` now), and `requestedPath.*`.

- [ ] **Step 3: Verify** — vitest (including `lib/i18n/catalog.test.ts`, which must accept the new
  namespace) · tsc · lint · e2e at 1280: `/en/this-does-not-exist` returns the 404 view with the
  path text; `/vi/khong-co` shows Vietnamese copy; **every existing route still resolves** (run
  `route-rename-redirects` and `landing-page`).
- [ ] **Step 4: Commit** — `feat(errors): standalone not-found page`

---

### Task 7: Route error boundaries

**Files:**
- Create: `components/errors/route-error-panel.tsx` (+ test)
- Create: `app/[locale]/(protected)/(app)/error.tsx`, `app/[locale]/error.tsx`, `app/global-error.tsx`
- Modify: `messages/{en,vi}/errors.json` (`routeError.*`)
- Create: `tests/e2e/route-error.spec.ts` and a test-only trigger (below)

**Interfaces:**
- Consumes: `MascotPose`, `RequestedPath`, `BackButton` (Tasks 1, 6).
- Produces: `RouteErrorPanel({ mode, onRetry }: { mode: "in-shell" | "standalone"; onRetry: () => void })`.

- [ ] **Step 1: Failing tests** — `route-error-panel.test.tsx`:
  - "Try again" calls `onRetry` once; "Go to Dashboard" links to `/en/dashboard`; "Go Back" exists;
    the reassurance "Your progress is still saved." renders;
  - `mode="in-shell"`: the rendered subtree contains **no** element with a `data-density`
    attribute and no `nav` / `aside` element;
  - the panel never renders error text: render the **adapter** `(app)/error.tsx` default export with
    `error={Object.assign(new Error("SECRET_DB_DETAIL"), { digest: "abc123" })}` and assert neither
    `SECRET_DB_DETAIL` nor `abc123` appears in `document.body.textContent`. Mutation-check: render
    `{error.message}` in the panel, see red, remove.
  Run → FAIL.

- [ ] **Step 2: Implement.**
  - `RouteErrorPanel` (`"use client"`): composition of frame `337:2055`'s **content area only** —
    eyebrow "Route error", heading "Something interrupted this page.", body, a scene card with
    `MascotPose pose="route-error" size="md"` and "Don't worry. We haven't lost your place.", "Try
    again" (primary, `onRetry`), "Go to Dashboard" (link), `BackButton`, the reassurance block, and
    `RequestedPath` with "We had trouble opening". `mode="standalone"` adds
    `data-density="reference"` and `min-h-dvh` centring on its root; `mode="in-shell"` adds nothing
    to density and sizes to the `<main>` it sits in.
  - `app/[locale]/(protected)/(app)/error.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { RouteErrorPanel } from "@/components/errors/route-error-panel";

/** Client boundary adapter (spec §6.2): no layout, no density — the live (app) shell stays. */
export default function AppRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.error(error);
  }, [error]);
  return <RouteErrorPanel mode="in-shell" onRetry={reset} />;
}
```

  - `app/[locale]/error.tsx`: identical adapter with `mode="standalone"`. Its doc comment states the
    scope: descendant segments below the locale layout, **not** errors thrown by
    `app/[locale]/layout.tsx` itself.
  - `app/global-error.tsx`: `"use client"`; renders its own `<html lang="vi"><body>`; imports nothing
    from the app (no i18n, no providers, no components); inline styles only; one fixed line in both
    languages ("Đã có lỗi xảy ra. · Something went wrong.") and a button calling `reset()`.

- [ ] **Step 3: e2e trigger.** Throwing on purpose needs a route. Add
  `app/[locale]/(protected)/(app)/__e2e/route-error/page.tsx` that throws **only** when
  `process.env.E2E_ROUTE_ERROR === "1"` (read at request time — the route is dynamic under
  `(protected)`) and otherwise calls `notFound()`; add `env: { E2E_ROUTE_ERROR: "1" }` to
  `playwright.config.ts`'s `webServer`. That config has `reuseExistingServer: !process.env.CI`, so an
  already-running server started without the variable will not throw: the spec must first check
  that the trigger page does **not** show the 404 view, and fail with a message naming
  `E2E_ROUTE_ERROR` if it does, instead of failing obscurely. Document in the page's comment that it
  is inert in every non-e2e environment; add the path nowhere else (no nav entry, no registry row).
  `tests/e2e/route-error.spec.ts` at 1280: register via `registerViaUi`, measure the sidebar
  (`nav` landmark) bounding box on `/en/dashboard`, visit `/en/__e2e/route-error`, assert
  "Something interrupted this page." is visible, the sidebar is still present with the **same**
  width (±0.5 px), no ancestor of the panel carries `data-density="reference"`, and "Try again" is
  focusable by keyboard.

- [ ] **Step 4: Verify** — tsc 0 · lint 0 · vitest dot exit 0 · the new spec plus the full auth
  e2e set green · `npm run verify:protocol` 0.
- [ ] **Step 5: Commit** — `feat(errors): in-shell route error and fallback boundaries`

---

## After Task 7 (Claude)

Whole-branch review from `git diff master...auth-error-ux`; spec §8.2 measurement at 1280 from a
worktree build; spec §8.3 hand round trips (confirmations toggled on in the review environment only,
code read from Mailpit, reset link followed); the production template instruction recorded in the
run state for the owner; owner review in their own Chrome; merge `--no-ff`.
