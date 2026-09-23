/**
 * The line glyphs each settings row opens with (spec §5's `SettingsRow` icon).
 *
 * ⚠️ DECORATIVE, ALWAYS. Every row's meaning lives in its own visible label
 * and description; the glyph repeats them and carries nothing of its own.
 * Hence `aria-hidden` and `focusable="false"` — a screen reader announcing
 * "microphone" before "Microphone" is reading decoration aloud.
 *
 * There is no icon library in this repo (no `lucide-react` in `package.json`),
 * and nothing under `components/settings/` had an icon before this file — the
 * plan's "an icon from the repo's icon set used elsewhere in
 * `components/settings`" describes something that does not exist. These are
 * hand-written inline SVG in the established house style of
 * `components/marketing/trust-icon.tsx`: one `viewBox="0 0 24 24"`, stroke
 * drawing in `currentColor`, round caps and joins, `strokeWidth` on the
 * wrapper so no glyph reads heavier than its neighbours. Size comes from the
 * caller's token classes, never from a width/height attribute.
 */

export type SettingsIconKey =
  | "language"
  | "goal"
  | "schedule"
  | "frequency"
  | "difficulty"
  | "scale"
  | "motion"
  | "microphone"
  | "camera"
  | "training"
  | "export"
  | "history";

const GLYPHS: Record<SettingsIconKey, React.ReactNode> = {
  // A globe: the meridian and the equator, which is as much detail as reads at 20px.
  language: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M3.8 12h16.4" />
      <path d="M12 3.8c2.1 2.3 3.2 5.1 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.1-3.2-8.2S9.9 6.1 12 3.8Z" />
    </>
  ),
  // A target — the daily goal is a number you aim at and hit.
  goal: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  // A calendar: the days of the week are what this control picks.
  schedule: (
    <>
      <rect x="3.8" y="5.4" width="16.4" height="14.8" rx="2.4" />
      <path d="M3.8 10h16.4" />
      <path d="M8.4 3.8v3.2M15.6 3.8v3.2" />
    </>
  ),
  // Arrows circling back — how often a card comes round again.
  frequency: (
    <>
      <path d="M20 12a8 8 0 0 1-13.7 5.6" />
      <path d="M4 12a8 8 0 0 1 13.7-5.6" />
      <path d="M17.4 3.2v3.4h-3.4M6.6 20.8v-3.4h3.4" />
    </>
  ),
  // A rising slope — the difficulty band the engine aims at.
  difficulty: (
    <>
      <path d="M4 19.2h16" />
      <path d="M4 19.2 9.6 12l3.8 3.4 6.2-8" />
      <path d="M19.6 7.4h-3.4M19.6 7.4v3.4" />
    </>
  ),
  // Two letters at different sizes — the whole point of Display Scale.
  scale: (
    <>
      <path d="M3.4 16.6 7.4 6.6l4 10" />
      <path d="M4.9 13.2h5" />
      <path d="M14.4 16.6l2.8-7 2.8 7" />
      <path d="M15.4 14.1h3.6" />
    </>
  ),
  // A stilled wave: motion reduced to a flat line at its centre.
  motion: (
    <>
      <path d="M3.6 12h16.8" />
      <path d="M7 8.4v7.2M11 6.6v10.8" />
      <path d="M15 9.6v4.8M19 10.8v2.4" />
    </>
  ),
  microphone: (
    <>
      <rect x="9.2" y="3.2" width="5.6" height="11" rx="2.8" />
      <path d="M5.8 11.4a6.2 6.2 0 0 0 12.4 0" />
      <path d="M12 17.6v3.2" />
    </>
  ),
  camera: (
    <>
      <rect x="3.4" y="6.6" width="12.4" height="10.8" rx="2.4" />
      <path d="M15.8 11.2 20.6 8.4v7.2l-4.8-2.8Z" />
    </>
  ),
  // A spark over a chip — "help improve our models", not a live switch.
  training: (
    <>
      <rect x="6.6" y="6.6" width="10.8" height="10.8" rx="2.4" />
      <path d="M9.8 3.4v3.2M14.2 3.4v3.2M9.8 17.4v3.2M14.2 17.4v3.2" />
      <path d="M3.4 9.8h3.2M3.4 14.2h3.2M17.4 9.8h3.2M17.4 14.2h3.2" />
    </>
  ),
  // A tray with an arrow leaving it — the file goes out to you.
  export: (
    <>
      <path d="M12 3.6v10.2" />
      <path d="M8.2 10.4 12 14.2l3.8-3.8" />
      <path d="M4.4 16v2.2a2.2 2.2 0 0 0 2.2 2.2h10.8a2.2 2.2 0 0 0 2.2-2.2V16" />
    </>
  ),
  // A clock with a hand — the learning history is a record over time.
  history: (
    <>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.4V12l3.2 2" />
    </>
  ),
};

export function SettingsIcon({
  name,
  className,
}: {
  name: SettingsIconKey;
  className?: string;
}) {
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
      className={className ? `size-icon-sm ${className}` : "size-icon-sm"}
    >
      {GLYPHS[name]}
    </svg>
  );
}
