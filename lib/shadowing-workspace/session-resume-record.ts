export interface SessionResumeRecord {
  userId: string;
  videoId: string;
  position: number;
  savedAt: number;
  syncedServerAt: string | null;
}

export function sessionResumeKey(userId: string, videoId: string): string {
  return `shadowing-resume:${userId}:${videoId}`;
}

export function parseSessionResumeRecord(raw: string | null, userId: string, videoId: string): SessionResumeRecord | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const record = value as Partial<SessionResumeRecord>;
    if (
      record.userId !== userId || record.videoId !== videoId ||
      typeof record.position !== "number" || !Number.isFinite(record.position) ||
      typeof record.savedAt !== "number" || !Number.isFinite(record.savedAt) ||
      (record.syncedServerAt !== null && typeof record.syncedServerAt !== "string")
    ) return null;
    return { userId: record.userId, videoId: record.videoId, position: record.position, savedAt: record.savedAt, syncedServerAt: record.syncedServerAt ?? null };
  } catch {
    return null;
  }
}
