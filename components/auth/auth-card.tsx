import type { ReactNode } from "react";

export function AuthCard({
  eyebrow,
  heading,
  subtitle,
  children,
}: {
  eyebrow: string;
  heading: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-xl shadow-raised">
      <p className="text-caption uppercase tracking-wide text-primary-strong">{eyebrow}</p>
      <h1 className="mt-sm font-display text-title text-foreground">{heading}</h1>
      <p className="mt-xs text-body text-muted-foreground">{subtitle}</p>
      <div className="mt-lg">{children}</div>
    </section>
  );
}
