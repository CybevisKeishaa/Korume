import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "@/lib/i18n";
import { isCountryCode } from "@/lib/profile/countries";
import { NATIVE_LANGUAGES } from "@/lib/profile/languages";
import type { ProfileView } from "@/lib/profile/view";
import { Link } from "@/lib/i18n/navigation";
import { CARD } from "./card-styles";
import { ProfileIcon, type ProfileIconKey } from "./profile-icon";

export type ProfileIdentityModel = Pick<
  ProfileView["identity"],
  "displayName" | "username" | "bio" | "country" | "nativeLanguage" | "targetJlptLevel" | "timeZone" | "avatarUrl" | "firstKnownLearningAt" | "subtitle"
>;

const JLPT = ["N1", "N2", "N3", "N4", "N5"];

/** "UTC+7"; null for a zone this runtime does not recognise. */
function offsetLabel(timeZone: string): string | null {
  try {
    const part = new Intl.DateTimeFormat("en", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    return part ? part.value.replace(/^GMT/, "UTC") : null;
  } catch {
    return null;
  }
}

function displayName(type: "region" | "language", locale: string, code: string): string | null {
  try {
    return new Intl.DisplayNames([locale], { type }).of(code) ?? null;
  } catch {
    return null;
  }
}

type Row = { icon: ProfileIconKey; label: string; value: string };

export function IdentityCard({ identity, variant, actions }: { identity: ProfileIdentityModel; variant: "page" | "preview"; actions?: ReactNode }) {
  const t = useTranslations("profile");
  const locale = useLocale();
  const format = useFormatter();
  const country = identity.country && isCountryCode(identity.country) ? displayName("region", locale, identity.country) : null;
  const native = identity.nativeLanguage && (NATIVE_LANGUAGES as readonly string[]).includes(identity.nativeLanguage)
    ? displayName("language", locale, identity.nativeLanguage) : null;
  const jlpt = identity.targetJlptLevel && JLPT.includes(identity.targetJlptLevel) ? identity.targetJlptLevel : null;
  const zone = offsetLabel(identity.timeZone);
  const ui = displayName("language", locale, locale);
  const since = identity.firstKnownLearningAt
    ? format.dateTime(new Date(identity.firstKnownLearningAt), { month: "long", year: "numeric" })
    : null;
  const rows = [
    country && { icon: "country", label: t("identity.country"), value: country },
    zone && { icon: "timeZone", label: t("identity.timeZone"), value: zone },
    since && { icon: "learningSince", label: t("identity.learningSince", { month: since }), value: "" },
    jlpt && { icon: "jlpt", label: t("identity.jlptGoal"), value: jlpt },
    native && { icon: "nativeLanguage", label: t("identity.nativeLanguage"), value: native },
    ui && { icon: "interface", label: t("identity.interface"), value: ui },
    { icon: "subtitle", label: t("identity.subtitle"), value: t("identity.subtitleValue", identity.subtitle) },
  ].filter((r): r is Row => Boolean(r));
  const Name = variant === "page" ? "h2" : "p";
  return (
    <section className={`${CARD} grid justify-items-center gap-xs text-center`} aria-label={variant === "preview" ? identity.displayName : undefined}>
      <div className="relative">
        {identity.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar from storage or OAuth, arbitrary origin.
          <img src={identity.avatarUrl} alt={t("identity.avatarAlt", { name: identity.displayName })} className="size-32 rounded-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex size-32 items-center justify-center rounded-full bg-primary/30 text-5xl font-bold">
            {Array.from(identity.displayName)[0]?.toUpperCase()}
          </span>
        )}
        {variant === "page" && (
          <Link
            href="/profile/edit"
            aria-label={t("identity.changePhoto")}
            className="absolute bottom-0 end-0 flex size-9 items-center justify-center rounded-full border border-border bg-card text-foreground"
          >
            <ProfileIcon name="camera" />
          </Link>
        )}
      </div>
      <Name className="text-2xl font-bold [overflow-wrap:anywhere]">{identity.displayName}</Name>
      {identity.username && <p className="text-sm text-muted-foreground">@{identity.username}</p>}
      {identity.bio && <p className="text-sm [overflow-wrap:anywhere]">{identity.bio}</p>}
      <ul className="mt-sm grid w-full gap-sm border-t border-border pt-md text-start text-sm">
        {rows.map((r) => (
          <li key={r.label}>
            <span className="flex items-center gap-xs text-muted-foreground"><ProfileIcon name={r.icon} />{r.label}</span>
            {r.value && <span className="block ps-[calc(var(--icon-sm)+var(--space-xs))] font-medium">{r.value}</span>}
          </li>
        ))}
      </ul>
      {actions && <div className="mt-sm w-full">{actions}</div>}
    </section>
  );
}
