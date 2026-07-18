"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Tabs primitive. Radix supplies roving tabindex, arrow-key navigation and
 * the WAI-ARIA tabs pattern; the compound API (Tabs/TabsList/TabsTrigger/
 * TabsContent) is defined here as our own (D7: adopt the pattern, never
 * re-export the import).
 */
export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={className}
    >
      {children}
    </RadixTabs.Root>
  );
}

export function TabsList({
  "aria-label": ariaLabel,
  className,
  children,
}: {
  "aria-label"?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.List
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-2xs rounded-md bg-muted p-2xs", className)}
    >
      {children}
    </RadixTabs.List>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Trigger
      value={value}
      className={cn(
        "rounded-sm px-sm py-2xs text-body font-medium text-muted-foreground",
        "transition-colors duration-fast hover:text-foreground",
        "data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-raised",
        className,
      )}
    >
      {children}
    </RadixTabs.Trigger>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <RadixTabs.Content value={value} className={cn("mt-md", className)}>
      {children}
    </RadixTabs.Content>
  );
}
