/**
 * The player's control glyphs (Figma `105:3604` control bar): inline SVG like the rest of the repo
 * (`components/layout/site-menu-icon.tsx`) — there is no icon package. One 24 viewBox, stroke = currentColor,
 * so colour stays on the button that uses the glyph.
 */
function Glyph({ className, children, filled = false }: { className?: string; children: React.ReactNode; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

type GlyphProps = { className?: string };

export const PlayGlyph = ({ className }: GlyphProps) => <Glyph className={className} filled><path d="M7 4.5v15l12-7.5z" /></Glyph>;
export const PauseGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className} filled><path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" /></Glyph>
);
export const PreviousGlyph = ({ className }: GlyphProps) => <Glyph className={className}><path d="M18 19 8 12l10-7zM6 5v14" /></Glyph>;
export const NextGlyph = ({ className }: GlyphProps) => <Glyph className={className}><path d="m6 19 10-7L6 5zM18 5v14" /></Glyph>;
/** ↶ with a small "5": node `105:3621`. */
export const RewindFiveGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
    <path d="M14 9h-3l-.4 3.2a2.4 2.4 0 1 1 .4 3.3" strokeWidth={1.6} />
  </Glyph>
);
export const VolumeGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></Glyph>
);
export const MutedGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><path d="M11 5 6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6" /></Glyph>
);
/** Subtitle overlay toggle: node `105:3640`. */
export const SubtitlesGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 15h4M14 15h3M7 11h10" /></Glyph>
);
export const SubtitlesOffGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><path d="M10.5 5H19a2 2 0 0 1 2 2v8.5M17 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2M7 15h4M3 3l18 18" /></Glyph>
);
export const FullscreenGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" /></Glyph>
);
/** Live Sentence hide/reveal-the-Japanese toggle (Figma `105:3663`). */
export const HideTextGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><path d="M9.9 5.2A10 10 0 0 1 22 12a14 14 0 0 1-2.2 3M6.6 6.6A14 14 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6M3 3l18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Glyph>
);
export const ShowTextGlyph = ({ className }: GlyphProps) => (
  <Glyph className={className}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Glyph>
);
