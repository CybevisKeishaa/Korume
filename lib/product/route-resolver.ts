import { readdirSync } from "node:fs";
import path from "node:path";
import type { ScreenChrome } from "./screen-registry-types";

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

/** Recursive walk, not a glob. Returns repo-relative paths, which is what
 *  `resolvePageRoute` expects. Deliberately not `fs.globSync`: that needs
 *  Node 22+, this repo pins @types/node@^20 with no engines field, and the
 *  obvious pattern `app/[locale]/**` silently matches nothing because glob
 *  reads `[locale]` as a character class. */
function walkPages(dir: string, rootDir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkPages(full, rootDir, out);
    else if (entry.name === "page.tsx") out.push(path.relative(rootDir, full));
  }
  return out;
}

export function listPageRoutes(rootDir: string) {
  return walkPages(path.join(rootDir, "app"), rootDir)
    .map((file) => ({ file, ...resolvePageRoute(file) }))
    .sort((a, b) => a.route.localeCompare(b.route));
}
