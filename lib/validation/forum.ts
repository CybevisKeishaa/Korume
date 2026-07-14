import { z } from "zod";

/** Matches the `forum_posts.topic` check constraint (migration 20260714000014). */
export const forumTopicSchema = z.enum([
  "general",
  "grammar",
  "vocab",
  "listening",
  "speaking",
  "jlpt",
  "study-tips",
]);
export type ForumTopic = z.infer<typeof forumTopicSchema>;

/** GET /api/forum/posts?topic=&cursor=&limit= — cursor is an opaque `created_at` ISO timestamp. */
export const listForumPostsQuerySchema = z.object({
  topic: forumTopicSchema.optional(),
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListForumPostsQuery = z.infer<typeof listForumPostsQuerySchema>;

/** POST /api/forum/posts body. */
export const createForumPostSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200, "Title is too long (max 200 characters)."),
  content: z.string().trim().min(1, "Content is required.").max(10_000, "Content is too long (max 10000 characters)."),
  topic: forumTopicSchema,
});
export type CreateForumPostInput = z.infer<typeof createForumPostSchema>;

/** PATCH /api/forum/posts/[id] body — own post only; at least one field required. */
export const updateForumPostSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10_000).optional(),
    topic: forumTopicSchema.optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined || v.topic !== undefined, {
    message: "At least one field is required.",
  });
export type UpdateForumPostInput = z.infer<typeof updateForumPostSchema>;

/** POST /api/forum/posts/[id]/comments body. */
export const createForumCommentSchema = z.object({
  content: z.string().trim().min(1, "Content is required.").max(5000, "Content is too long (max 5000 characters)."),
});
export type CreateForumCommentInput = z.infer<typeof createForumCommentSchema>;

/** PATCH /api/forum/comments/[id] body. */
export const updateForumCommentSchema = z.object({
  content: z.string().trim().min(1, "Content is required.").max(5000, "Content is too long (max 5000 characters)."),
});
export type UpdateForumCommentInput = z.infer<typeof updateForumCommentSchema>;
