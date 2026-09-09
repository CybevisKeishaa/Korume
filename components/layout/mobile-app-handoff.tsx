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
    <main className="mobile-app-handoff" aria-labelledby="mobile-app-handoff-title">
      <div className="mx-auto flex min-h-[100svh] max-w-md flex-col justify-center px-6 py-12">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 id="mobile-app-handoff-title" className="mt-4 font-display text-4xl font-semibold text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{body}</p>
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
