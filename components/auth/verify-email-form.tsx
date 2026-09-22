"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { resendCode, type ResendState, verifyEmail, type AuthState } from "@/app/[locale]/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { FieldError, FormError } from "./form-parts";
import { OtpInput } from "./otp-input";

const initialAuthState: AuthState = {};
const initialResendState: ResendState = {};

export function VerifyEmailForm({
  email,
  initialCooldown,
}: {
  email: string;
  initialCooldown: boolean;
}) {
  const [verifyState, verifyAction] = useFormState(verifyEmail, initialAuthState);
  const [resendState, resendAction] = useFormState(resendCode, initialResendState);
  const [secondsLeft, setSecondsLeft] = useState(initialCooldown ? 60 : 0);
  const previousResendState = useRef<ResendState>();
  const submitRef = useRef<HTMLButtonElement>(null);
  const t = useTranslations("auth");

  useEffect(() => {
    if (
      (resendState.status === "sent" || resendState.status === "rateLimited") &&
      previousResendState.current !== resendState
    ) {
      previousResendState.current = resendState;
      setSecondsLeft(60);
    }
  }, [resendState]);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((seconds) => Math.max(0, seconds - 1));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [secondsLeft]);

  return (
    <div className="space-y-lg">
      <p className="rounded-md bg-muted px-md py-sm text-body text-foreground">{email}</p>
      <form action={verifyAction} className="space-y-md" noValidate>
        <input type="hidden" name="email" value={email} />
        <FormError message={verifyState.error} />
        <OtpInput
          name="token"
          errorId="token-error"
          invalid={Boolean(verifyState.fieldErrors?.token?.length)}
          onComplete={() => submitRef.current?.focus()}
        />
        <FieldError id="token-error" messages={verifyState.fieldErrors?.token} />
        <Button ref={submitRef} type="submit" size="lg" className="w-full">
          {t("verify.submit")}
        </Button>
      </form>
      <div className="space-y-sm">
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="outline" size="lg" className="w-full" disabled={secondsLeft > 0}>
            {secondsLeft > 0 ? t("verify.resendIn", { seconds: secondsLeft }) : t("verify.resend")}
          </Button>
        </form>
        {resendState.status === "rateLimited" ? (
          <p role="alert" className="text-body text-danger-strong">
            {t("verify.rateLimited")}
          </p>
        ) : null}
        <Link href="/register" className="block text-center text-body text-primary-strong hover:underline">
          {t("verify.changeEmail")}
        </Link>
      </div>
    </div>
  );
}
