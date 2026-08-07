import { ReduceMotionToggle } from "@/components/ui/reduce-motion-toggle";

/**
 * Chrome contract: no nav, but not bare either — back affordance (per-screen,
 * see journal-view.tsx) + a reduce-motion control (CLAUDE.md §2 rule 4 requires
 * a global toggle; rule 5 requires full keyboard reach, and immersive is where
 * motion is heaviest, so a learner here cannot be left without one). Not
 * "nav hidden" — there is still no `<nav>` toggle, and no `<nav>` landmark at
 * all. Companion Diary and onboarding are rooms, not destinations, so the
 * control cluster stays a quiet corner, not a dashboard.
 *
 * Consequence (spec §5.6): there is no `<nav>` landmark here, so every
 * immersive screen must carry its own labelled way back.
 */
export default function ImmersiveChromeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen">
      <div className="flex justify-end p-4 text-muted-foreground">
        <ReduceMotionToggle />
      </div>
      {children}
    </main>
  );
}
