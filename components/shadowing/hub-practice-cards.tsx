import { Link } from "@/lib/i18n/navigation";

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
  sentences: string;
  /** The decorative kanji on the card's panel. */
  glyph: string;
}) {
  return (
    <li>
      <Link href={href} className={CARD}>
        <span aria-hidden="true" className="flex items-end rounded-md bg-secondary p-sm pt-lg font-jp text-title text-primary-strong">{glyph}</span>
        <span className="mt-md block text-body font-semibold text-foreground">{title}</span>
        {meta ? <span className="mt-xs block text-caption text-muted-foreground">{meta}</span> : null}
        <span className="mt-2xs block text-caption text-muted-foreground">{sentences}</span>
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
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  return (
    <li>
      <Link href={href} className={CARD}>
        <span className="flex items-start justify-between gap-sm">
          <span className="text-title font-semibold text-foreground">{level}</span>
          <span aria-hidden="true" className="relative size-10 shrink-0">
            <svg viewBox="0 0 36 36" className="size-10 -rotate-90">
              <circle cx="18" cy="18" r={radius} fill="none" strokeWidth="3" className="stroke-primary/25" />
              {/* A round cap on an empty arc still paints a dot, so 0% draws no arc. */}
              {percent > 0 ? (
                <circle
                  cx="18" cy="18" r={radius} fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-primary"
                  strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)}
                />
              ) : null}
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-caption text-primary-strong">{percent}%</span>
          </span>
          <span className="sr-only">{practiced}</span>
        </span>
        <span className="mt-md block text-caption text-muted-foreground">{lessons}</span>
        <span className="mt-xs block text-caption text-muted-foreground">
          {scoreLabel}&nbsp;
          {score === null ? (
            <><span aria-hidden="true" className="font-semibold text-foreground">—</span><span className="sr-only">{scoreMissing}</span></>
          ) : <span className="font-semibold text-foreground">{score}</span>}
        </span>
      </Link>
    </li>
  );
}
