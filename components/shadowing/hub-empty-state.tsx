import type { ReactNode } from "react";

export interface HubEmptyStateProps {
  title: string;
  body: string;
  action?: ReactNode;
}

/**
 * A quiet interior for an authored Hub region whose truthful source is empty.
 * The parent owns the section landmark and decides whether a real next action
 * exists; this primitive never manufactures one.
 */
export function HubEmptyState({ title, body, action }: HubEmptyStateProps) {
  return (
    <div className="mt-md rounded-xl border border-border bg-card p-md-lg">
      <h3 className="text-body font-semibold text-foreground">{title}</h3>
      <p className="mt-xs text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-md">{action}</div> : null}
    </div>
  );
}
