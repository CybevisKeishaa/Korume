"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "./confirm-button";
import { RelativeTime } from "./relative-time";
import { FORUM_TOPICS, topicLabel } from "./forum-post-item";
import type { ForumCommentItem, ForumPostDetail, ForumTopic } from "@/lib/forum-types";

export interface ForumThreadProps {
  post: ForumPostDetail;
  /** The signed-in caller's user id, so own-post/own-comment edit/delete controls only render for the owner. */
  currentUserId: string | null;
}

type ActionState = { status: "idle" | "submitting" } | { status: "error"; message: string };

type RateLimitAction = "requests" | "comments";

/**
 * Resolves a `RateLimitAction` to its translated "Too many X — ..." message.
 * Two explicit branches (not a templated key) so the two catalog entries can
 * be worded naturally per locale instead of forcing a single English noun
 * ("requests"/"comments") into every language's sentence structure.
 */
function friendlyRateLimit(
  t: ReturnType<typeof useTranslations<"community">>,
  retryAfter: string | null,
  action: RateLimitAction,
): string {
  if (action === "requests") {
    return retryAfter
      ? t("thread.tooManyRequestsWithSeconds", { seconds: retryAfter })
      : t("thread.tooManyRequestsGeneric");
  }
  return retryAfter
    ? t("thread.tooManyCommentsWithSeconds", { seconds: retryAfter })
    : t("thread.tooManyCommentsGeneric");
}

/**
 * A forum post's full thread: content, own-post edit/delete, chronological
 * comments with own-comment edit/delete, and a comment composer. All state is
 * seeded once from the server-fetched `post` prop and then owned locally —
 * mutations plain-revalidate their own slice of state rather than re-fetching
 * the whole detail page (no optimistic full-comment insert is possible for
 * post edits either, since the PATCH response only echoes `{ id }`; the
 * locally-known values are applied directly instead).
 */
