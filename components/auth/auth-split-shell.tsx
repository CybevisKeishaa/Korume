import type { ReactNode } from "react";

/** The shared auth composition: a 60/40 split above the mobile handoff. */
export function AuthSplitShell({
  story,
  children,
}: {
  story: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh grid-cols-[3fr_2fr] bg-background">
      {story}
      <main className="flex items-center justify-center px-xl py-xl">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
