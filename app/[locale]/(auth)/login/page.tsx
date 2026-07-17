import { AuthForm } from "@/components/auth/auth-form";
import { Container } from "@/components/ui/container";

export const metadata = { title: "Sign in" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string; checkEmail?: string };
}) {
  return (
    <Container className="flex min-h-[80vh] max-w-md flex-col justify-center py-12">
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">
        Sign in to keep your streak going.
      </p>
      {searchParams.checkEmail ? (
        <p className="mt-4 rounded-md bg-accent/10 px-3 py-2 text-sm text-foreground">
          Check your email to confirm your account, then sign in.
        </p>
      ) : null}
      <div className="mt-8">
        <AuthForm mode="login" redirectTo={searchParams.redirectTo} />
      </div>
    </Container>
  );
}
