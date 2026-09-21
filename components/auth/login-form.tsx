"use client";

import { useFormState } from "react-dom";
import { login, type AuthState } from "@/app/[locale]/(auth)/actions";
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

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction] = useFormState(login, initialState);
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  return (
    <div className="space-y-lg">
      <form action={formAction} className="space-y-md" noValidate>
        {redirectTo ? <input type="hidden" name="redirectTo" value={redirectTo} /> : null}
        <FormError message={state.error} />
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
          autoComplete="current-password"
          errors={state.fieldErrors?.password}
        />
        <SubmitButton label={tCommon("auth.signIn")} />
      </form>
      <OrDivider />
      <GoogleButton />
      <p className="text-center text-body text-muted-foreground">
        {t("form.newHere")} {" "}
        <Link href="/register" className="font-medium text-primary-strong hover:underline">
          {t("form.createAnAccount")}
        </Link>
      </p>
    </div>
  );
}
