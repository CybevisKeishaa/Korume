import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SmoothScroll } from "@/components/motion/smooth-scroll";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </SmoothScroll>
  );
}
