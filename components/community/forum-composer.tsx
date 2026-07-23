"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FORUM_TOPICS, topicLabel } from "./forum-post-item";
import type { ForumTopic } from "@/lib/forum-types";

export interface ForumComposerProps {
  /** Called after a successful post with the new post's id, so the parent can revalidate the list. */
  onCreated: (result: { id: string; createdAt: string }) => void;
  className?: string;
}

type SubmitState = { status: "idle" | "submitting" | "success" } | { status: "error"; message: string };

/** Post-creation form for the forum board — title, topic, and plain-text content (whitespace-pre-line on render). */
export function ForumComposer({ onCreated, className }: ForumComposerProps) {
  const t = useTranslations("community");
  const tCommon = useTranslations("common");
  const TOPIC_OPTIONS: { value: ForumTopic; label: string }[] = FORUM_TOPICS.map((value) => ({
    value,
    label: topicLabel(t, value),
  }));
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState<ForumTopic>("general");
  const [content, setContent] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  const titleId = useId();
  const topicId = useId();
  const contentId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (state.status === "submitting" || !title.trim() || !content.trim()) return;
    setState({ status: "submitting" });

    try {
      const res = await fetch("/api/forum/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, topic, content }),
      });

      if (res.status === 201) {
        const json = (await res.json()) as { data: { id: string; createdAt: string } };
        setState({ status: "success" });
        setTitle("");
        setTopic("general");
        setContent("");
        onCreated(json.data);
        return;
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setState({
          status: "error",
          message: retryAfter
            ? t("composer.tooManyWithSeconds", { seconds: retryAfter })
            : t("composer.tooManyGeneric"),
        });
        return;
      }
      setState({ status: "error", message: t("composer.postError") });
    } catch {
      setState({ status: "error", message: tCommon("errors.network") });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={titleId}>{t("composer.titleLabel")}</Label>
          <Input
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor={topicId}>{t("composer.topicLabel")}</Label>
          <select
            id={topicId}
            value={topic}
            onChange={(e) => setTopic(e.target.value as ForumTopic)}
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
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={10_000}
            required
            rows={5}
            className="mt-1 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={state.status === "submitting" || !title.trim() || !content.trim()}>
            {state.status === "submitting" ? t("composer.posting") : t("composer.post")}
          </Button>
          <div aria-live="polite">
            {state.status === "success" && <p className="text-sm text-success-strong">{t("composer.posted")}</p>}
          </div>
        </div>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger-strong">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
