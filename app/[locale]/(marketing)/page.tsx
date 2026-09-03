import { Hero } from "@/components/marketing/hero";
import { Problem } from "@/components/marketing/problem";
import { Journey } from "@/components/marketing/journey";
import { PitchShowcase } from "@/components/marketing/pitch-showcase";
import { Recommendation } from "@/components/marketing/recommendation";
import { CapabilityChain } from "@/components/marketing/capability-chain";
import { Trust } from "@/components/marketing/trust";
import { Cta } from "@/components/marketing/cta";
import { Signoff } from "@/components/marketing/signoff";
import { RevealScope } from "@/components/motion/reveal-scope";

export default function LandingPage() {
  // `data-reveal-scope` is what lets `Section`'s `data-reveal="pending"` mean
  // anything: the hidden state in globals.css is gated on this ancestor, so a
  // marketing page that never mounts `RevealScope` cannot hold its own content
  // at opacity 0 (Task A-MOTION).
  return (
    <main data-reveal-scope>
      <RevealScope />
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
