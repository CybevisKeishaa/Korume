import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-stores";

export interface MobileAppHandoffProps {
  eyebrow: string;
  title: string;
  body: string;
  appStoreLabel: string;
  playStoreLabel: string;
}

export function MobileAppHandoff({
  eyebrow,
  title,
  body,
  appStoreLabel,
  playStoreLabel,
}: MobileAppHandoffProps) {
  return (
    <main data-density="reference" className="mobile-app-handoff" aria-labelledby="mobile-app-handoff-title">
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-6 py-12">
        {/* `text-body`, not `caption`: this site held Tailwind's default small
            rung, which IS `--text-body` — both 14px. This screen is the
            below-1024 handoff and must render what it did before the density
            rule. It sits in the locale layout, above every route group, and the
            unit holds at its 0.889 floor below 1280 — so `data-density` on the
            main is what keeps it at 1.0, not the viewport. Re-roling this
            eyebrow down a rung is a separate design decision. (The rung names
            are spelled out in the guard, not here: it is a text scan and
            cannot tell prose from a class list.) */}
        <p className="text-body font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 id="mobile-app-handoff-title" className="mt-4 font-display text-4xl font-semibold text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-body-lg leading-7 text-muted-foreground">{body}</p>
        <div className="mt-8 flex flex-col gap-3">
          <a
            className="rounded-lg bg-primary px-5 py-3 text-center font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href={APP_STORE_URL}
            rel="noreferrer"
            target="_blank"
          >
            {appStoreLabel}
          </a>
          <a
            className="rounded-lg border border-border px-5 py-3 text-center font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            href={PLAY_STORE_URL}
            rel="noreferrer"
            target="_blank"
          >
            {playStoreLabel}
          </a>
        </div>
      </div>
    </main>
  );
}
