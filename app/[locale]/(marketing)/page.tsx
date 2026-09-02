import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { Journey } from "@/components/marketing/journey";
import { PitchShowcase } from "@/components/marketing/pitch-showcase";
import { Recommendation } from "@/components/marketing/recommendation";
import { CapabilityChain } from "@/components/marketing/capability-chain";
import { Trust } from "@/components/marketing/trust";
import { Cta } from "@/components/marketing/cta";
import { Signoff } from "@/components/marketing/signoff";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Problem />
      <Journey />
      <PitchShowcase />
      <Recommendation />
      <CapabilityChain />
      <Trust />
      <Cta />
      <Signoff />
    </main>
  );
}
