"use client";

import type { ReactNode } from "react";
import { useRouter } from "@/lib/i18n/navigation";

export function BackButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      className={className}
      onClick={() => (window.history.length > 1 ? history.back() : router.push("/"))}
    >
      {children}
    </button>
  );
}
