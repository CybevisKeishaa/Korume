"use client";

import { Dialog as UiDialog } from "@/components/ui/dialog";

export interface DialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Element to focus when the dialog opens; defaults to the built-in close
   * (×) button. */
  initialFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * Admin CMS dialog — now a thin wrapper over the design-system dialog
 * (components/ui/dialog.tsx), which adds the real focus trap the L7 review
 * flagged (WCAG 2.4.3). Props are unchanged so the three consumers
 * (confirm-dialog, content-form, video-queue) did not move.
 */
export function Dialog(props: DialogProps) {
  return <UiDialog {...props} />;
}
