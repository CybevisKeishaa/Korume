/**
 * Client-safe types for the Layer 7 admin CMS UI (frontend-engineer). These
 * mirror the JSON shapes returned by the `backend-engineer`-owned routes
 * under `app/api/admin/**` (see those route files + `lib/data/admin-*.ts`
 * for the authoritative server-side shapes) but live here, free of any
 * `server-only` import, so client components can import them directly.
 *
 * `ContentType` itself is NOT redefined here — it's imported from
 * `@/lib/validation/admin-content` (a plain zod module with no server-only
 * dependency) so the admin UI can never drift out of sync with the actual
 * whitelist the API enforces.
 */
export { contentTypeSchema, CONTENT_TYPES } from "@/lib/validation/admin-content";
export type { ContentType } from "@/lib/validation/admin-content";

// ---------------------------------------------------------------------------
// GET /api/admin/videos/pending
// ---------------------------------------------------------------------------
export interface PendingVideoListItem {
  id: string;
  youtube_video_id: string;
  title: string;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
  added_by_user_id: string | null;
  created_at: string;
  importerName: string | null;
  hasTranscript: boolean;
  transcriptLineCount: number;
}

export interface PendingVideosPage {
  items: PendingVideoListItem[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// ---------------------------------------------------------------------------
export interface AdminStats {
  totalUsers: number;
  newUsers7d: number;
  newUsers30d: number;
  activeUsers7d: number;
  activeUsers30d: number;
  retention: {
    cohortSize: number;
    activeCount: number;
    retentionPercent: number | null;
    methodology: string;
  };
  contentCounts: {
    videosPending: number;
    videosApproved: number;
    kanji: number;
    vocab: number;
    grammar: number;
    jlptTests: number;
    readingPassages: number;
  };
  topActivity: { sourceType: string; count: number }[];
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// GET/POST/PATCH/DELETE /api/admin/content/[type]
// ---------------------------------------------------------------------------
/** One row from a content list/detail response. Shape varies per type (and
 * list vs. detail columns differ server-side — see `lib/data/admin-content.ts`
 * `listColumns`/`detailColumns`), so this is intentionally a loose bag of
 * columns rather than a per-type interface; `content-fields.ts` is the
 * source of truth for which named fields the admin UI knows how to render. */
export interface ContentRow {
  id: string;
  [column: string]: unknown;
}

export interface ContentListPage {
  items: ContentRow[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// POST /api/admin/content/[type]/import
// ---------------------------------------------------------------------------
export interface CsvImportRowError {
  row: number;
  errors: string[];
}

export interface CsvImportResponse {
  inserted: number;
  failed: CsvImportRowError[];
}

/** Generic `{ error: string, details?: unknown }` shape every admin route
 * returns on failure. */
export interface ApiErrorBody {
  error: string;
  details?: unknown;
}
