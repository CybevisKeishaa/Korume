import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { MascotPose } from "@/components/mascot/mascot-pose";
import type { MascotPoseName } from "@/components/mascot/mascot-poses";

export async function AuthStory({
  eyebrow,
  heading,
  body,
  quote,
  quoteAttribution,
  pose,
}: {
  eyebrow: string;
  heading: string;
  body: string;
  quote: string;
  quoteAttribution: string;
  pose: MascotPoseName;
}) {
  const t = await getTranslations("common");
  return (
    <section className="flex h-full flex-col justify-center gap-lg px-3xl py-xl short:gap-md short:py-md">
      <Link href="/" className="font-jp text-title font-bold text-foreground">
        {t("appNameJp")}
      </Link>
      <div className="space-y-sm">
        <p className="text-caption uppercase tracking-wide text-primary-strong">{eyebrow}</p>
        <p className="font-display text-display text-foreground">{heading}</p>
        <p className="text-body-lg text-muted-foreground">{body}</p>
      </div>
      <div className="space-y-md">
        <MascotPose pose={pose} size="lg" className="short:h-32" />
        <blockquote className="text-body text-muted-foreground">{quote}</blockquote>
        <p className="text-caption uppercase tracking-wide text-muted-foreground">{quoteAttribution}</p>
      </div>
    </section>
  );
}
