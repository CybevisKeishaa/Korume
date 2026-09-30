import { Link } from "@/lib/i18n/navigation";
import { ProgressRing, ValueOrDash } from "./progress-display";

const CARD = "flex h-full flex-col rounded-lg border border-border bg-card p-md shadow-raised transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A Practice by Situation tile (Figma 37:5331): the whole tile opens that situation's lessons. */
export function HubSituationTile({ label, icon, href, action, actionLabel }: {
  label: string;
  icon: string | null;
  href: string;
  action: string;
  /** "Start practice: Restaurant" — the tile's accessible name. */
  actionLabel: string;
}) {
  return (
    <li>
      <Link href={href} aria-label={actionLabel} className={`group justify-between gap-md ${CARD}`}>
        <span aria-hidden="true" className="text-heading-lg">{icon}</span>
        <span>
          <span className="block text-body font-semibold text-foreground">{label}</span>
          <span aria-hidden="true" className="mt-xs block text-caption text-muted-foreground group-hover:text-primary-strong">
            {action}&nbsp;→
          </span>
        </span>
      </Link>
    </li>
  );
}

/** A Shadowing Collections card (Figma 37:5331); the copy arrives formatted, as strings. */
export function HubCollectionCard({ title, href, meta, sentences, glyph }: {
  title: string;
  href: string;
  /** "Beginner · 42 min"; empty when the lessons carry neither. */
  meta: string;
  sentences: string | null;
  /** The decorative kanji on the card's panel. */
  glyph: string;
}) {
  return (
    <li>
      <Link href={href} className={CARD}>
        <span aria-hidden="true" className="flex items-end rounded-md bg-secondary p-sm pt-lg font-jp text-title text-primary-strong">{glyph}</span>
        <span className="mt-md block text-body font-semibold text-foreground">{title}</span>
        {meta ? <span className="mt-xs block text-caption text-muted-foreground">{meta}</span> : null}
        {sentences ? <span className="mt-2xs block text-caption text-muted-foreground">{sentences}</span> : null}
      </Link>
    </li>
  );
}

/** A JLPT Speaking card (Figma 37:5737): the whole card opens that level's lessons. */
export function HubLevelCard({ level, href, percent, practiced, lessons, scoreLabel, score, scoreMissing }: {
  level: string;
  href: string;
  /** Share of the level's lessons the learner has shadowed, 0–100. */
  percent: number;
  /** "82% practiced" — the ring's meaning, for assistive technology. */
  practiced: string;
  lessons: string;
  scoreLabel: string;
  /** Null when no session at this level is scored yet; the card shows a dash. */
  score: string | null;
  /** "No score yet" — what the dash means. */
  scoreMissing: string;
}) {
  return (
    <li>
      <Link href={href} className={CARD}>
        <span className="flex items-start justify-between gap-sm">
          <span className="text-title font-semibold text-foreground">{level}</span>
          <ProgressRing percent={percent} size="sm" className="text-caption text-primary-strong">{percent}%</ProgressRing>
          <span className="sr-only">{practiced}</span>
        </span>
        <span className="mt-md block text-caption text-muted-foreground">{lessons}</span>
        <span className="mt-xs block text-caption text-muted-foreground">
          {scoreLabel}&nbsp;
          <ValueOrDash value={score} missing={scoreMissing} className="font-semibold text-foreground" />
        </span>
      </Link>
    </li>
  );
}
