import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "danger"
  | "outline";

const badgeVariants: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary-strong",
  accent: "bg-accent/10 text-accent-strong",
  success: "bg-success/10 text-success-strong",
  danger: "bg-danger/10 text-danger-strong",
  outline: "border border-border text-foreground",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** Small status label (JLPT level, verified flag, counts). Purely visual —
 * pair with visually-hidden text if the colour alone carries meaning. */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-xs py-2xs text-caption font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
