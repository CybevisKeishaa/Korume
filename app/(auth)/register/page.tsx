import { AuthForm } from "@/components/auth/auth-form";
import { Container } from "@/components/ui/container";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <Container className="flex min-h-[80vh] max-w-md flex-col justify-center py-12">
      <h1 className="text-2xl font-bold">Start your 7-day trial</h1>
      <p className="mt-2 text-muted-foreground">
        No card required. Learn Japanese through real video.
      </p>
      <div className="mt-8">
        <AuthForm mode="register" />
      </div>
    </Container>
  );
}
