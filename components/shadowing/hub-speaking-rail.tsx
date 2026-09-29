import { Link } from "@/lib/i18n/navigation";

const CARD = "rounded-lg border border-border bg-card p-md-lg";
const EYEBROW = "text-caption font-semibold uppercase tracking-wide text-muted-foreground";
const BUTTON = "mt-md-lg flex min-h-hit-target w-full items-center justify-center rounded-full bg-primary px-md text-body font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** A value the learner has, or a dash that says it is unknown — never a stand-in zero. */
function Value({ value, missing, className }: { value: string | null; missing: string; className: string }) {
  if (value !== null) return <span className={className}>{value}</span>;
  return <><span aria-hidden="true" className={className}>—</span><span className="sr-only">{missing}</span></>;
}

export interface HubSpeakingRailProps {
  today: {
    title: string;
    minutes: number;
    minutesUnit: string;
    /** "18 of 15 minutes today" — the ring's meaning. */
    minutesLabel: string;
    /** Share of the daily goal, 0–100. */
    goalPercent: number;
    lessons: string;
    scoreLabel: string;
    score: string | null;
    scoreMissing: string;
    continue: { href: string; label: string } | null;
  };
  weekly: {
    title: string;
    heading: string;
    metrics: { label: string; value: string | null }[];
    notEnoughData: string;
    trend: {
      /** "Daily average score, last two weeks" — names the chart. */
      label: string;
      /** Each point: x across the window, 0–1; score 0–100; its own label for hover and screen readers. */
      points: { x: number; score: number; label: string }[];
      empty: string;
    };
  };
  sensei: {
    title: string;
    heading: string;
    body: string | null;
    empty: string;
    pick: { eyebrow: string; title: string; detail: string | null; href: string; action: string; actionLabel: string } | null;
  };
  recent: {
    title: string;
    empty: string;
    scoreMissing: string;
    /** "Score" — names the bare number at the row's end. */
    scoreLabel: string;
    rows: { id: string; title: string; href: string; when: string; dateTime: string; score: string | null }[];
  };
}

