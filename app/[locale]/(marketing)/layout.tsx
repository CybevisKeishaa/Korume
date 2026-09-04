import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { revealFailsafeScript } from "@/components/motion/reveal-failsafe";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      {/* Inline, not bundled: it exists to rescue the page when the bundle is
          what failed, so it cannot be delivered by the bundle. It only ever
          RELEASES the hidden state — arming happens before paint in
          themeInitScript — which is why running this late is harmless and why
          it sits here rather than in the app-wide <head>. Its docblock carries
          the reasoning.

          ⚠️ This sits in the LAYOUT while `RevealScope` is mounted by the PAGE,
          deliberately (reveal-scope.tsx says why: no other marketing route
          should silently inherit the entrance). `(marketing)` has exactly one
          route today, so the asymmetry is inert. The SECOND marketing route
          makes it live: it would set `data-reveal-failsafe` on <html> a few
          seconds into every load, the attribute is never removed, and a later
          soft navigation to `/` would find it set and skip the entrance
          entirely. Move this to the page, or clear the attribute, at that
          point — not before, when there is nothing to test it against. */}
      <script dangerouslySetInnerHTML={{ __html: revealFailsafeScript }} />
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
