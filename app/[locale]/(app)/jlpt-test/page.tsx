import { redirect } from "@/lib/i18n/navigation";
import { getLocale } from "@/lib/i18n/server";

/** Old placeholder route — the JLPT test engine now lives at `/jlpt` (Layer 5). */
export default async function JlptTestPageRedirect() {
  const locale = await getLocale();
  redirect({ href: "/jlpt", locale });
}
