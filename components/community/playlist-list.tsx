"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmButton } from "./confirm-button";
import type { PlaylistListItem } from "@/lib/playlist-types";

export interface PlaylistListProps {
  playlists: PlaylistListItem[];
  className?: string;
}

type RowAction = { status: "idle" | "saving" } | { status: "error"; message: string };

function PlaylistRow({ playlist, onChanged, onDeleted }: {
  playlist: PlaylistListItem;
  onChanged: (id: string, patch: Partial<PlaylistListItem>) => void;
  onDeleted: (id: string) => void;
}) {
  const t = useTranslations("playlists");
  const tCommon = useTranslations("common");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist.name);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [action, setAction] = useState<RowAction>({ status: "idle" });
  const nameId = useId();
  const descriptionId = useId();
  const publicId = useId();

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setAction({ status: "saving" });
    try {
      const res = await fetch(`/api/playlists/${playlist.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setAction({ status: "idle" });
        return true;
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setAction({
          status: "error",
          message: retryAfter
            ? t("list.tooManyWithSeconds", { seconds: retryAfter })
            : t("list.tooManyGeneric"),
        });
        return false;
      }
      setAction({ status: "error", message: t("list.saveError") });
      return false;
    } catch {
      setAction({ status: "error", message: tCommon("errors.network") });
      return false;
    }
  }

  async function togglePublic(): Promise<void> {
    const next = !playlist.isPublic;
    const ok = await patch({ isPublic: next });
    if (ok) onChanged(playlist.id, { isPublic: next });
  }

  async function saveEdit(): Promise<void> {
    if (!name.trim()) return;
    const ok = await patch({ name, description });
    if (ok) {
      onChanged(playlist.id, { name, description: description.trim() ? description : null });
      setEditing(false);
    }
  }

  async function deletePlaylist(): Promise<void> {
    const res = await fetch(`/api/playlists/${playlist.id}`, { method: "DELETE" }).catch(() => null);
    if (res && (res.ok || res.status === 204)) onDeleted(playlist.id);
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      {editing ? (
        <div className="space-y-3">
          <div>
            <Label htmlFor={nameId}>{t("composer.nameLabel")}</Label>
            <Input id={nameId} value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor={descriptionId}>{t("list.descriptionLabel")}</Label>
            <textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={action.status === "saving" || !name.trim()}>
              {tCommon("actions.save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
              {tCommon("actions.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/playlists/${playlist.id}`} className="font-medium text-foreground hover:underline">
              {playlist.name}
            </Link>
            {playlist.description && <p className="mt-1 text-sm text-muted-foreground">{playlist.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">{t("itemCount", { count: playlist.itemCount })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {t("list.edit")}
            </button>
            <ConfirmButton label={tCommon("actions.delete")} confirmLabel={t("list.deleteConfirm")} onConfirm={() => void deletePlaylist()} />
          </div>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 border-t border-border pt-3">
        <input
          id={publicId}
          type="checkbox"
          checked={playlist.isPublic}
          onChange={() => void togglePublic()}
          aria-label={t("list.makePublicAriaLabel")}
          className="mt-0.5 h-4 w-4 accent-primary"
        />
        <label htmlFor={publicId} className="text-sm">
          <span className="font-medium">{t("list.publicLabel")}</span>
          <span className="block text-xs text-muted-foreground">{t("list.publicDescription")}</span>
        </label>
      </div>

      {action.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-danger-strong">
          {action.message}
        </p>
      )}
    </li>
  );
}

/** The caller's own playlists: rename/description edit, public toggle (with explicit explanation), delete. */
export function PlaylistList({ playlists: initialPlaylists, className }: PlaylistListProps) {
  const t = useTranslations("playlists");
  const [playlists, setPlaylists] = useState(initialPlaylists);

  function handleChanged(id: string, patch: Partial<PlaylistListItem>): void {
    setPlaylists((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function handleDeleted(id: string): void {
    setPlaylists((prev) => prev.filter((p) => p.id !== id));
  }

  if (playlists.length === 0) {
    return <p className={className ?? "text-sm text-muted-foreground"}>{t("list.empty")}</p>;
  }

  return (
    <ul className={className ?? "space-y-3"}>
      {playlists.map((playlist) => (
        <PlaylistRow key={playlist.id} playlist={playlist} onChanged={handleChanged} onDeleted={handleDeleted} />
      ))}
    </ul>
  );
}
