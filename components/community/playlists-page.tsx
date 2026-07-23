"use client";

import { useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlaylistComposer } from "./playlist-composer";
import { PlaylistList } from "./playlist-list";
import { PublicPlaylistList } from "./public-playlist-list";
import type { PlaylistListItem, PublicPlaylistsPage } from "@/lib/playlist-types";

export interface PlaylistsPageProps {
  initialMine: PlaylistListItem[];
  initialPublic: PublicPlaylistsPage;
}

type Tab = "mine" | "public";

/** "My playlists" (create/rename/delete/public toggle) vs. "Browse public" tabs for /playlists. */
export function PlaylistsPage({ initialMine, initialPublic }: PlaylistsPageProps) {
  const t = useTranslations("playlists");
  const tCommon = useTranslations("common");
  const [tab, setTab] = useState<Tab>("mine");
  const [mine, setMine] = useState(initialMine);
  const [composerOpen, setComposerOpen] = useState(false);

  function handleCreated(result: { id: string; createdAt: string }): void {
    setComposerOpen(false);
    setMine((prev) => [
      { id: result.id, name: "", description: null, isPublic: false, createdAt: result.createdAt, itemCount: 0 },
      ...prev,
    ]);
    // The create response only echoes { id, createdAt } — refresh from the
    // list endpoint to get the real name/description rather than guessing.
    void refreshMine();
  }

  async function refreshMine(): Promise<void> {
    try {
      const res = await fetch("/api/playlists");
      if (!res.ok) return;
      const json = (await res.json()) as { data: PlaylistListItem[] };
      setMine(json.data);
    } catch {
      // Keep the optimistic placeholder — the list still functions, just with a blank name until next reload.
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={t("tabs.ariaLabel")} className="flex gap-2">
        <button
          type="button"
          role="tab"
          id="playlists-tab-mine"
          aria-selected={tab === "mine"}
          aria-controls="playlists-panel-mine"
          onClick={() => setTab("mine")}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            tab === "mine" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {t("tabs.mine")}
        </button>
        <button
          type="button"
          role="tab"
          id="playlists-tab-public"
          aria-selected={tab === "public"}
          aria-controls="playlists-panel-public"
          onClick={() => setTab("public")}
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            tab === "public" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          {t("tabs.public")}
        </button>
      </div>

      <div role="tabpanel" id="playlists-panel-mine" aria-labelledby="playlists-tab-mine" hidden={tab !== "mine"} className="mt-4">
        <div className="mb-4 flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={() => setComposerOpen((v) => !v)}>
            {composerOpen ? tCommon("actions.cancel") : t("tabs.newPlaylist")}
          </Button>
        </div>
        {composerOpen && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <PlaylistComposer onCreated={handleCreated} />
          </div>
        )}
        <PlaylistList playlists={mine} />
      </div>

      <div role="tabpanel" id="playlists-panel-public" aria-labelledby="playlists-tab-public" hidden={tab !== "public"} className="mt-4">
        <PublicPlaylistList initialPage={initialPublic} />
      </div>
    </div>
  );
}
