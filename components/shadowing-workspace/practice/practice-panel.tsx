import type { ReactNode } from "react";

export function PracticePanel({ label, navigator, feedback, children }: {
  label: string;
  navigator: ReactNode;
  feedback: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="flex h-full min-h-0 flex-col gap-md overflow-y-auto p-md" data-testid="practice-panel">
      <div>{navigator}</div>
      <div className="flex flex-col gap-md">{children}</div>
      <div>{feedback}</div>
    </section>
  );
}
