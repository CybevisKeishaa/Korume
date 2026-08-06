import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export async function SiteHeader() {
  const t = await getTranslations("marketing");
  const tCommon = await getTranslations("common");

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-jp text-lg font-bold">
          {tCommon("appNameJp")}
        </Link>
        <nav aria-label={t("header.ariaLabel")} className="flex items-center gap-2">
          <Link
            href="/login"
            className={buttonStyles({ variant: "ghost", size: "sm" })}
          >
            {tCommon("auth.signIn")}
          </Link>
          <Link href="/register" className={buttonStyles({ size: "sm" })}>
            {t("header.cta")}
          </Link>
        </nav>
      </Container>
    </header>
  );
}
