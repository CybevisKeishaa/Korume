import { Link } from "@/lib/i18n/navigation";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getTranslations } from "@/lib/i18n/server";

export default async function LandingPage() {
  const t = await getTranslations("marketing");
  const tCommon = await getTranslations("common");
  return (
    <main>
      <Container className="flex min-h-[80vh] flex-col items-center justify-center py-24 text-center">
        <p className="mb-4 font-jp text-sm tracking-widest text-primary-strong">
          {tCommon("appNameJp")}
        </p>
        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight sm:text-6xl">
          {t("hero.heading")}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          {t("hero.subtitle")}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className={buttonStyles({ size: "lg" })}>
            {t("hero.cta")}
          </Link>
          <Link
            href="/login"
            className={buttonStyles({ size: "lg", variant: "outline" })}
          >
            {tCommon("auth.signIn")}
          </Link>
        </div>
      </Container>
    </main>
  );
}
