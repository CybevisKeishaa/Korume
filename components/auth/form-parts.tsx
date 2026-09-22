"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { signInWithGoogle } from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "@/lib/i18n";

export function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("auth");
  return (
    <Button type="submit" size="lg" className="w-full short:h-control-lg" disabled={pending}>
      {pending ? t("form.pending") : label}
    </Button>
  );
}

export function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} role="alert" className="text-body text-danger-strong">
      {messages[0]}
    </p>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-danger/10 px-sm py-xs text-body text-danger-strong">
      {message}
    </p>
  );
}

function Eye({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A11.5 11.5 0 0 1 12 5c6 0 10 7 10 7a18.5 18.5 0 0 1-4.1 4.8M6.2 6.2C3.5 8.1 2 12 2 12s4 7 10 7a9.8 9.8 0 0 0 3.1-.5" />
    </svg>
  );
}

export function PasswordField({
  id,
  name,
  label,
  labelAction,
  autoComplete,
  errors,
}: {
  id: string;
  name: string;
  label: string;
  labelAction?: ReactNode;
  autoComplete: "current-password" | "new-password";
  errors?: string[];
}) {
  const [visible, setVisible] = useState(false);
  const t = useTranslations("auth");
  return (
    <div className="space-y-xs">
      <div className="flex items-center justify-between gap-sm">
        <Label htmlFor={id}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          aria-invalid={!!errors?.length}
          aria-describedby={`${id}-error`}
          className="pe-2xl"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? t("form.hidePassword") : t("form.showPassword")}
          aria-controls={id}
          className="absolute inset-y-0 end-0 flex aspect-square h-full items-center justify-center text-muted-foreground"
        >
          {visible ? <EyeOff className="size-icon-sm" /> : <Eye className="size-icon-sm" />}
        </button>
      </div>
      <FieldError id={`${id}-error`} messages={errors} />
    </div>
  );
}

export function GoogleButton() {
  const t = useTranslations("auth");
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" variant="outline" size="lg" className="w-full short:h-control-lg">
        {t("form.continueWithGoogle")}
      </Button>
    </form>
  );
}

export function OrDivider() {
  const t = useTranslations("auth");
  return (
    <div className="flex items-center gap-sm text-caption text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {t("form.or")}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
