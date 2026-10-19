import type { Learner } from "./learner";

/** Spec P1 — the locked list. 34 static + 7 dynamic (app) routes + 4 (focus) routes = 45 (practice-pronunciation added the fourth). */
export const STATIC_ROUTES = [
  "achievements", "certification", "challenges", "community", "community/peer-review", "companion",
  "conversation", "dashboard", "e2e-route-error", "grammar", "kanji", "kanji/review", "korume/chat",
  "leaderboard", "mining", "mining/review", "playlists", "profile", "profile/edit", "pronunciation",
  "pronunciation/paths", "reading", "review", "roadmap", "settings", "settings/privacy",
  "settings/privacy/memory", "shadowing", "shadowing/explore", "statistics", "vocab", "vocab/review",
  "weekly-report",
] as const;
export const ROUTE_COUNT = 45;

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
    { label: "(focus) shadowing/[id]/pronunciation", path: `shadowing/${videoId}/pronunciation` },
    { label: "(focus) shadowing/[id]/dictation", path: `shadowing/${videoId}/dictation` },
    { label: "(focus) shadowing/[id]/summary", path: `shadowing/${videoId}/summary` },
  ];
  if (routes.length !== ROUTE_COUNT) throw new Error(`route list has ${routes.length} entries, spec P1 locks ${ROUTE_COUNT}`);
  return routes;
}
