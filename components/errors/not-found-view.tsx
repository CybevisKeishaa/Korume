import { Link } from "@/lib/i18n/navigation";
import { MascotPose } from "@/components/mascot/mascot-pose";
import { buttonStyles } from "@/components/ui/button";
import { BackButton } from "./back-button";
import { RequestedPath } from "./requested-path";

export function NotFoundView({
  backLabel,
  body,
  eyebrow,
  goBackLabel,
  goHomeLabel,
  heading,
  requestedPathLabel,
  wordmark,
}: {
  backLabel: string;
  body: string;
  eyebrow: string;
  goBackLabel: string;
  goHomeLabel: string;
  heading: string;
  requestedPathLabel: string;
  wordmark: string;
}) {
  return (
    <main data-density="reference" className="flex min-h-dvh flex-col bg-background px-xl py-xl">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label={wordmark} className="font-display text-heading font-bold">
          {wordmark}
        </Link>
        <BackButton className="text-body text-muted-foreground hover:text-foreground">
          {backLabel}
        </BackButton>
      </header>
      <section className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-lg text-center">
        <p className="text-caption font-medium text-primary">{eyebrow}</p>
        <div className="space-y-sm">
          <h1 className="font-display text-display font-bold text-foreground">{heading}</h1>
          <p className="text-body-lg text-muted-foreground">{body}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-sm">
          <Link href="/" className={buttonStyles({ size: "lg" })}>
            {goHomeLabel}
          </Link>
          <BackButton className="text-body font-medium text-muted-foreground hover:text-foreground">
            {goBackLabel}
          </BackButton>
        </div>
        <RequestedPath label={requestedPathLabel} />
        <MascotPose pose="not-found" size="md" />
      </section>
    </main>
  );
}
