"use client";

import { useState, type KeyboardEvent } from "react";
import { useTranslations } from "@/lib/i18n";
import type { ActivityCell } from "@/lib/dashboard/activity";
import { DashboardCard } from "./dashboard-card";

export function ActivityCard({ cells, streak, error = false }: { cells: ActivityCell[]; streak: number; error?: boolean }) {
  const t = useTranslations("dashboard");
  const [highlight, setHighlight] = useState(0);
  const streakText = streak > 0 ? t("activity.streak", { count: streak }) : t("activity.noStreak");
  const active = cells.filter((cell) => cell.state === "active").length;
  const label = (cell: ActivityCell) => t(`activity.cell.${cell.state}`, { date: cell.date, count: cell.count });
  const cellClass = (cell: ActivityCell) => cell.state === "active" ? ["bg-primary/20", "bg-primary/40", "bg-primary/60", "bg-primary/80", "bg-primary"][cell.level] : cell.state === "empty" ? "bg-secondary" : cell.state === "rest" ? "bg-muted" : "bg-muted opacity-50";
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => { const offset = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -14 : event.key === "ArrowDown" ? 14 : 0; if (offset) { event.preventDefault(); setHighlight((value) => Math.max(0, Math.min(cells.length - 1, value + offset))); } };
  if (error) return <DashboardCard id="learning-activity" area="activity" eyebrow={t("activity.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  return <DashboardCard id="learning-activity" area="activity" eyebrow={t("activity.eyebrow")} describedBy="learning-activity-summary" tabIndex={0} onKeyDown={onKeyDown}>
    <p id="learning-activity-summary" className="sr-only">{t("activity.summary", { streak: streakText, active })}</p>
    <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1">
      {cells.map((cell, index) => <span key={cell.date} role="img" aria-label={label(cell)} className={`block aspect-square rounded-sm ${cellClass(cell)}`} data-state={cell.state} data-highlighted={highlight === index || undefined} />)}
    </div><p className="sr-only" role="status">{cells[highlight] ? label(cells[highlight]) : ""}</p><p className="mt-md text-sm">{streakText}</p><p className="mt-xs text-xs text-muted-foreground">{t("activity.caption")}</p>
  </DashboardCard>;
}
