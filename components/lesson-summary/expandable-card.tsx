"use client";

import { createContext, useContext, useEffect, useRef, useState, type HTMLAttributes, type MouseEvent } from "react";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const Expanded = createContext(false);

/** A card click waits this long before toggling, so the second click of a word-selecting double-click can cancel it.
 *  500ms is the Windows default double-click time; it is also how long a card click takes to open the card.
 *  ponytail: fixed window, a slower OS double-click setting still toggles once; read it from the OS if that is seen. */
export const CARD_CLICK_DELAY_MS = 500;

const isCut = (card: HTMLElement) =>
  Array.from(card.querySelectorAll<HTMLElement>("[data-clamp]")).some((el) => el.scrollHeight > el.clientHeight + 1);

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
  const pendingToggle = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(pendingToggle.current), []);

  useEffect(() => {
    const card = ref.current;
    // Open text is never cut: measuring now would drop `cut` and with it the "Show less" button.
    if (!card || expanded) return;
    const measure = () => setCut(isCut(card));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    // New text can overflow a clamp box whose size does not change (4 lines → 6 lines clamped to 4).
    const mutations = new MutationObserver(measure);
    mutations.observe(card, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [expanded]);

  const onCardClick = (event: MouseEvent<HTMLDivElement>) => {
    // Any click, a control's included, supersedes a pending card toggle.
    window.clearTimeout(pendingToggle.current);
    if ((event.target as Element).closest("a, button, input, select, textarea, [role='button']")) return;
    if (event.detail > 1) return; // the second click of a double-click cancels the first (m6)
    pendingToggle.current = window.setTimeout(() => {
      if (window.getSelection()?.toString()) return; // selecting text is not a toggle
      // Opening text that stopped being cut would leave no "Show less" and no way back; closing is always allowed.
      setExpanded((value) => (value || (ref.current && isCut(ref.current)) ? !value : value));
    }, CARD_CLICK_DELAY_MS);
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
