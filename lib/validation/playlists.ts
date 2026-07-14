import { z } from "zod";

/** POST /api/playlists body. */
export const createPlaylistSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(100, "Name is too long (max 100 characters)."),
  description: z.string().trim().max(500, "Description is too long (max 500 characters).").optional(),
});
export type CreatePlaylistInput = z.infer<typeof createPlaylistSchema>;

/** PATCH /api/playlists/[id] body — at least one field required. */
export const updatePlaylistSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    isPublic: z.boolean().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.isPublic !== undefined, {
    message: "At least one field is required.",
  });
export type UpdatePlaylistInput = z.infer<typeof updatePlaylistSchema>;

/** POST /api/playlists/[id]/items body. */
export const addPlaylistItemSchema = z.object({
  videoId: z.string().uuid(),
});
export type AddPlaylistItemInput = z.infer<typeof addPlaylistItemSchema>;

/** PATCH /api/playlists/[id]/items body — reorder one item. */
export const reorderPlaylistItemSchema = z.object({
  videoId: z.string().uuid(),
  orderIndex: z.coerce.number().int().min(0),
});
export type ReorderPlaylistItemInput = z.infer<typeof reorderPlaylistItemSchema>;

/** GET /api/playlists/public?cursor=&limit= */
export const listPublicPlaylistsQuerySchema = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListPublicPlaylistsQuery = z.infer<typeof listPublicPlaylistsQuerySchema>;
