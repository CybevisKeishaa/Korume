"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PlaylistComposerProps {
  onCreated: (result: { id: string; createdAt: string }) => void;
  className?: string;
}

type SubmitState = { status: "idle" | "submitting" } | { status: "error"; message: string };

/** Create-playlist form: name (required) + optional description. Public/private is set later via the toggle on the playlist itself. */
export function PlaylistComposer({ onCreated, className }: PlaylistComposerProps) {
  const t = useTranslations("playlists");
  const tCommon = useTranslations("common");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const nameId = useId();
  const descriptionId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (state.status === "submitting" || !name.trim()) return;
    setState({ status: "submitting" });

    try {
      const body: { name: string; description?: string } = { name };
      if (description.trim()) body.description = description;

      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 201) {
        const json = (await res.json()) as { data: { id: string; createdAt: string } };
        setState({ status: "idle" });
        setName("");
        setDescription("");
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
      setState({ status: "error", message: t("composer.createError") });
    } catch {
      setState({ status: "error", message: tCommon("errors.network") });
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="space-y-3">
        <div>
          <Label htmlFor={nameId}>{t("composer.nameLabel")}</Label>
          <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required className="mt-1" />
        </div>
        <div>
          <Label htmlFor={descriptionId}>{t("composer.descriptionLabel")}</Label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={2}
            className="mt-1 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          />
        </div>
        <Button type="submit" size="sm" disabled={state.status === "submitting" || !name.trim()}>
          {state.status === "submitting" ? t("composer.creating") : t("composer.create")}
        </Button>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-danger-strong">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
