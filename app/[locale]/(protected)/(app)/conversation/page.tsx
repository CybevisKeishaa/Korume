import type { Metadata } from "next";
import { useTranslations, type Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { ConversationApp } from "@/components/conversation/conversation-app";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "conversation" });
  return { title: t("page.heading") };
}

export default function ConversationPage() {
  const t = useTranslations("conversation");
  return (
    <Container className="py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("page.heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("page.subtitle")}</p>
      </div>

      <ConversationApp />
    </Container>
  );
}
