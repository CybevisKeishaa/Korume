import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

export default function LandingPage() {
  return (
    <main>
      <Container className="flex min-h-[80vh] flex-col items-center justify-center py-24 text-center">
        <p className="mb-4 font-jp text-sm tracking-widest text-primary">
          日本語シネマ
        </p>
        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight sm:text-6xl">
          Learn Japanese the way it&rsquo;s actually spoken.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Shadow real video, master kanji and grammar, and track it all with a
          spaced-repetition engine built for retention.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link href="/register" className={buttonStyles({ size: "lg" })}>
            Start free trial
          </Link>
          <Link
            href="/login"
            className={buttonStyles({ size: "lg", variant: "outline" })}
          >
            Sign in
          </Link>
        </div>
      </Container>
    </main>
  );
}
