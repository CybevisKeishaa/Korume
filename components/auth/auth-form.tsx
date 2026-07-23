"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import {
  login,
  register,
  signInWithGoogle,
  type AuthState,
} from "@/app/[locale]/(auth)/actions";
import { Button, buttonStyles } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: AuthState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("auth");
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? t("form.pending") : label}
    </Button>
  );
}

function FieldError({ id, messages }: { id: string; messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p id={id} role="alert" className="text-sm text-danger-strong">
      {messages[0]}
    </p>
  );
}

export function AuthForm({
  mode,
  redirectTo,
}: {
  mode: "login" | "register";
  redirectTo?: string;
}) {
  const action = mode === "login" ? login : register;
  const [state, formAction] = useFormState(action, initialState);
  const isRegister = mode === "register";
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4" noValidate>
        {redirectTo ? (
          <input type="hidden" name="redirectTo" value={redirectTo} />
        ) : null}

        {state.error ? (
          <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger-strong">
            {state.error}
          </p>
        ) : null}

        {isRegister && (
          <div className="space-y-1.5">
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
        )}

        <div className="space-y-1.5">
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

        <div className="space-y-1.5">
          <Label htmlFor="password">{t("form.passwordLabel")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby="password-error"
          />
          <FieldError id="password-error" messages={state.fieldErrors?.password} />
        </div>

        <SubmitButton
          label={isRegister ? tCommon("auth.signUp") : tCommon("auth.signIn")}
        />
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("form.or")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          {t("form.continueWithGoogle")}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isRegister ? (
          <>
            {t("form.hasAccount")}{" "}
            <Link href="/login" className="font-medium text-primary-strong hover:underline">
              {tCommon("auth.signIn")}
            </Link>
          </>
        ) : (
          <>
            {t("form.newHere")}{" "}
            <Link href="/register" className="font-medium text-primary-strong hover:underline">
              {t("form.createAnAccount")}
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
