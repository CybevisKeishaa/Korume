import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeContentText, sanitizeTranscriptText } from "@/lib/transcript/sanitize";
import type {
  CreateForumCommentInput,
  CreateForumPostInput,
  ForumTopic,
  ListForumPostsQuery,
  UpdateForumCommentInput,
  UpdateForumPostInput,
} from "@/lib/validation/forum";

/**
 * Community forum (CLAUDE.md §5 community module, spec §5). Reads
 * (list/detail) follow the `lib/data/jlpt.ts`/`lib/data/content.ts`
 * convention: no explicit auth check — `forum_posts_read`/`forum_comments_read`
 * (migration 20260712000002_rls.sql) already scope `select` to the
 * `authenticated` role, so a signed-out request is blocked by RLS itself
 * (empty result) rather than an explicit 401 here. Writes (create/update/
 * delete post or comment) DO check auth explicitly, like every mutation
 * elsewhere in `lib/data/*`.
 *
 * G1 (docs/product/business-model.md §1.1): forum activity is NOT a learning
 * outcome — this module never calls `recordActivity`.
 */

const CREATE_POST_LIMIT = { limit: 10, windowMs: 60_000 };
const CREATE_COMMENT_LIMIT = { limit: 30, windowMs: 60_000 };
const MODIFY_LIMIT = { limit: 30, windowMs: 60_000 };

export interface ForumAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

/**
 * Batch-resolve {id, name, avatar_url} for a set of user ids via the service
 * role — `users_select_own` (migration 20260712000002_rls.sql) confines the
 * normal client to the caller's own row, so reading OTHER users' display
 * names for an author byline requires bypassing RLS. NEVER selects `email`.
 * Small helper duplicated (not shared) across `lib/data/forum.ts` /
 * `playlists.ts` / `peer-review.ts` / `leaderboard.ts` deliberately, to keep
 * each of those four files self-contained per this layer's file ownership
 * split.
 */
async function fetchAuthors(userIds: string[]): Promise<Map<string, ForumAuthor>> {
  const uniqueIds = Array.from(new Set(userIds));
  const map = new Map<string, ForumAuthor>();
  if (uniqueIds.length === 0) return map;

  const service = createServiceClient();
  const { data, error } = await service.from("users").select("id, name, avatar_url").in("id", uniqueIds);
  if (error) throw error;

  for (const row of (data as { id: string; name: string | null; avatar_url: string | null }[]) ?? []) {
    map.set(row.id, { id: row.id, name: row.name, avatarUrl: row.avatar_url });
  }
  return map;
}

interface PostRow {
  id: string;
  user_id: string | null;
  title: string;
  content: string;
  topic: ForumTopic;
  created_at: string;
  updated_at: string;
}

export interface ForumPostListItem {
  id: string;
  title: string;
  content: string;
  topic: ForumTopic;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor | null;
  commentCount: number;
}

export interface ForumPostsPage {
  posts: ForumPostListItem[];
  nextCursor: string | null;
}

const POST_COLUMNS = "id, user_id, title, content, topic, created_at, updated_at";

/** Newest-first, optionally filtered by topic, cursor-paginated on `created_at`. */
export async function listForumPosts(query: ListForumPostsQuery): Promise<ForumPostsPage> {
  const supabase = createClient();
  let dbQuery = supabase.from("forum_posts").select(POST_COLUMNS).order("created_at", { ascending: false }).limit(query.limit);
  if (query.topic) dbQuery = dbQuery.eq("topic", query.topic);
  if (query.cursor) dbQuery = dbQuery.lt("created_at", query.cursor);

  const { data, error } = await dbQuery;
  if (error) throw error;
  const rows = (data as PostRow[]) ?? [];

  const postIds = rows.map((r) => r.id);
  const [authors, commentCounts] = await Promise.all([
    fetchAuthors(rows.map((r) => r.user_id).filter((id): id is string => id !== null)),
    countCommentsByPost(supabase, postIds),
  ]);

  const posts: ForumPostListItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    topic: row.topic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: row.user_id ? (authors.get(row.user_id) ?? null) : null,
    commentCount: commentCounts.get(row.id) ?? 0,
  }));

  const nextCursor = rows.length === query.limit ? (rows[rows.length - 1]?.created_at ?? null) : null;
  return { posts, nextCursor };
}

async function countCommentsByPost(
  supabase: ReturnType<typeof createClient>,
  postIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;

  const { data, error } = await supabase.from("forum_comments").select("id, post_id").in("post_id", postIds);
  if (error) throw error;
  for (const row of (data as { post_id: string }[]) ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }
  return counts;
}

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
}

export interface ForumCommentItem {
  id: string;
  content: string;
  createdAt: string;
  author: ForumAuthor | null;
}

export interface ForumPostDetail {
  id: string;
  title: string;
  content: string;
  topic: ForumTopic;
  createdAt: string;
  updatedAt: string;
  author: ForumAuthor | null;
  comments: ForumCommentItem[];
}

