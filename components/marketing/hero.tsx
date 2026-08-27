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
 * "Save Sentence", visible in the reference's right rail, is not rendered:
 * the frame (347:6313) carries no matching text node and `hero.*` (Task 1,
 * derived from the frame) has no key for it. Building it would mean
 * inventing copy the catalog does not support — the same "build what the
 * catalog supports" call Ruling 4 makes for the transcript line count.
 */
export async function Hero() {
  const t = await getTranslations("marketing");
  // Awaited explicitly, not rendered as `<HeroVideoCard />`: Next.js's RSC
  // renderer resolves an async component used as JSX automatically, but the
  // plain react-dom renderer this repo's Vitest/jsdom tests run under does
  // not, and throws ("Objects are not valid as a React child ([object
  // Promise])") the moment a nested async component appears in the tree.
  // Awaiting here yields an already-resolved element, which is valid JSX
  // under both renderers.
  const videoCard = await HeroVideoCard();

  return (
    <Section id="hero" eyebrow={t("hero.eyebrow")} heading={t("hero.heading")} headingLevel={1}>
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

        {videoCard}
      </div>
    </Section>
  );
}
