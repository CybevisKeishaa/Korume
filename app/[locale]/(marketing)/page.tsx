import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { Journey } from "@/components/marketing/journey";
import { PitchShowcase } from "@/components/marketing/pitch-showcase";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <Journey />
      <PitchShowcase />
    </main>
  );
}
