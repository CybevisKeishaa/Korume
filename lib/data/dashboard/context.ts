import "server-only";
import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { readPreferences } from "@/lib/data/preferences";
import { resolveAvatarUrl } from "@/lib/profile/avatar-url";
import { studyDate } from "@/lib/time/study-day";
import { getStudyTimezone } from "@/lib/time/study-timezone";
import type { IsoWeekday } from "@/lib/time/study-day";

const cache: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

export interface DashboardContext {
  userId: string;
  name: string | null;
  avatarUrl: string | null;
  timeZone: string;
  now: Date;
  today: string;
  createdAt: string;
  scheduleDays: readonly IsoWeekday[];
  companionEnabled: boolean;
}

export const getDashboardContext = cache(async (now = new Date()): Promise<DashboardContext | null> => {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data, error }, { timeZone }] = await Promise.all([
    supabase.from("users").select("name, avatar_path, avatar_url, created_at").eq("id", user.id).maybeSingle(),
    getStudyTimezone(),
  ]);
  if (error) throw error;
  const row = data as { name: string | null; avatar_path: string | null; avatar_url: string | null; created_at: string } | null;
  if (!row) return null;
  const [preferences, avatarUrl] = await Promise.all([
    readPreferences(supabase, user.id),
    resolveAvatarUrl({ avatarPath: row.avatar_path, avatarUrl: row.avatar_url }),
  ]);
  return {
    userId: user.id, name: row.name, avatarUrl, timeZone, now, today: studyDate(now, timeZone),
    createdAt: new Date(row.created_at).toISOString(), scheduleDays: preferences.scheduleDays,
    companionEnabled: preferences.companionEnabled,
  };
});
