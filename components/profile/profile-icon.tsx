/**
 * Line glyphs for the profile rows. DECORATIVE, ALWAYS: the row label carries the meaning, so the glyph is
 * `aria-hidden`. Same house style as `components/settings/settings-icon.tsx` (inline SVG, 24 viewBox,
 * `currentColor` stroke, round caps; size from the caller's token class, never width/height).
 */
export type ProfileIconKey =
  | "country" | "timeZone" | "learningSince" | "jlpt" | "nativeLanguage" | "interface" | "subtitle"
  | "streak" | "level" | "xp" | "video" | "words" | "hours" | "camera";

const GLYPHS: Record<ProfileIconKey, React.ReactNode> = {
  // A map pin.
  country: (
    <>
      <path d="M12 20.4c-3.4-3.6-5.6-6.5-5.6-9.4a5.6 5.6 0 0 1 11.2 0c0 2.9-2.2 5.8-5.6 9.4Z" />
      <circle cx="12" cy="11" r="2" />
    </>
  ),
  // A globe.
  timeZone: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c2.1 2.3 3.2 5.1 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.1-3.2-8.2S9.9 6.1 12 3.8Z" />
    </>
  ),
  // A clock.
  learningSince: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3 2" />
    </>
  ),
  // A trophy.
  jlpt: (
    <>
      <path d="M8 4.4h8v5a4 4 0 0 1-8 0v-5Z" />
      <path d="M8 6H4.8c0 2.6 1 3.8 3.2 4M16 6h3.2c0 2.6-1 3.8-3.2 4" />
      <path d="M12 13.4v3.2M8.6 19.6h6.8M9.8 16.6h4.4" />
    </>
  ),
  // Two letters, one translating into the other.
  nativeLanguage: (
    <>
      <path d="M3.6 6.4h9M8.1 4.4v2M5.2 6.4c.6 3 2.4 5.2 5.2 6.4M11.4 6.4c-.6 3-2.6 5.2-5.8 6.6" />
      <path d="M12.6 19.6l3.6-8.4 3.6 8.4M13.8 16.8h4.8" />
    </>
  ),
  // A window: the interface.
  interface: (
    <>
      <rect x="3.6" y="5" width="16.8" height="14" rx="2.4" />
      <path d="M3.6 9.4h16.8" />
    </>
  ),
  // An open book.
  subtitle: (
    <>
      <path d="M12 6.6v12.2" />
      <path d="M12 6.6C10.6 5.2 8 4.8 4.4 5.2v12.2c3.6-.4 6.2 0 7.6 1.4 1.4-1.4 4-1.8 7.6-1.4V5.2c-3.6-.4-6.2 0-7.6 1.4Z" />
    </>
  ),
  // A flame.
  streak: (
    <path d="M12 3.6c.4 3-2.8 4.6-2.8 8.2 0 1.2.6 2 1.4 2.5-.1-1.2.5-2 1.4-2.8.2 1.5 1.6 2 1.6 3.6 0 1.7-1.4 2.9-2.6 2.9-2.8 0-4.8-2.2-4.8-5C6.2 8.2 10.8 6.8 12 3.6Z" />
  ),
  // A four-point sparkle.
  level: <path d="M12 3.6c.6 4.2 2.2 5.8 6.4 6.4-4.2.6-5.8 2.2-6.4 6.4-.6-4.2-2.2-5.8-6.4-6.4 4.2-.6 5.8-2.2 6.4-6.4Z" />,
  // A ribbon badge.
  xp: (
    <>
      <circle cx="12" cy="9.6" r="4.6" />
      <path d="M9 13.6 7.6 20l4.4-2.2 4.4 2.2-1.4-6.4" />
    </>
  ),
  // A clapperboard.
  video: (
    <>
      <rect x="3.6" y="9.4" width="16.8" height="10" rx="2" />
      <path d="M3.6 9.4 5.4 5l12.6 3.2.4 1.2M8.4 6.1l1.4 3.1M13 7.3l1.4 3" />
    </>
  ),
  words: (
    <>
      <path d="M12 6.6v12.2" />
      <path d="M12 6.6C10.6 5.2 8 4.8 4.4 5.2v12.2c3.6-.4 6.2 0 7.6 1.4 1.4-1.4 4-1.8 7.6-1.4V5.2c-3.6-.4-6.2 0-7.6 1.4Z" />
    </>
  ),
  hours: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3 2" />
    </>
  ),
  // A still camera.
  camera: (
    <>
      <path d="M4 8.2a1.8 1.8 0 0 1 1.8-1.8h2l1.2-1.8h6l1.2 1.8h2A1.8 1.8 0 0 1 20 8.2v9a1.8 1.8 0 0 1-1.8 1.8H5.8A1.8 1.8 0 0 1 4 17.2v-9Z" />
      <circle cx="12" cy="12.6" r="3.2" />
    </>
  ),
};

export function ProfileIcon({ name, className }: { name: ProfileIconKey; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-profile-icon={name}
      className={className ? `size-icon-sm ${className}` : "size-icon-sm"}
    >
      {GLYPHS[name]}
    </svg>
  );
}
