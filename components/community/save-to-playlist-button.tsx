"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PlaylistListItem } from "@/lib/playlist-types";

export interface SaveToPlaylistButtonProps {
  videoId: string;
  className?: string;
}

type ListState = { status: "idle" | "loading" } | { status: "ready"; playlists: PlaylistListItem[] } | { status: "error"; message: string };
type AddState = { status: "idle" } | { status: "adding"; playlistId: string } | { status: "added" } | { status: "error"; message: string };

/**
 * "Save to playlist" popover for a video (list card or detail page): pick an
 * existing playlist or quick-create a new one, in one step. Follows this
 * repo's popover precedent (`components/reading/word-lookup-popover.tsx`,
 * `components/video-player/mine-line-control.tsx`) — Escape/outside-click
 * closes and returns focus to the trigger; the playlist list is lazily
 * fetched only once the popover is first opened.
 *
 * Translated from `playlists.*` (not `community.*`, despite the file's
 * `components/community/` path): it's a playlist feature, and per the Task
 * 16 dependency-graph audit it's also consumed from the `videos` surface
 * (`app/[locale]/(app)/videos/page.tsx`, `.../videos/[id]/shadowing/page.tsx`)
 * — ownership follows the feature, not the directory.
 */
export function SaveToPlaylistButton({ videoId, className }: SaveToPlaylistButtonProps) {
  const t = useTranslations("playlists");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [listState, setListState] = useState<ListState>({ status: "idle" });
  const [addState, setAddState] = useState<AddState>({ status: "idle" });
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const popoverId = useId();
  const nameId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstFocusRef = useRef<HTMLInputElement | HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listState.status === "idle") void loadPlaylists();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPlaylists is stable enough for this popover's lifetime
  }, [open]);

  useEffect(() => {
    if (open) firstFocusRef.current?.focus();
  }, [open, listState.status]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  async function loadPlaylists(): Promise<void> {
    setListState({ status: "loading" });
    try {
      const res = await fetch("/api/playlists");
      if (!res.ok) {
        setListState({ status: "error", message: t("saveButton.loadListError") });
        return;
      }
      const json = (await res.json()) as { data: PlaylistListItem[] };
      setListState({ status: "ready", playlists: json.data });
    } catch {
      setListState({ status: "error", message: tCommon("errors.network") });
    }
  }

  async function addToPlaylist(playlistId: string): Promise<void> {
    setAddState({ status: "adding", playlistId });
    try {
      const res = await fetch(`/api/playlists/${playlistId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId }),
      });
      if (res.status === 201) {
        setAddState({ status: "added" });
        return;
      }
      if (res.status === 409) {
        setAddState({ status: "error", message: t("saveButton.alreadyInPlaylist") });
        return;
      }
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After");
        setAddState({
          status: "error",
          message: retryAfter
            ? t("saveButton.tooManyWithSeconds", { seconds: retryAfter })
            : t("saveButton.tooManyGeneric"),
        });
        return;
      }
      setAddState({ status: "error", message: t("saveButton.addError") });
    } catch {
      setAddState({ status: "error", message: tCommon("errors.network") });
    }
  }

  async function createAndAdd(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (creating || !newName.trim()) return;
    setCreating(true);
    setAddState({ status: "idle" });
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (res.status !== 201) {
        setAddState({ status: "error", message: t("saveButton.createError") });
        return;
      }
      const json = (await res.json()) as { data: { id: string; createdAt: string } };
      setNewName("");
      await addToPlaylist(json.data.id);
    } catch {
      setAddState({ status: "error", message: tCommon("errors.network") });
    } finally {
      setCreating(false);
    }
  }

  const playlists = listState.status === "ready" ? listState.playlists : [];

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls={open ? popoverId : undefined}
        className="rounded-md bg-card/90 px-2 py-1 text-xs font-medium text-foreground shadow-raised hover:bg-secondary"
      >
        {t("saveButton.trigger")}
      </button>

      {open && (
        <div
          id={popoverId}
          role="group"
          aria-label={t("saveButton.trigger")}
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-border bg-card p-3 text-left shadow-overlay"
        >
          {listState.status === "loading" && <p className="text-sm text-muted-foreground">{t("saveButton.loadingPlaylists")}</p>}
          {listState.status === "error" && (
            <p role="alert" className="text-sm text-danger-strong">
              {listState.message}
            </p>
          )}

          {listState.status === "ready" && playlists.length > 0 && (
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {playlists.map((playlist, index) => (
                <li key={playlist.id}>
                  <button
                    ref={index === 0 ? (firstFocusRef as React.RefObject<HTMLButtonElement>) : undefined}
                    type="button"
                    onClick={() => void addToPlaylist(playlist.id)}
                    disabled={addState.status === "adding"}
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-secondary disabled:pointer-events-none disabled:opacity-50"
                  >
                    {playlist.name}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={createAndAdd} className="mt-2 flex items-center gap-1 border-t border-border pt-2">
            <label htmlFor={nameId} className="sr-only">
              {t("saveButton.newPlaylistNameLabel")}
            </label>
            <input
              ref={playlists.length === 0 ? (firstFocusRef as React.RefObject<HTMLInputElement>) : undefined}
              id={nameId}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("saveButton.newPlaylistNameLabel")}
              maxLength={100}
              disabled={creating}
              className="w-full rounded border border-input bg-card px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="shrink-0 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {t("saveButton.createAndAdd")}
            </button>
          </form>

          <p role={addState.status === "error" ? "alert" : "status"} aria-live="polite" className={cn("mt-1 text-xs", addState.status === "error" ? "text-danger-strong" : "text-success-strong")}>
            {addState.status === "added" && t("saveButton.added")}
            {addState.status === "error" && addState.message}
          </p>
        </div>
      )}
    </div>
  );
}
