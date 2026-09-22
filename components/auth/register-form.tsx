"use client";

import { useFormState } from "react-dom";
import { register, type AuthState } from "@/app/[locale]/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import {
  FormError,
  FieldError,
  GoogleButton,
  OrDivider,
  PasswordField,
  SubmitButton,
} from "./form-parts";

const initialState: AuthState = {};

export function RegisterForm() {
  const [state, formAction] = useFormState(register, initialState);
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  return (
    <div className="space-y-lg">
      <form action={formAction} className="space-y-md" noValidate>
        <FormError message={state.error} />
        <div className="space-y-xs">
          <Label htmlFor="name">{t("form.nameLabel")}</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            aria-invalid={!!state.fieldErrors?.name}
            aria-describedby="name-error"
          />
          <FieldError id="name-error" messages={state.fieldErrors?.name} />
        </div>
        <div className="space-y-xs">
          <Label htmlFor="email">{t("form.emailLabel")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!state.fieldErrors?.email}
            aria-describedby="email-error"
          />
          <FieldError id="email-error" messages={state.fieldErrors?.email} />
        </div>
        <PasswordField
          id="password"
          name="password"
          label={t("form.passwordLabel")}
          autoComplete="new-password"
          errors={state.fieldErrors?.password}
        />
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label={t("form.confirmPasswordLabel")}
          autoComplete="new-password"
          errors={state.fieldErrors?.confirmPassword}
        />
        <SubmitButton label={tCommon("auth.signUp")} />
      </form>
      <OrDivider />
      <GoogleButton />
      <p className="text-center text-body text-muted-foreground">
        {t("form.hasAccount")} {" "}
        <Link href="/login" className="font-medium text-primary-strong hover:underline">
          {tCommon("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}