/** The Pronunciation Studio rail (Figma 37:5929): four cards, each a labelled region. */
export function HubSpeakingRail({ today, weekly, sensei, recent }: HubSpeakingRailProps) {
  const ring = 2 * Math.PI * 32;
  const { points } = weekly.trend;
  // Plot coordinates to a tenth of a unit: exact enough, and no float noise in the markup.
  const tenth = (value: number) => Math.round(value * 10) / 10;
  const x = (fraction: number) => tenth(fraction * 240);
  const y = (score: number) => tenth(60 - (score / 100) * 52);

  return (
    <div className="space-y-md-lg">
      <section aria-label={today.title} className={CARD}>
        <h2 className={EYEBROW}>{today.title}</h2>
        <div className="mt-md flex items-center gap-md">
          <div className="relative size-20 shrink-0">
            <svg viewBox="0 0 72 72" aria-hidden="true" className="size-20 -rotate-90">
              <circle cx="36" cy="36" r="32" fill="none" strokeWidth="5" className="stroke-primary/25" />
              {today.goalPercent > 0 ? (
                <circle
                  cx="36" cy="36" r="32" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-primary"
                  strokeDasharray={ring} strokeDashoffset={ring * (1 - today.goalPercent / 100)}
                />
              ) : null}
            </svg>
            <span aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-heading font-semibold text-foreground">{today.minutes}</span>
              <span className="text-caption text-muted-foreground">{today.minutesUnit}</span>
            </span>
            <span className="sr-only">{today.minutesLabel}</span>
          </div>
          <div className="min-w-0 text-caption text-muted-foreground">
            <p>{today.lessons}</p>
            <p className="mt-xs">
              {today.scoreLabel}&nbsp; <Value value={today.score} missing={today.scoreMissing} className="font-semibold text-primary-strong" />
            </p>
          </div>
        </div>
        {today.continue ? <Link href={today.continue.href} className={BUTTON}>{today.continue.label}</Link> : null}
      </section>

      <section aria-label={weekly.title} className={CARD}>
        <h2 className={EYEBROW}>{weekly.title}</h2>
        <h3 className="mt-sm text-heading font-semibold text-foreground">{weekly.heading}</h3>
        <dl className="mt-md space-y-sm">
          {weekly.metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-sm text-caption">
              <dt className="text-muted-foreground">{metric.label}</dt>
              <dd><Value value={metric.value} missing={weekly.notEnoughData} className="font-semibold text-primary-strong" /></dd>
            </div>
          ))}
        </dl>
        {points.length >= 2 ? (
          <figure className="mt-md">
            <svg viewBox="0 0 240 64" role="img" aria-label={weekly.trend.label} className="h-16 w-full overflow-visible">
              <line x1="0" y1="63" x2="240" y2="63" strokeWidth="1" className="stroke-border" />
              <polyline
                fill="none" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="stroke-primary"
                points={points.map((point) => `${x(point.x)},${y(point.score)}`).join(" ")}
              />
              {points.map((point) => (
                // A hit target wider than the 8px marker, each with its own tooltip.
                <g key={point.x}>
                  <circle cx={x(point.x)} cy={y(point.score)} r="4" strokeWidth="2" className="fill-primary stroke-card" />
                  <circle cx={x(point.x)} cy={y(point.score)} r="10" className="fill-transparent">
                    <title>{point.label}</title>
                  </circle>
                </g>
              ))}
            </svg>
            <figcaption className="sr-only">
              <ul>{points.map((point) => <li key={point.x}>{point.label}</li>)}</ul>
            </figcaption>
          </figure>
        ) : (
          <p className="mt-md text-caption text-muted-foreground">{weekly.trend.empty}</p>
        )}
      </section>

      <section aria-label={sensei.title} className={CARD}>
        <h2 className={`${EYEBROW} flex items-center gap-xs`}><span aria-hidden="true" className="text-primary-strong">✦</span>{sensei.title}</h2>
        <h3 className="mt-sm text-heading font-semibold text-foreground">{sensei.heading}</h3>
        {sensei.pick ? (
          <>
            {sensei.body ? <p className="mt-sm text-caption text-muted-foreground">{sensei.body}</p> : null}
            <div className="mt-md rounded-lg bg-secondary p-md">
              <p className="text-caption text-muted-foreground">{sensei.pick.eyebrow}</p>
              <p className="mt-xs text-body font-semibold text-foreground">{sensei.pick.title}</p>
              {sensei.pick.detail ? <p className="mt-2xs text-caption text-muted-foreground">{sensei.pick.detail}</p> : null}
            </div>
            <Link href={sensei.pick.href} aria-label={sensei.pick.actionLabel} className={BUTTON}>{sensei.pick.action}</Link>
          </>
        ) : (
          <p className="mt-sm text-caption text-muted-foreground">{sensei.empty}</p>
        )}
      </section>

      <section aria-label={recent.title} className={CARD}>
        <h2 className={EYEBROW}>{recent.title}</h2>
        {recent.rows.length ? (
          <ul className="mt-sm divide-y divide-border">
            {recent.rows.map((row) => (
              <li key={row.id}>
                <Link href={row.href} className="flex items-center justify-between gap-sm py-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0">
                    <span className="block truncate text-body text-foreground">{row.title}</span>
                    <time dateTime={row.dateTime} className="block text-caption text-muted-foreground">{row.when}</time>
                  </span>
                  <span className="shrink-0">
                    <span className="sr-only">{recent.scoreLabel} </span>
                    <Value value={row.score} missing={recent.scoreMissing} className="text-body font-semibold text-primary-strong" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-sm text-caption text-muted-foreground">{recent.empty}</p>
        )}
      </section>
    </div>
  );
}
