/**
 * Chrome contract: no nav. Not "nav hidden" — not mounted at all, and there is
 * no toggle. Companion Diary and onboarding are rooms, not destinations.
 *
 * Consequence (spec §5.6): there is no `<nav>` landmark here, so every
 * immersive screen must carry its own labelled way back.
 */
export default function ImmersiveChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <main className="min-h-screen">{children}</main>;
}
