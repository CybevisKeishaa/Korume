"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AdminStats } from "@/lib/admin-ui-types";

type LoadState = { status: "loading" } | { status: "idle" } | { status: "error"; message: string };

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

const CONTENT_COUNT_LABELS: { key: keyof AdminStats["contentCounts"]; label: string }[] = [
  { key: "videosPending", label: "Videos pending" },
  { key: "videosApproved", label: "Videos approved" },
  { key: "kanji", label: "Kanji" },
  { key: "vocab", label: "Vocabulary" },
  { key: "grammar", label: "Grammar points" },
  { key: "jlptTests", label: "JLPT tests" },
  { key: "readingPassages", label: "Reading passages" },
];

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
  const [data, setData] = useState<AdminStats | null>(null);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(STATS_URL);
        if (!res.ok) {
          if (!cancelled) setLoadState({ status: "error", message: "Could not load the stats dashboard." });
          return;
        }
        const body = (await res.json()) as { data: AdminStats };
        if (cancelled) return;
        setData(body.data);
        setLoadState({ status: "idle" });
      } catch {
        if (!cancelled) setLoadState({ status: "error", message: "Could not load the stats dashboard." });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState.status === "error") {
    return (
      <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
        {loadState.message}
      </p>
    );
  }

  if (loadState.status === "loading" || !data) {
    return <p className="text-sm text-muted-foreground">Loading stats…</p>;
  }

  const maxActivity = Math.max(1, ...data.topActivity.map((a) => a.count));

  return (
    <div className="space-y-8">
      <section aria-labelledby="users-heading">
        <h2 id="users-heading" className="mb-3 text-lg font-semibold">
          Users
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total users" value={data.totalUsers} />
          <StatCard label="New (7d)" value={data.newUsers7d} />
          <StatCard label="New (30d)" value={data.newUsers30d} />
          <StatCard label="Active (7d)" value={data.activeUsers7d} />
          <StatCard label="Active (30d)" value={data.activeUsers30d} />
        </div>
      </section>

      <section aria-labelledby="retention-heading">
        <h2 id="retention-heading" className="mb-3 text-lg font-semibold">
          Retention
        </h2>
        <Card>
          <CardHeader>
            <CardTitle>
              {data.retention.retentionPercent === null ? (
                <span className="text-muted-foreground">No cohort data yet</span>
              ) : (
                <span className="tabular-nums">{data.retention.retentionPercent}%</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {data.retention.activeCount} of {data.retention.cohortSize} in cohort still active in the last 7 days.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{data.retention.methodology}</p>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="content-heading">
        <h2 id="content-heading" className="mb-3 text-lg font-semibold">
          Content
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CONTENT_COUNT_LABELS.map(({ key, label }) => (
            <StatCard key={key} label={label} value={data.contentCounts[key]} />
          ))}
        </div>
      </section>

      <section aria-labelledby="activity-heading">
        <h2 id="activity-heading" className="mb-3 text-lg font-semibold">
          Top activity (last 7 days)
        </h2>
        {data.topActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
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

      <p className="text-xs text-muted-foreground">Generated {new Date(data.generatedAt).toLocaleString()}</p>
    </div>
  );
}
