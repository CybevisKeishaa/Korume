"use client";

import { useTranslations } from "@/lib/i18n";
import { MascotPose } from "@/components/mascot/mascot-pose";
import { Link } from "@/lib/i18n/navigation";
import { buttonStyles, Button } from "@/components/ui/button";
import { BackButton } from "./back-button";
import { RequestedPath } from "./requested-path";

export function RouteErrorPanel({ mode, onRetry }: { mode: "in-shell" | "standalone"; onRetry: () => void }) {
  const t = useTranslations("errors");
  const standalone = mode === "standalone";

  return (
    <section
      {...(standalone ? { "data-density": "reference" } : {})}
      className={`flex w-full flex-col items-center justify-center bg-background px-xl py-xl text-center ${standalone ? "min-h-dvh" : "min-h-full"}`}
    >
      <div className="flex w-full max-w-2xl flex-col items-center gap-lg">
        <div className="space-y-sm">
          <p className="text-caption font-medium text-primary">{t("routeError.eyebrow")}</p>
          <h1 className="font-display text-display font-bold text-foreground">{t("routeError.heading")}</h1>
          <p className="text-body-lg text-muted-foreground">{t("routeError.body")}</p>
        </div>
        <div className="flex w-full flex-col items-center gap-md rounded-lg border border-border bg-card px-xl py-xl">
          <MascotPose pose="route-error" size="md" />
          <p className="text-body text-foreground">{t("routeError.scene")}</p>
          <div className="flex flex-wrap justify-center gap-sm">
            <Button size="lg" onClick={onRetry}>{t("routeError.retry")}</Button>
            <Link href="/dashboard" className={buttonStyles({ size: "lg", variant: "outline" })}>
              {t("routeError.dashboard")}
            </Link>
            <BackButton className="text-body font-medium text-muted-foreground hover:text-foreground">
              {t("routeError.goBack")}
            </BackButton>
          </div>
        </div>
        <p className="text-body font-medium text-foreground">{t("routeError.reassurance")}</p>
        <RequestedPath label={t("routeError.requestedPath")} />
      </div>
    </section>
  );
}
