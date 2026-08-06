"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import * as RadixToast from "@radix-ui/react-toast";
import { cn } from "@/lib/utils";

export type ToastVariant = "default" | "success" | "danger";

export interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Auto-dismiss delay. Defaults to the provider's 5000ms. */
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((options: ToastOptions) => void) | null>(null);

/** Fire a toast from any client component under <ToastProvider>. */
export function useToast(): { toast: (options: ToastOptions) => void } {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return { toast };
}

const variantStyles: Record<ToastVariant, string> = {
  default: "border-border",
  success: "border-success/50",
  danger: "border-danger/50",
};

/**
 * App-wide toast surface (mounted once in app/[locale]/layout.tsx). Radix
 * supplies aria-live announcement, hotkey focus (F8), pause-on-hover and
 * swipe dismiss; the queue and the `toast()` API are ours (P8).
 *
 * swipeDirection is genuinely physical (a gesture), exempt from §8.
 */
export function ToastProvider({
  children,
  dismissLabel = "Dismiss notification",
}: {
  children: React.ReactNode;
  dismissLabel?: string;
}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const toast = useCallback((options: ToastOptions) => {
    nextId.current += 1;
    setToasts((current) => [...current, { ...options, id: nextId.current }]);
  }, []);

  const remove = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      <RadixToast.Provider duration={5000} swipeDirection="right">
        {children}
        {toasts.map((item) => (
          <RadixToast.Root
            key={item.id}
            duration={item.durationMs}
            onOpenChange={(open) => {
              if (!open) remove(item.id);
            }}
            className={cn(
              "flex items-start justify-between gap-xs rounded-md border bg-overlay p-sm",
              "text-foreground shadow-floating",
              variantStyles[item.variant ?? "default"],
            )}
          >
            <div>
              <RadixToast.Title className="text-body font-medium">
                {item.title}
              </RadixToast.Title>
              {item.description ? (
                <RadixToast.Description className="mt-1 text-body text-muted-foreground">
                  {item.description}
                </RadixToast.Description>
              ) : null}
            </div>
            <RadixToast.Close
              aria-label={dismissLabel}
              className="shrink-0 rounded px-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              ×
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport
          className={cn(
            "fixed bottom-4 end-4 z-toast flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-xs",
            "outline-none",
          )}
        />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
