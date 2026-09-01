import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { Journey } from "@/components/marketing/journey";
import { PitchShowcase } from "@/components/marketing/pitch-showcase";
import { Recommendation } from "@/components/marketing/recommendation";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <Journey />
      <PitchShowcase />
      <Recommendation />
    </main>
  );
}
