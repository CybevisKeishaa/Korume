"use client";

import { useFormState } from "react-dom";
import { requestPasswordReset, type ResetRequestState } from "@/app/[locale]/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { FieldError, SubmitButton } from "./form-parts";

const initialState: ResetRequestState = {};

export function ForgotPasswordForm() {
  const [state, formAction] = useFormState(requestPasswordReset, initialState);
  const t = useTranslations("auth");

  if (state.sent) {
    return (
      <div className="space-y-lg">
        <p role="status" className="text-body text-muted-foreground">{t("forgotPassword.sent")}</p>
        <Link href="/login" className="block text-center text-body text-primary-strong hover:underline">
          {t("forgotPassword.backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      <form action={formAction} className="space-y-md" noValidate>
        <div className="space-y-xs">
          <Label htmlFor="email">{t("form.emailLabel")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={Boolean(state.fieldErrors?.email?.length)}
            aria-describedby="email-error"
          />
          <FieldError id="email-error" messages={state.fieldErrors?.email} />
        </div>
        <SubmitButton label={t("forgotPassword.submit")} />
      </form>
      <Link href="/login" className="block text-center text-body text-primary-strong hover:underline">
        {t("forgotPassword.backToLogin")}
      </Link>
    </div>
  );
}
