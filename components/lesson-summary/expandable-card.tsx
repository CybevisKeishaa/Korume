"use client";

import { createContext, useContext, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent } from "react";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const Expanded = createContext(false);

/** Literal class names so Tailwind generates them. */
const LINES = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" } as const;

/** A paragraph cut to `lines` with "…" until the ExpandableCard around it opens. */
export function Clamp({ lines, className, ...props }: HTMLAttributes<HTMLParagraphElement> & { lines: keyof typeof LINES }) {
  const expanded = useContext(Expanded);
  return <p data-clamp="" className={cn(!expanded && LINES[lines], className)} {...props} />;
}

/**
 * A card whose `Clamp` texts stay cut until a click on the card (outside its own controls) or "Show more" opens it.
 * Both exist only while some text is actually cut, so a card with short text looks and behaves as before.
 * Owner 2026-10-05: no visible button — "…" plus a card click is the affordance. The button stays for keyboard
 * users and only appears while it has keyboard focus.
 */
export function ExpandableCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const t = useTranslations("shadowing.lessonSummary");
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState(false);

  useEffect(() => {
    const card = ref.current;
    // Open text is never cut: measuring now would drop `cut` and with it the "Show less" button.
    if (!card || expanded) return;
    const measure = () =>
      setCut(Array.from(card.querySelectorAll<HTMLElement>("[data-clamp]")).some((el) => el.scrollHeight > el.clientHeight + 1));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, [expanded]);

  const onCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!cut) return;
    if ((event.target as Element).closest("a, button, input, select, textarea, [role='button']")) return;
    if (window.getSelection()?.toString()) return; // selecting text is not a toggle
    setExpanded((value) => !value);
  };

  return (
    <Expanded.Provider value={expanded}>
      <Card ref={ref} {...props} onClick={onCardClick} className={cn(cut && "cursor-pointer", className)}>
        {children}
        {cut && (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="sr-only self-start rounded-md text-caption focus-visible:not-sr-only font-semibold text-primary-strong underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {expanded ? t("showLess") : t("showMore")}
          </button>
        )}
      </Card>
    </Expanded.Provider>
  );
}
