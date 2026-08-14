import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { listJlptAttempts, listJlptTests } from "@/lib/data/jlpt";
import { jlptLevelSchema } from "@/lib/validation/content";
import { LevelTabs } from "@/components/learning/level-tabs";
import { Container } from "@/components/ui/container";
import { JlptTestList } from "@/components/jlpt/jlpt-test-list";
import { JlptAttemptList } from "@/components/jlpt/jlpt-attempt-list";
import type { JlptLevel } from "@/lib/jlpt-ui";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "jlpt" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function JlptPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const t = await getTranslations("jlpt");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;

  // Fetch the full (unfiltered) test list once so attempt history can resolve
  // a title/level for every attempt, even one on a test outside the current
  // level filter — then filter locally for the on-page list.
  const allTests = await listJlptTests();
  const attemptsResult = await listJlptAttempts();
  const attempts = attemptsResult.ok ? attemptsResult.data : [];

  const testsById: Record<string, { title: string; level: JlptLevel }> = Object.fromEntries(
    allTests.map((t) => [t.id, { title: t.title, level: t.level }]),
  );
  const tests = level ? allTests.filter((t) => t.level === level) : allTests;

  return (
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitleCount", { count: tests.length })}
            {level ? ` · ${level}` : ""}
          </p>
        </div>
        <LevelTabs basePath="/certification" active={level} />
      </div>

      <JlptTestList tests={tests} />

      <section className="mt-10" aria-label={t("recentAttempts")}>
        <h2 className="mb-3 text-lg font-semibold">{t("recentAttempts")}</h2>
        <JlptAttemptList attempts={attempts} testsById={testsById} />
      </section>
    </Container>
  );
}
