import { cn } from "@/lib/utils";

/**
 * Loading placeholder. aria-hidden always: loading state should be announced
 * by the surface that owns it (aria-busy / status text), not by each bone.
 * The pulse is killed by the global reduce-motion switch.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
