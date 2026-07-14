"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PlaylistDetail as PlaylistDetailType, PlaylistItemView } from "@/lib/playlist-types";

export interface PlaylistDetailProps {
  playlist: PlaylistDetailType;
  /** Whether the signed-in caller owns this playlist — gates remove/reorder controls. */
  isOwner: boolean;
  className?: string;
}

type ItemAction = Record<string, "idle" | "busy">;

/**
 * One playlist's items, ordered. Owners get remove + reorder (up/down button
 * pairs — no drag-and-drop, so this stays fully keyboard operable); everyone
 * else gets a read-only view (public playlists are visible to all signed-in
 * users, but only the owner can edit them — enforced server-side by RLS too).
 */
export function PlaylistDetail({ playlist, isOwner, className }: PlaylistDetailProps) {
  const [items, setItems] = useState<PlaylistItemView[]>(playlist.items);
  const [busy, setBusy] = useState<ItemAction>({});
  const [error, setError] = useState<string | null>(null);

  function setItemBusy(videoId: string, value: boolean): void {
    setBusy((prev) => ({ ...prev, [videoId]: value ? "busy" : "idle" }));
  }

  async function removeItem(videoId: string): Promise<void> {
    setItemBusy(videoId, true);
    setError(null);
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/items/${videoId}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setItems((prev) => prev.filter((it) => it.videoId !== videoId));
        return;
      }
      setError("Couldn't remove that video — please try again.");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setItemBusy(videoId, false);
    }
  }

  async function patchOrder(videoId: string, orderIndex: number): Promise<boolean> {
    try {
      const res = await fetch(`/api/playlists/${playlist.id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId, orderIndex }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function move(index: number, direction: -1 | 1): Promise<void> {
    const otherIndex = index + direction;
    const a = items[index];
    const b = items[otherIndex];
    if (!a || !b) return;

    setItemBusy(a.videoId, true);
    setItemBusy(b.videoId, true);
    setError(null);
    try {
      const [okA, okB] = await Promise.all([patchOrder(a.videoId, b.orderIndex), patchOrder(b.videoId, a.orderIndex)]);
      if (okA && okB) {
        setItems((prev) => {
          const next = prev.map((it) => {
            if (it.videoId === a.videoId) return { ...it, orderIndex: b.orderIndex };
            if (it.videoId === b.videoId) return { ...it, orderIndex: a.orderIndex };
            return it;
          });
          return [...next].sort((x, y) => x.orderIndex - y.orderIndex);
        });
      } else {
        setError("Couldn't reorder — please try again.");
      }
    } finally {
      setItemBusy(a.videoId, false);
      setItemBusy(b.videoId, false);
    }
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{playlist.name}</h1>
          {playlist.description && <p className="mt-1 text-muted-foreground">{playlist.description}</p>}
          {playlist.owner && (
            <p className="mt-1 text-sm text-muted-foreground">By {playlist.owner.name ?? "Deleted user"}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {playlist.isPublic ? "Public" : "Private"}
        </span>
      </div>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No videos in this playlist yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item, index) => (
            <li key={item.videoId} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
              <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded bg-muted">
                {item.thumbnailUrl && (
                  <Image src={item.thumbnailUrl} alt="" fill sizes="80px" className="object-cover" />
                )}
              </div>
              <Link href={`/videos/${item.videoId}/shadowing`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                {item.title}
              </Link>
              {isOwner && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void move(index, -1)}
                    disabled={index === 0 || busy[item.videoId] === "busy"}
                    aria-label={`Move up: ${item.title}`}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    Move up
                  </button>
                  <button
                    type="button"
                    onClick={() => void move(index, 1)}
                    disabled={index === items.length - 1 || busy[item.videoId] === "busy"}
                    aria-label={`Move down: ${item.title}`}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  >
                    Move down
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeItem(item.videoId)}
                    disabled={busy[item.videoId] === "busy"}
                    className="rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-danger/10 disabled:pointer-events-none disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
