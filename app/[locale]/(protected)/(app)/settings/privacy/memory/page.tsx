import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { Link } from "@/lib/i18n/navigation";
import { MemoryEraseForm } from "@/components/settings/memory-erase-form";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "settings" });
  return { title: t("memoryErase.title") };
}

/**
 * The destination of the Danger Zone's `Delete Korume Memory` row — the
 * confirmation surface for Erase Korume Memory (spec §4.8).
 *
 * This page replaced an `UpcomingScreen` placeholder. That placeholder was
 * correct while the behaviour did not exist (spec §13's ruling: the row ships
 * now, pointing at an honest "not built yet" surface rather than a bare 404),
 * and it is obsolete now that it does. Both locales' `upcoming.json` lost
 * their `privacyMemory` block in the same commit, so nothing is left claiming
 * this feature is unbuilt.
 *
 * Both lists below come from spec §4.8's table, in plain language rather than
 * table form: what a user needs before confirming is not an inventory of
 * tables but the two sentences that tell them their studying survives. The
 * erased/kept split is the whole decision — `finality` states that the erase
 * takes effect on confirm and has no undo, which is true HERE and is not true
 * of the account-deletion flows on the sibling page (those have a 7-day
 * cancellation window). The two must never borrow each other's copy.
 *
 * A server component: it holds no state. `MemoryEraseForm` is the only client
 * half, and there is no server read to do — the page renders the same for
 * every user, and whether they have any memory to erase is not worth a query
 * the erase itself would make redundant.
 */
export default async function PrivacyMemoryPage() {
  const t = await getTranslations("settings");
  return (
    <Container className="py-3xl">
      <div className="max-w-[60ch]">
        <nav aria-label={t("memoryErase.title")} className="text-caption text-muted-foreground">
          <Link href="/settings" className="hover:text-foreground">
            {t("privacy.breadcrumbSettings")}
          </Link>
          <span aria-hidden="true"> / </span>
          <Link href="/settings/privacy" className="hover:text-foreground">
            {t("privacy.breadcrumbPrivacy")}
          </Link>
          <span aria-hidden="true"> / </span>
          <span>{t("memoryErase.title")}</span>
        </nav>

        <p className="mt-lg text-caption font-semibold uppercase tracking-wide text-danger-strong">
          {t("memoryErase.eyebrow")}
        </p>
        <h1 className="mt-xs text-title font-bold">{t("memoryErase.title")}</h1>
        <p className="mt-xs text-body text-muted-foreground">{t("memoryErase.subtitle")}</p>

        <section className="mt-xl">
          <h2 className="text-body font-semibold">{t("memoryErase.erasedHeading")}</h2>
          <ul className="mt-sm list-disc space-y-2xs ps-lg text-caption text-muted-foreground">
            <li>{t("memoryErase.erasedDiary")}</li>
            <li>{t("memoryErase.erasedConversations")}</li>
          </ul>
        </section>

        <section className="mt-lg">
          <h2 className="text-body font-semibold">{t("memoryErase.keptHeading")}</h2>
          <ul className="mt-sm list-disc space-y-2xs ps-lg text-caption text-muted-foreground">
            <li>{t("memoryErase.keptProgress")}</li>
            <li>{t("memoryErase.keptPractice")}</li>
          </ul>
        </section>

        <p className="mt-lg rounded-md border border-danger/40 bg-danger/5 p-md text-caption text-muted-foreground">
          {t("memoryErase.finality")}
        </p>

        <MemoryEraseForm />
      </div>
    </Container>
  );
}