export function ForumThread({ post: initialPost, currentUserId }: ForumThreadProps) {
  const t = useTranslations("community");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  const [comments, setComments] = useState<ForumCommentItem[]>(initialPost.comments);

  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editTopic, setEditTopic] = useState<ForumTopic>(post.topic);
  const [editContent, setEditContent] = useState(post.content);
  const [postAction, setPostAction] = useState<ActionState>({ status: "idle" });

  const [commentText, setCommentText] = useState("");
  const [commentAction, setCommentAction] = useState<ActionState>({ status: "idle" });

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [commentEditAction, setCommentEditAction] = useState<ActionState>({ status: "idle" });

  const titleId = useId();
  const topicId = useId();
  const contentId = useId();
  const commentBoxId = useId();

  const isOwnPost = currentUserId !== null && post.author?.id === currentUserId;

  const TOPIC_OPTIONS: { value: ForumTopic; label: string }[] = FORUM_TOPICS.map((value) => ({
    value,
    label: topicLabel(t, value),
  }));

  function startEditPost(): void {
    setEditTitle(post.title);
    setEditTopic(post.topic);
    setEditContent(post.content);
    setPostAction({ status: "idle" });
    setEditingPost(true);
  }

  async function saveEditPost(): Promise<void> {
    if (!editTitle.trim() || !editContent.trim()) return;
    setPostAction({ status: "submitting" });
    try {
      const res = await fetch(`/api/forum/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, topic: editTopic, content: editContent }),
      });
      if (res.ok) {
        setPost((prev) => ({ ...prev, title: editTitle, topic: editTopic, content: editContent }));
        setEditingPost(false);
        setPostAction({ status: "idle" });
        return;
      }
      if (res.status === 429) {
        setPostAction({ status: "error", message: friendlyRateLimit(t, res.headers.get("Retry-After"), "requests") });
        return;
      }
      setPostAction({ status: "error", message: t("thread.saveChangesError") });
    } catch {
      setPostAction({ status: "error", message: tCommon("errors.network") });
    }
  }

  async function deletePost(): Promise<void> {
    const res = await fetch(`/api/forum/posts/${post.id}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 204)) {
      router.push("/community");
      return;
    }
    setPostAction({ status: "error", message: t("thread.deletePostError") });
  }

  async function submitComment(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (commentAction.status === "submitting" || !commentText.trim()) return;
    setCommentAction({ status: "submitting" });
    try {
      const res = await fetch(`/api/forum/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: commentText }),
      });
      if (res.status === 201) {
        const json = (await res.json()) as { data: { id: string; createdAt: string } };
        setComments((prev) => [
          ...prev,
          {
            id: json.data.id,
            content: commentText,
            createdAt: json.data.createdAt,
            author: currentUserId ? { id: currentUserId, name: t("thread.you"), avatarUrl: null } : null,
          },
        ]);
        setCommentText("");
        setCommentAction({ status: "idle" });
        return;
      }
      if (res.status === 429) {
        setCommentAction({ status: "error", message: friendlyRateLimit(t, res.headers.get("Retry-After"), "comments") });
        return;
      }
      setCommentAction({ status: "error", message: t("thread.postCommentError") });
    } catch {
      setCommentAction({ status: "error", message: tCommon("errors.network") });
    }
  }

  function startEditComment(comment: ForumCommentItem): void {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.content);
    setCommentEditAction({ status: "idle" });
  }

  async function saveEditComment(commentId: string): Promise<void> {
    if (!editCommentText.trim()) return;
    setCommentEditAction({ status: "submitting" });
    try {
      const res = await fetch(`/api/forum/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentText }),
      });
      if (res.ok) {
        setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: editCommentText } : c)));
        setEditingCommentId(null);
        setCommentEditAction({ status: "idle" });
        return;
      }
      if (res.status === 429) {
        setCommentEditAction({ status: "error", message: friendlyRateLimit(t, res.headers.get("Retry-After"), "requests") });
        return;
      }
      setCommentEditAction({ status: "error", message: t("thread.saveChangesError") });
    } catch {
      setCommentEditAction({ status: "error", message: tCommon("errors.network") });
    }
  }

  async function deleteComment(commentId: string): Promise<void> {
    const res = await fetch(`/api/forum/comments/${commentId}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 204)) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  }

  return (
    <div className="space-y-8">
      <article>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{post.title}</h1>
          {isOwnPost && !editingPost && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={startEditPost}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {t("thread.editPost")}
              </button>
              <ConfirmButton label={t("thread.deletePost")} confirmLabel={t("thread.deletePostConfirm")} onConfirm={() => void deletePost()} />
            </div>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span>{post.author?.name ?? t("deletedUser")}</span>
          <span aria-hidden="true">·</span>
          <RelativeTime dateTime={post.createdAt} />
        </div>

        {editingPost ? (
          <div className="mt-4 space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <Label htmlFor={titleId}>{t("composer.titleLabel")}</Label>
              <Input id={titleId} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor={topicId}>{t("composer.topicLabel")}</Label>
              <select
                id={topicId}
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value as ForumTopic)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              >
                {TOPIC_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor={contentId}>{t("composer.contentLabel")}</Label>
              <textarea
                id={contentId}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                className="mt-1 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void saveEditPost()}
                disabled={postAction.status === "submitting" || !editTitle.trim() || !editContent.trim()}
              >
                {postAction.status === "submitting" ? t("thread.saving") : tCommon("actions.save")}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditingPost(false)}>
                {tCommon("actions.cancel")}
              </Button>
            </div>
            {postAction.status === "error" && (
              <p role="alert" className="text-sm text-danger-strong">
                {postAction.message}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="whitespace-pre-line mt-4 text-foreground">{post.content}</p>
            {postAction.status === "error" && (
              <p role="alert" className="mt-2 text-sm text-danger-strong">
                {postAction.message}
              </p>
            )}
          </>
        )}
      </article>

      <section aria-labelledby="comments-heading">
        <h2 id="comments-heading" className="mb-3 text-lg font-semibold">
          {t("thread.commentsHeading")}
        </h2>

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("thread.noComments")}</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => {
              const isOwnComment = currentUserId !== null && comment.author?.id === currentUserId;
              const isEditingThis = editingCommentId === comment.id;
              return (
                <li key={comment.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                      <span>{comment.author?.name ?? t("deletedUser")}</span>
                      <span aria-hidden="true">·</span>
                      <RelativeTime dateTime={comment.createdAt} />
                    </div>
                    {isOwnComment && !isEditingThis && (
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => startEditComment(comment)}
                          className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {t("thread.editComment")}
                        </button>
                        <ConfirmButton
                          label={t("thread.deleteComment")}
                          confirmLabel={t("thread.deleteCommentConfirm")}
                          onConfirm={() => void deleteComment(comment.id)}
                        />
                      </div>
                    )}
                  </div>

                  {isEditingThis ? (
                    <div className="mt-2 space-y-2">
                      <textarea
                        value={editCommentText}
                        onChange={(e) => setEditCommentText(e.target.value)}
                        rows={3}
                        aria-label={t("thread.editCommentAriaLabel")}
                        className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void saveEditComment(comment.id)}
                          disabled={commentEditAction.status === "submitting" || !editCommentText.trim()}
                        >
                          {tCommon("actions.save")}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditingCommentId(null)}>
                          {tCommon("actions.cancel")}
                        </Button>
                      </div>
                      {commentEditAction.status === "error" && (
                        <p role="alert" className="text-sm text-danger-strong">
                          {commentEditAction.message}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="whitespace-pre-line mt-1 text-sm text-foreground">{comment.content}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={submitComment} className="mt-4 space-y-2">
          <Label htmlFor={commentBoxId}>{t("thread.commentLabel")}</Label>
          <textarea
            id={commentBoxId}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder={t("thread.commentPlaceholder")}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
          <Button type="submit" size="sm" disabled={commentAction.status === "submitting" || !commentText.trim()}>
            {commentAction.status === "submitting" ? t("thread.posting") : t("thread.commentButton")}
          </Button>
          {commentAction.status === "error" && (
            <p role="alert" className="text-sm text-danger-strong">
              {commentAction.message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
