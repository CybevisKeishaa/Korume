import { NotFoundView } from "@/components/errors/not-found-view";
import { getTranslations } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getTranslations<"errors">("errors");
  const common = await getTranslations<"common">("common");

  return (
    <NotFoundView
      backLabel={t("notFound.back")}
      body={t("notFound.body")}
      eyebrow={t("notFound.eyebrow")}
      goBackLabel={t("notFound.goBack")}
      goHomeLabel={t("notFound.goHome")}
      heading={t("notFound.heading")}
      requestedPathLabel={t("requestedPath.label")}
      wordmark={common("appName")}
    />
  );
}
