/**
 * Client-safe mirror of `lib/data/playlists.ts`'s shapes (that module is
 * `server-only`) — same JSON returned by `GET /api/playlists`,
 * `GET /api/playlists/[id]`, and `GET /api/playlists/public`.
 */
export interface PlaylistOwner {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface PlaylistListItem {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  itemCount: number;
}

export interface PlaylistItemView {
  videoId: string;
  orderIndex: number;
  title: string;
  thumbnailUrl: string | null;
}

export interface PlaylistDetail {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  createdAt: string;
  owner: PlaylistOwner | null;
  items: PlaylistItemView[];
}

export interface PublicPlaylistListItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  owner: PlaylistOwner | null;
  itemCount: number;
}

export interface PublicPlaylistsPage {
  playlists: PublicPlaylistListItem[];
  nextCursor: string | null;
}
