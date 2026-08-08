import { test, expect } from "@playwright/test";

// Spec §3.1.1. Three explicit rules, not one wildcard: the lesson rule
// COLLAPSES a segment (`/videos/:id/shadowing` → `/shadowing/:id`) rather than
// renaming a prefix. Getting that one wrong sends a learner silently into the
// wrong lesson mode instead of to an error, which is why it is asserted here.
//
// HTTP-level, not page-level: `/shadowing` is in PROTECTED_PREFIXES
// (lib/supabase/route-protection.ts), so following the redirect with a real
// browser chains into a SECOND redirect from the auth middleware
// (`/login?redirectTo=...`) for an unauthenticated request. That second hop
// is correct, pre-existing app behaviour (carried over from `/videos`, see
// git show 75abe1f), but asserting the final URL after following it would
// test auth, not the rename. Using the `request` fixture with
// `maxRedirects: 0` takes auth out of the picture entirely and asserts
// exactly what Task 4 owns: the raw redirect response `next.config.mjs`
// produces.
//
// The status is asserted as 307, not just "a redirect": TEMPORARY (307) is
// the central decision this task made — these routes move again once Plan D
// restructures the lesson workspace, and a 308 is cached hard by browsers,
// turning that future change into a debugging trap that presents as an app
// routing bug. Checking a bare "3xx" would silently let that regress.
const ID = "00000000-0000-0000-0000-000000000000";

/** Verified empirically: Next sends `location` as path-only (e.g.
 * "/en/shadowing"), not an absolute URL. Still resolve against a dummy base
 * rather than compare the raw string, so this keeps working if that ever
 * changes — without falling back to a loose substring match, which would
 * let the segment-collapse case pass on a wrong path. */
function locationPathname(location: string | undefined): string {
  if (!location) throw new Error("Expected a Location header on the redirect response");
  return new URL(location, "http://localhost").pathname;
}

test("hub route redirects with 307 to /en/shadowing", async ({ request }) => {
  const res = await request.get("/en/videos", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(locationPathname(res.headers()["location"])).toBe("/en/shadowing");
});

test("lesson route redirects with 307 and drops the trailing segment", async ({ request }) => {
  const res = await request.get(`/en/videos/${ID}/shadowing`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(locationPathname(res.headers()["location"])).toBe(`/en/shadowing/${ID}`);
});

test("dictation route redirects with 307 and keeps its segment", async ({ request }) => {
  const res = await request.get(`/en/videos/${ID}/dictation`, { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(locationPathname(res.headers()["location"])).toBe(`/en/shadowing/${ID}/dictation`);
});

test("the rules are not over-broad: /en/videosomething is not swallowed into /shadowing", async ({
  request,
}) => {
  // Mirrors the prefix-swallowing guard in route-protection.test.ts
  // ("/shadowingsomething must not be swallowed by the /shadowing prefix").
  // "/videosomething" is not in PROTECTED_PREFIXES and matches none of the
  // three explicit redirect sources (Next's `/:locale/videos` source is an
  // exact segment, not a prefix), so nothing should redirect it at all — it
  // should 404. Asserted unconditionally, not branched on the status: a
  // branch that only checks the `location` header inside an `if (was a
  // redirect)` lets an `else` arm assert something already true by
  // construction, so an over-broad rule that redirects with some other
  // status (e.g. a stray 302/303 from middleware, not next.config.mjs)
  // would pass with the `location` header never inspected.
  const res = await request.get("/en/videosomething", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).not.toContain(res.status());
});

test("the rules do not swallow the /api namespace: GET /api/videos still reaches its route handler", async ({
  request,
}) => {
  // The defect this asserts against, found by Plan C1's whole-branch review:
  // `source: "/:locale/videos"` left `:locale` unconstrained, so it matched the
  // literal segment `api`. `redirects()` runs BEFORE the filesystem, so the real
  // endpoint app/api/videos/route.ts was answered `307 -> /api/shadowing`, which
  // then 404s because LocaleLayout calls notFound() for locale="api". That
  // contradicted the LOCKED spec §3.1 ("Not renamed: /api/videos/**").
  //
  // Nothing in-repo called the bare endpoint, so eleven tasks, every per-task
  // review and a fully green gate all missed it. The sibling case
  // /api/videos/recommendations was unaffected (three segments), which is
  // exactly the kind of partial symptom that makes such a bug look like
  // "the API is flaky" rather than a routing defect.
  //
  // Asserted as "not a redirect" rather than as a specific status: this route
  // requires auth and answers 401 unauthenticated today, but the contract Task 4
  // owns is only that next.config.mjs must not intercept it. Pinning 401 here
  // would couple a redirect test to the endpoint's auth behaviour.
  const res = await request.get("/api/videos", { maxRedirects: 0 });
  expect([301, 302, 303, 307, 308]).not.toContain(res.status());
});
