"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStats } from "@/lib/admin-ui-types";
import { useTranslations } from "@/lib/i18n";

type LoadState = { status: "loading" } | { status: "idle" } | { status: "error"; message: string };
type Translator = ReturnType<typeof useTranslations<"admin">>;

const STATS_URL = "/api/admin/stats";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      </CardContent>
    </Card>
  );
}

/** `key`s match `AdminStats["contentCounts"]`'s own field names, distinct
 * from `ContentType` (`jlptTests`/`readingPassages` here vs `jlpt_tests`/
 * `reading_passages` there) — kept as its own catalog branch
 * (`dashboard.contentCounts.*`) rather than reusing `content.types.*`. */
const CONTENT_COUNT_KEYS: (keyof AdminStats["contentCounts"])[] = [
  "videosPending",
  "videosApproved",
  "kanji",
  "vocab",
  "grammar",
  "jlptTests",
  "readingPassages",
];

function contentCountLabel(t: Translator, key: keyof AdminStats["contentCounts"]): string {
  return t(`dashboard.contentCounts.${key}`);
}

/**
 * Admin stats dashboard (`/admin`). Fetches `GET /api/admin/stats`
 * (`lib/data/admin-stats.ts`) once on mount. No chart library — plain CSS
 * width bars for "top activity" per this task's brief (admin isn't the
 * cinematic surface).
 *
 * Honesty requirement (CLAUDE.md, task brief): the retention card always
 * shows its `methodology` string as visible fine print, not just a tooltip —
 * a raw percentage with no stated cohort definition is misleading.
 */
export function StatsDashboard() {
  const t = useTranslations("admin");
  const [data, setData] = useState<AdminStats | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(STATS_URL);
        if (!res.ok) {
          if (!cancelled) setLoadState({ status: "error", message: t("dashboard.error") });
          return;
        }
        const body = (await res.json()) as { data: AdminStats };
        if (cancelled) return;
        setData(body.data);
        setLoadState({ status: "idle" });
      } catch {
        if (!cancelled) setLoadState({ status: "error", message: t("dashboard.error") });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` is stable for the lifetime of this component (locale is fixed per route render, per the project's translator idiom).
  }, []);

  if (loadState.status === "error") {
    return (
      <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger-strong">
        {loadState.message}
      </p>
    );
  }

  if (loadState.status === "loading" || !data) {
    return <p className="text-sm text-muted-foreground">{t("dashboard.loading")}</p>;
  }

  const maxActivity = Math.max(1, ...data.topActivity.map((a) => a.count));

  return (
    <div className="space-y-8">
      <section aria-labelledby="users-heading">
        <h2 id="users-heading" className="mb-3 text-lg font-semibold">
          {t("dashboard.sections.users")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label={t("dashboard.stats.totalUsers")} value={data.totalUsers} />
          <StatCard label={t("dashboard.stats.new7d")} value={data.newUsers7d} />
          <StatCard label={t("dashboard.stats.new30d")} value={data.newUsers30d} />
          <StatCard label={t("dashboard.stats.active7d")} value={data.activeUsers7d} />
          <StatCard label={t("dashboard.stats.active30d")} value={data.activeUsers30d} />
        </div>
      </section>

      <section aria-labelledby="retention-heading">
        <h2 id="retention-heading" className="mb-3 text-lg font-semibold">
          {t("dashboard.sections.retention")}
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>
              {data.retention.retentionPercent === null ? (
                <span className="text-muted-foreground">{t("dashboard.retention.noCohortData")}</span>
              ) : (
                <span className="tabular-nums">{data.retention.retentionPercent}%</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.retention.summary", {
                activeCount: data.retention.activeCount,
                cohortSize: data.retention.cohortSize,
              })}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{data.retention.methodology}</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="content-heading">
        <h2 id="content-heading" className="mb-3 text-lg font-semibold">
          {t("dashboard.sections.content")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONTENT_COUNT_KEYS.map((key) => (
            <StatCard key={key} label={contentCountLabel(t, key)} value={data.contentCounts[key]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-3 text-lg font-semibold">
          {t("dashboard.sections.activity")}
        </h2>
        {data.topActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("dashboard.activityEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {data.topActivity.map((activity) => (
              <li key={activity.sourceType} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm">{activity.sourceType}</span>
                <span className="h-2 flex-1 rounded-full bg-muted" aria-hidden="true">
                  <span
                    className="block h-2 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (activity.count / maxActivity) * 100)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {activity.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        {t("dashboard.generatedAt", { date: new Date(data.generatedAt).toLocaleString() })}
      </p>
    </div>
  );
}
