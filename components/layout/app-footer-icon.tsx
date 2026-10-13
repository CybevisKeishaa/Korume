/** Decorative glyphs for `AppFooter` (Figma 203:13813). ALWAYS `aria-hidden`: the adjacent label names the control. */
export type AppFooterIconKey = "mail" | "send" | "arrowUpRight" | "sparkles" | "discord" | "facebook" | "tiktok";

const GLYPHS: Record<AppFooterIconKey, React.ReactNode> = {
  mail: <><rect width="20" height="16" x="2" y="4" rx="2" /><path d="M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  send: <><path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.63l-19 6.5a.5.5 0 0 0-.03.93l7.93 3.18a2 2 0 0 1 1.11 1.11Z" /><path d="M21.85 2.15L10.91 13.09" /></>,
  arrowUpRight: <><path d="M7 7h10v10" /><path d="M7 17L17 7" /></>,
  // Figma 203:13910/13915/13920 are these Lucide glyphs (message-circle, facebook, music-2) drawn at 13px.
  discord: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  tiktok: <><circle cx="8" cy="18" r="4" /><path d="M12 18V2l7 4" /></>,
  sparkles: <><path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.13 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.13a.5.5 0 0 1-.96 0Z" /><path d="M20 3v4" /><path d="M22 5h-4" /></>,
};

export function AppFooterIcon({ name, className }: { name: AppFooterIconKey; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" className={className}>
      {GLYPHS[name]}
    </svg>
  );
}
