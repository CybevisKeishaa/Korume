import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";

/**
 * §9 — the sign-off (spec §11 ruling 4).
 *
 * ⚠️ FRAME ONLY. `346:6275` does not have this section; the frame `347:6277`
 * does, and the frame wins here (user ruling, 2026-08-26). Polishing it to the
 * reference's visual bar is allowed; changing its content is not. Its wording is
 * still the owner's and has already moved once — "A quieter way to keep going."
 * became "A gentler way to keep going." — which is why `signoff.test.tsx`
 * derives the heading from the catalog rather than retyping it.
 *
 * ## Why centred, and why that is not a second call to action
 *
 * ⚠️ This was built `stacked` first, and rendering it is what changed the
 * answer. §9 would have been the ONLY stacked section on the page — §2-§7 are
 * splits and §8 is centred — and `stacked` pairs with `text-display` (40px), so
 * a two-line sign-off ended up with a heading LARGER than the call to action
 * directly above it (28px). The page's quietest moment was shouting over its
 * loudest, and half the band was empty to the right of it. That is not
 * something the class names show; it needed the browser.
 *
 * The argument for keeping it stacked was that centring would make it read as a
 * second CTA. Measured against the render, that was the wrong lever: what makes
 * §8 a call to action is its BUTTONS, not its alignment. So §9 is centred and
 * carries no action at all — `signoff.test.tsx` pins the no-links, no-buttons
 * part, because a later "add a CTA here too" would split the one §8 asks for.
 *
 * ## NO MOTION
 *
 * Static half of spec §13, like §2-§8. Nothing here declares a transition,
 * keyframe or scroll trigger.
 */
export async function Signoff() {
  const t = await getTranslations("marketing");

  return (
    <Section id="signoff" heading={t("signoff.heading")} layout="centred">
      <p className="mx-auto max-w-xl text-body-lg text-muted-foreground">{t("signoff.body")}</p>
    </Section>
  );
}
