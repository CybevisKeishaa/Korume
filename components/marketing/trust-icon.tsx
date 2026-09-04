/**
 * The three line icons §7's trust cards carry.
 *
 * Measured off `346:6275` (§7 is the band at y≈1443-1535 of 1821): every card
 * opens with a warm line glyph inside a thin circular ring, ⌀24 at the 864px
 * render against a 165px card. The three glyphs are a closed padlock, a shield
 * carrying a tick, and a person — one per claim, in card order.
 *
 * ⚠️ DECORATIVE, ALWAYS. Each claim's meaning lives in its own visible text
 * (`trust.cards.<key>.name` + `.body`); the glyph repeats nothing and carries
 * nothing. Hence `aria-hidden` + `focusable="false"` on every one. A screen
 * reader announcing "padlock" before "Your recordings stay private" would be
 * reading decoration aloud.
 *
 * There is no icon library in this repo (no `lucide-react` in package.json), so
 * these are hand-written inline SVG in the house style of
 * `problem-chip-icon.tsx`: one `viewBox="0 0 24 24"`, stroke drawing with
 * `currentColor`, round caps and joins. Size comes from the caller's token
 * classes, never from a width/height attribute.
 */

export type TrustKey = "recordings" | "data" | "ai";

/**
 * One glyph per claim. Written as elements rather than path strings so a glyph
 * can mix strokes with a solid dot without a second abstraction.
 *
 * `strokeWidth` is 1.4 for all three (the wrapper's), so no glyph reads heavier
 * than its neighbours in a row of three.
 */
const GLYPHS: Record<TrustKey, React.ReactNode> = {
  // A closed padlock — the shackle down, a keyhole in the body. "Encrypted,
  // and not open by default" is the whole claim, so the shackle is drawn shut.
  recordings: (
    <>
      <rect x="4.4" y="10.4" width="15.2" height="10.2" rx="2.6" />
      <path d="M8 10.4V7.9a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.4v2.4" />
      <circle cx="12" cy="14" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  // A shield carrying a tick — the reference's second glyph. The tick is the
  // point: the guarantee is kept, not merely offered.
  data: (
    <>
      <path d="M12 2.9 4.6 6v6.1c0 4.5 3.1 7.9 7.4 9 4.3-1.1 7.4-4.5 7.4-9V6L12 2.9Z" />
      <path d="M8.9 11.9 11.3 14.3 15.5 9.8" />
    </>
  ),
  // A person — head and shoulders. The consent in "we don't train on your data
  // without it" belongs to someone, and the reference draws that someone.
  ai: (
    <>
      <circle cx="12" cy="8.4" r="3.4" />
      <path d="M5.4 19.6a6.9 6.9 0 0 1 13.2 0" />
    </>
  ),
};

export interface TrustIconProps {
  claim: TrustKey;
  className?: string;
}

/**
 * `data-trust-icon` carries the key so a test can prove the three cards get
 * three DIFFERENT glyphs — the cheap failure here is one padlock rendered three
 * times, which a presence-only assertion would happily pass.
 */
export function TrustIcon({ claim, className }: TrustIconProps) {
  return (
    <svg
      data-trust-icon={claim}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {GLYPHS[claim]}
    </svg>
  );
}
