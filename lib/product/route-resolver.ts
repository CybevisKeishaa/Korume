import { globSync } from "node:fs";
import type { ScreenChrome } from "./screen-registry-types";

// `@types/node` in this repo is pinned to v20 (package.json), which predates
// `fs.globSync` (stabilized in Node 22). The runtime here is Node 24 and the
// function exists — this augmentation only fills the missing type, matching
// the real signature (https://nodejs.org/api/fs.html#fsglobsyncpattern-options).
declare module "node:fs" {
  export function globSync(
    pattern: string | string[],
    options?: { cwd?: string },
  ): string[];
}

const CHROME_GROUPS: Record<string, ScreenChrome> = {
  "(app)": "app",
  "(focus)": "focus",
  "(immersive)": "immersive",
  "(admin)": "admin",
  "(auth)": "auth",
  "(marketing)": "marketing",
};

const isGroup = (segment: string) => segment.startsWith("(") && segment.endsWith(")");

/**
 * page-file path → URL route + the chrome contract it sits under.
 *
 * The transformation is exactly Next.js's own rule (spec §3.4): drop
 * `app/[locale]`, drop every `(group)`, drop the trailing `page.tsx`. Dynamic
 * segments need no special case — `[id]` is an ordinary path segment and
 * survives untouched.
 *
 * `chrome` is READ FROM the dropped groups. Never reconstruct a file path from
 * `route` + `chrome`: that direction encodes an assumption about how groups
 * nest and breaks the moment one moves — and it would make T8 a tautology.
 */
export function resolvePageRoute(relativePath: string): {
  route: string;
  chrome: ScreenChrome | null;
} {
  const segments = relativePath.replace(/\\/g, "/").split("/");

  const start = segments.indexOf("[locale]");
  const afterLocale = start === -1 ? segments : segments.slice(start + 1);

  const withoutPage = afterLocale.filter(
    (segment) => segment !== "page.tsx" && segment !== "",
  );

  let chrome: ScreenChrome | null = null;
  const routeSegments: string[] = [];
  for (const segment of withoutPage) {
    if (isGroup(segment)) {
      // Last chrome group wins: `(protected)/(app)` is chrome `app`, and
      // `(protected)` is a session boundary that names no chrome of its own.
      chrome = CHROME_GROUPS[segment] ?? chrome;
      continue;
    }
    routeSegments.push(segment);
  }

  // A group at the root leaves zero segments — that is the index route `/`,
  // never the empty string.
  return { route: `/${routeSegments.join("/")}`.replace(/\/$/, "") || "/", chrome };
}

export function listPageRoutes(rootDir: string) {
  // `[locale]` must be bracket-escaped (`[[]locale[]]`) — glob syntax treats a
  // literal `[locale]` as a character class matching any single one of
  // l/o/c/a/e, not the literal directory name, so the unescaped pattern
  // silently matches zero files. Verified against this repo's real
  // `app/[locale]/**` tree: the escaped form finds all page.tsx files, the
  // unescaped form (as written in the source brief) finds none.
  return globSync("app/[[]locale[]]/**/page.tsx", { cwd: rootDir })
    .map((file) => ({ file, ...resolvePageRoute(file) }))
    .sort((a, b) => a.route.localeCompare(b.route));
}
