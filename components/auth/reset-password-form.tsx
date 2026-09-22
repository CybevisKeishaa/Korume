"use client";

import { useFormState } from "react-dom";
import { type AuthState, updatePassword } from "@/app/[locale]/(auth)/actions";
import { useTranslations } from "@/lib/i18n";
import { FormError, PasswordField, SubmitButton } from "./form-parts";

const initialState: AuthState = {};

export function ResetPasswordForm() {
  const [state, formAction] = useFormState(updatePassword, initialState);
  const t = useTranslations("auth");

  return (
    <form action={formAction} className="space-y-md" noValidate>
      <FormError message={state.error} />
      <PasswordField
        id="new-password"
        name="password"
        label={t("resetPassword.newPassword")}
        autoComplete="new-password"
        errors={state.fieldErrors?.password}
      />
      <PasswordField
        id="confirm-new-password"
        name="confirmPassword"
        label={t("resetPassword.confirmNewPassword")}
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton label={t("resetPassword.submit")} />
    </form>
  );
}
