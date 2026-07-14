import { formatRelativeTime } from "@/lib/notification-format";

export interface RelativeTimeProps {
  /** ISO timestamp. */
  dateTime: string;
  className?: string;
}

/**
 * Shared `<time>` rendering for Layer 7 community lists (forum posts/comments,
 * playlists, peer-review shares/reviews). Reuses the relative-time formatter
 * already shipped for the notification bell (`lib/notification-format.ts`)
 * rather than adding a new dependency or duplicating the "Xm/h/d ago" logic.
 */
export function RelativeTime({ dateTime, className }: RelativeTimeProps) {
  return (
    <time dateTime={dateTime} className={className}>
      {formatRelativeTime(dateTime)}
    </time>
  );
}
