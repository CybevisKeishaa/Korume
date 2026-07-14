import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Local textarea primitive styled to match `components/ui/input.tsx`. Not
 * added to the shared `components/ui/` design system in this layer (out of
 * this agent's file ownership for this task) — lives here since only the
 * admin CMS forms need a multi-line text field today.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[5rem] w-full rounded-md border border-input bg-card px-3 py-2 text-sm",
      "placeholder:text-muted-foreground",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "aria-[invalid=true]:border-danger",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
