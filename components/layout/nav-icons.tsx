import type { LucideIcon } from "lucide-react";
import { AudioLines, Bookmark, BookOpenText, Clapperboard, GraduationCap, Layers, LayoutDashboard, ListVideo, MessagesSquare, Route, Sparkles } from "lucide-react";

/** One icon per nav destination key (plan P4: kanji is the 文 glyph — Korume DNA). */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard, lessons: Clapperboard, grammar: BookOpenText, speaking: MessagesSquare,
  jlpt: GraduationCap, "pronunciation-library": AudioLines, review: Layers, mining: Bookmark,
  playlists: ListVideo, roadmap: Route, "companion-home": Sparkles,
};

export function NavIcon({ navKey }: { navKey: string }) {
  if (navKey === "kanji") return <span aria-hidden="true" className="app-nav__glyph font-jp">文</span>;
  const Icon = ICONS[navKey] ?? LayoutDashboard;
  return <Icon aria-hidden="true" className="app-nav__icon" strokeWidth={1.75} />;
}
