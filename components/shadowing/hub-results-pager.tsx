"use client";

import { useEffect, useRef, useTransition } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Link, useRouter } from "@/lib/i18n/navigation";

/**
 * A result list and its "Show more" link. A soft navigation keeps this
 * component mounted, so once the longer page arrives it moves focus to the
 * first new card: on the last page the link itself is gone, and a keyboard
 * or screen-reader user must not fall back to the top of the document.
 */
export function HubResultsPager({ count, more, children }: {
  /** How many result cards `children` holds. */
  count: number;
  more: { href: string; label: string; pendingLabel: string } | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  // The card count when "Show more" was pressed; null when it was not.
  const focusFrom = useRef<number | null>(null);

  useEffect(() => {
    const from = focusFrom.current;
    if (from === null || pending || count <= from) return;
    focusFrom.current = null;
    listRef.current?.querySelectorAll<HTMLElement>("li a")[from]?.focus();
  }, [count, pending]);

  return (
    <>
      <div ref={listRef}>{children}</div>
      {more ? (
        <div className="mt-lg flex justify-center">
          <Link
            href={more.href}
            scroll={false}
            aria-disabled={pending || undefined}
            className={buttonStyles({ variant: "outline", className: pending ? "opacity-70" : undefined })}
            onClick={(event) => {
              // A modified click (new tab, new window) stays the browser's.
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
              event.preventDefault();
              if (pending) return;
              focusFrom.current = count;
              startTransition(() => router.push(more.href, { scroll: false }));
            }}
          >
            {pending ? more.pendingLabel : more.label}
          </Link>
        </div>
      ) : null}
    </>
  );
}
