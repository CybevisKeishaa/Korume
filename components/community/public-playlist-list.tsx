"use client";

import { useState } from "react";
import { Link } from "@/lib/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { PublicPlaylistsPage } from "@/lib/playlist-types";

export interface PublicPlaylistListProps {
  initialPage: PublicPlaylistsPage;
  className?: string;
}

/** Read-only browse of public playlists (name, description, owner, item count), cursor-paginated. */
export function PublicPlaylistList({ initialPage, className }: PublicPlaylistListProps) {
  const [playlists, setPlaylists] = useState(initialPage.playlists);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadMore(): Promise<void> {
    if (!nextCursor) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      const res = await fetch(`/api/playlists/public?${params.toString()}`);
      if (!res.ok) {
        setError("Couldn't load more — please try again.");
        return;
      }
      const json = (await res.json()) as { data: PublicPlaylistsPage };
      setPlaylists((prev) => [...prev, ...json.data.playlists]);
      setNextCursor(json.data.nextCursor);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (playlists.length === 0) {
    return <p className={className ?? "text-sm text-muted-foreground"}>No public playlists yet.</p>;
  }

  return (
    <div className={className}>
      <ul className="space-y-3">
        {playlists.map((playlist) => (
          <li key={playlist.id} className="rounded-lg border border-border bg-card p-4">
            <Link href={`/playlists/${playlist.id}`} className="font-medium text-foreground hover:underline">
              {playlist.name}
            </Link>
            {playlist.description && <p className="mt-1 text-sm text-muted-foreground">{playlist.description}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              By {playlist.owner?.name ?? "Deleted user"} · {playlist.itemCount} {playlist.itemCount === 1 ? "video" : "videos"}
            </p>
          </li>
        ))}
      </ul>

      <div aria-live="polite">
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button type="button" variant="outline" size="sm" onClick={() => void loadMore()} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
