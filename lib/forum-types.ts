/**
 * Client-safe mirror of `lib/data/forum.ts`'s shapes (that module is
 * `server-only`) — same JSON returned by `GET /api/forum/posts` and
 * `GET /api/forum/posts/[id]`. Same duplication convention as
 * `lib/notification-types.ts` vs `lib/data/notifications.ts`.
 */
export type ForumTopic = "general" | "grammar" | "vocab" | "listening" | "speaking" | "jlpt" | "study-tips";

export interface ForumAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
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
