import type { ReactNode } from "react";

/** A value the learner has, or a dash that says it is unknown — never a stand-in zero. */
export function ValueOrDash({ value, missing, className }: { value: string | null; missing: string; className: string }) {
  return value === null
    ? <><span aria-hidden="true" className={className}>—</span><span className="sr-only">{missing}</span></>
    : <span className={className}>{value}</span>;
}

const RING = {
  // A JLPT Speaking card's corner ring.
  sm: { box: "size-10", view: 36, radius: 15, stroke: 3 },
  // Today's Speaking.
  lg: { box: "size-20", view: 72, radius: 32, stroke: 5 },
} as const;

/**
 * A decorative progress ring with its reading in the middle. Both are hidden
 * from assistive technology: the caller states the meaning in sr-only text.
 */
export function ProgressRing({ percent, size, className, children }: {
  /** 0–100. */
  percent: number;
  size: keyof typeof RING;
  /** Lays out the reading inside the ring. */
  className: string;
  children: ReactNode;
}) {
  const { box, view, radius, stroke } = RING[size];
  const centre = view / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <span className={`relative block shrink-0 ${box}`}>
      <svg viewBox={`0 0 ${view} ${view}`} aria-hidden="true" className={`${box} -rotate-90`}>
        <circle cx={centre} cy={centre} r={radius} fill="none" strokeWidth={stroke} className="stroke-primary/25" />
        {/* A round cap on an empty arc still paints a dot, so 0% draws no arc. */}
        {percent > 0 ? (
          <circle
            cx={centre} cy={centre} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round" className="stroke-primary"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)}
          />
        ) : null}
      </svg>
      <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center ${className}`}>{children}</span>
    </span>
  );
}