/** One post plus its comments, chronological (oldest first). */
export async function getForumPost(id: string): Promise<ForumPostDetail | null> {
  const supabase = createClient();
  const { data: post, error: postError } = await supabase.from("forum_posts").select(POST_COLUMNS).eq("id", id).maybeSingle();
  if (postError) throw postError;
  if (!post) return null;
  const postRow = post as PostRow;

  const { data: comments, error: commentsError } = await supabase
    .from("forum_comments")
    .select("id, post_id, user_id, content, created_at")
    .eq("post_id", id)
    .order("created_at", { ascending: true });
  if (commentsError) throw commentsError;
  const commentRows = (comments as CommentRow[]) ?? [];

  const authorIds = [postRow.user_id, ...commentRows.map((c) => c.user_id)].filter((v): v is string => v !== null);
  const authors = await fetchAuthors(authorIds);

  return {
    id: postRow.id,
    title: postRow.title,
    content: postRow.content,
    topic: postRow.topic,
    createdAt: postRow.created_at,
    updatedAt: postRow.updated_at,
    author: postRow.user_id ? (authors.get(postRow.user_id) ?? null) : null,
    comments: commentRows.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: c.user_id ? (authors.get(c.user_id) ?? null) : null,
    })),
  };
}

export type CreateForumPostResult =
  | { ok: true; data: { id: string; createdAt: string } }
  | { ok: false; status: 401 }
  | { ok: false; status: 429; retryAfter: number };

export async function createForumPost(
  input: CreateForumPostInput,
  now: Date = new Date(),
): Promise<CreateForumPostResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`forum:post:create:${user.id}`, CREATE_POST_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: inserted, error } = await supabase
    .from("forum_posts")
    .insert({
      user_id: user.id,
      title: sanitizeTranscriptText(input.title),
      content: sanitizeContentText(input.content),
      topic: input.topic,
    })
    .select("id, created_at")
    .single();
  if (error) throw error;

  const row = inserted as { id: string; created_at: string };
  return { ok: true, data: { id: row.id, createdAt: row.created_at } };
}

export type UpdateForumPostResult =
  | { ok: true; data: { id: string } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

/** Own post only — RLS also enforces this; the explicit `eq("user_id", ...)` makes a not-found vs. not-owned response indistinguishable (both 404), which is intentional (no ownership oracle). */
export async function updateForumPost(
  id: string,
  input: UpdateForumPostInput,
  now: Date = new Date(),
): Promise<UpdateForumPostResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`forum:post:modify:${user.id}`, MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const patch: { title?: string; content?: string; topic?: ForumTopic } = {};
  if (input.title !== undefined) patch.title = sanitizeTranscriptText(input.title);
  if (input.content !== undefined) patch.content = sanitizeContentText(input.content);
  if (input.topic !== undefined) patch.topic = input.topic;

  const { data, error } = await supabase
    .from("forum_posts")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: { id: (data as { id: string }).id } };
}

export type DeleteForumPostResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function deleteForumPost(id: string, now: Date = new Date()): Promise<DeleteForumPostResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`forum:post:modify:${user.id}`, MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase.from("forum_posts").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true };
}

export type CreateForumCommentResult =
  | { ok: true; data: { id: string; createdAt: string } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function createForumComment(
  postId: string,
  input: CreateForumCommentInput,
  now: Date = new Date(),
): Promise<CreateForumCommentResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`forum:comment:create:${user.id}`, CREATE_COMMENT_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data: post, error: postError } = await supabase.from("forum_posts").select("id").eq("id", postId).maybeSingle();
  if (postError) throw postError;
  if (!post) return { ok: false, status: 404 };

  const { data: inserted, error } = await supabase
    .from("forum_comments")
    .insert({ post_id: postId, user_id: user.id, content: sanitizeContentText(input.content) })
    .select("id, created_at")
    .single();
  if (error) throw error;

  const row = inserted as { id: string; created_at: string };
  return { ok: true, data: { id: row.id, createdAt: row.created_at } };
}

export type UpdateForumCommentResult =
  | { ok: true; data: { id: string } }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function updateForumComment(
  id: string,
  input: UpdateForumCommentInput,
  now: Date = new Date(),
): Promise<UpdateForumCommentResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`forum:comment:modify:${user.id}`, MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase
    .from("forum_comments")
    .update({ content: sanitizeContentText(input.content) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true, data: { id: (data as { id: string }).id } };
}

export type DeleteForumCommentResult =
  | { ok: true }
  | { ok: false; status: 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

export async function deleteForumComment(id: string, now: Date = new Date()): Promise<DeleteForumCommentResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const limited = rateLimit(`forum:comment:modify:${user.id}`, MODIFY_LIMIT, now.getTime());
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };

  const { data, error } = await supabase.from("forum_comments").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) return { ok: false, status: 404 };

  return { ok: true };
}
