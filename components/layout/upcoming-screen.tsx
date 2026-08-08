import { Container } from "@/components/ui/container";

/**
 * The honest empty state for a nav destination whose feature is not built.
 *
 * Spec §3.4: a nav row that 404s is worse than one that explains itself. This
 * states WHAT IS MISSING and WHAT WOULD FILL IT. It deliberately renders no
 * chart, meter or progress element — a placeholder visualisation would be
 * showing data the system does not have.
 *
 * Synchronous on purpose: every string arrives as a prop from the page, which
 * is already async and already holds a translator. Reading one string here
 * would make the component async, and React 18 + RTL cannot render an async
 * component — it would be untestable for no gain.
 */
export function UpcomingScreen({
  title,
  body,
  unlocks,
  unlocksLabel,
}: {
  title: string;
  body: string;
  unlocks: string;
  unlocksLabel: string;
}) {
  return (
    <Container className="py-3xl">
      <div className="max-w-[60ch]">
        <h1 className="text-title font-bold">{title}</h1>
        <p className="mt-md text-body text-muted-foreground">{body}</p>
        <div className="mt-xl rounded-md border border-border bg-card p-lg">
          <p className="text-caption font-semibold uppercase tracking-wide text-accent-strong">
            {unlocksLabel}
          </p>
          <p className="mt-xs text-body text-muted-foreground">{unlocks}</p>
        </div>
      </div>
    </Container>
  );
}
