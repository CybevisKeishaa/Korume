import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { HeroVideoCard } from "./hero-video-card";

/**
 * §1 (spec §2). Built to the reference's composition, not the frame's
 * (task 4 brief step 1): copy and two CTAs on the left, the app-preview
 * card (`HeroVideoCard`) on the right. The hero is the page's `<h1>`.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
export async function Hero() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="hero"
      eyebrow={t("hero.eyebrow")}
      heading={t("hero.heading")}
      headingLevel={1}
      scrollProgress
    >
      <div className="grid gap-xl lg:grid-cols-2 lg:items-center">
        <div>
          <p className="max-w-xl text-body-lg text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-lg flex flex-wrap gap-sm">
            <Link href="/register" className={buttonStyles({ size: "lg" })}>
              {t("hero.cta")}
            </Link>
            <Link href="/shadowing/explore" className={buttonStyles({ size: "lg", variant: "outline" })}>
              {t("hero.ctaSecondary")}
            </Link>
          </div>
          <p className="mt-md text-caption text-muted-foreground">{t("hero.note")}</p>
        </div>

        <HeroVideoCard t={t} />
      </div>
    </Section>
  );
}
