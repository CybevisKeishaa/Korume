import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/lib/i18n/navigation";
import { ModeNav } from "./mode-nav";
import { BackGlyph } from "./player-glyphs";

export const HEADER_ICON_BUTTON =
  "flex h-control-sm aspect-square items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground aria-pressed:text-primary-strong aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";

export interface LessonHeaderFrameProps {
  videoId: string;
  backHref: string;
  backLabel: string;
  title: string;
  eyebrow?: string;
  source?: string;
  jlptLabel?: string | null;
  afterTitle?: ReactNode;
  actions?: ReactNode;
}

/**
 * The lesson header every Learning Mode shares (summary spec §7.1): props only, no workspace context, so the
 * Summary page can render it without the workspace. One row, ≤ 48px at 1280×529.
 */
export function LessonHeaderFrame({ videoId, backHref, backLabel, title, eyebrow, source, jlptLabel, afterTitle, actions }: LessonHeaderFrameProps) {
  return (
    <header className="flex items-center gap-md border-b px-md py-2xs">
      <div className="flex min-w-0 flex-1 items-center gap-sm">
        <Link href={backHref} aria-label={backLabel} title={backLabel} className={HEADER_ICON_BUTTON}>
          <BackGlyph className="size-icon-sm" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-body font-semibold">{title}</h1>
          {eyebrow && <p className="text-caption font-medium uppercase tracking-wide text-primary-strong">{eyebrow}</p>}
          {source && <p className="truncate text-caption text-muted-foreground">{source}</p>}
        </div>
        {jlptLabel && <Badge variant="accent" className="shrink-0 border border-accent/40">{jlptLabel}</Badge>}
        {afterTitle}
      </div>
      <ModeNav videoId={videoId} />
      {actions && <div className="flex shrink-0 items-center gap-2xs">{actions}</div>}
    </header>
  );
}
