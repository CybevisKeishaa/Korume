/**
 * Line glyphs for the Dashboard, converted from the Figma `111:515` exports onto a 24 viewBox (each export's
 * inset box mapped back to its 24-unit grid; they land on the Lucide geometry the design used). DECORATIVE,
 * ALWAYS: the adjacent label carries the meaning, so the glyph is `aria-hidden`. House style as
 * `components/profile/profile-icon.tsx`: `currentColor` stroke, round caps, size from the caller's class.
 */
export type DashboardIconKey =
  | "search" | "flame" | "play" | "chevron" | "headphones" | "book" | "volume" | "trend" | "trophy"
  | "sparkles" | "wand" | "library" | "mountain" | "message" | "clapper";

const GLYPHS: Record<DashboardIconKey, React.ReactNode> = {
  search: <><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z" /><path d="M21 21l-4.3-4.3" /></>,
  flame: <path fill="currentColor" d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z" />,
  play: <path fill="currentColor" d="M6 3l14 9-14 9V3Z" />,
  chevron: <path d="M9 18l6-6-6-6" />,
  headphones: <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />,
  book: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3Z" /></>,
  volume: <><path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.41 7.59A2 2 0 0 1 5 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2a2 2 0 0 1 1.41.59l3.39 3.39a.7.7 0 0 0 1.2-.5Z" /><path d="M16 9a5 5 0 0 1 0 6" /><path d="M19.36 18.36a9 9 0 0 0 0-12.72" /></>,
  trend: <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
  sparkles: <><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0Z" /><path d="M20 3v4" /><path d="M22 5h-4" /><path d="M4 17v2" /><path d="M5 18H3" /></>,
  wand: <><path d="M21.64 3.64l-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" /><path d="M14 7l3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" /></>,
  library: <><path d="M16 6l4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></>,
  mountain: <path d="M8 3l4 8 5-5 5 15H2L8 3Z" />,
  message: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  clapper: <><path d="M20.2 6L3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z" /><path d="M6.2 5.3l3.1 3.9" /><path d="M12.4 3.4l3.1 4" /><path d="M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></>,
};

export function DashboardIcon({ name, className }: { name: DashboardIconKey; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      {GLYPHS[name]}
    </svg>
  );
}
