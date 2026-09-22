import type { ReactNode } from "react";

/**
 * The shared auth composition: story and card as one centred pair, not a full-bleed split —
 * the owner ruled (2026-09-22) that a 60/40 split left the columns too far apart and the card
 * too wide. The card column is a fixed w-96; the story takes the rest.
 */
export function AuthSplitShell({
  story,
  children,
}: {
  story: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-background">
      <div className="mx-auto grid min-h-dvh w-full max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3xl px-3xl">
        {story}
        <main className="w-96 py-xl short:py-md">{children}</main>
      </div>
    </div>
  );
}
