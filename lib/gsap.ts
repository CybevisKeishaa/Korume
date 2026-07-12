import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let registered = false;

/**
 * Lazily register GSAP plugins (client-only). Scroll-driven learning demos
 * (stroke order, pitch contour, landing storytelling) build on this.
 * Callers must still gate animation on reduce-motion.
 */
export function registerGsap(): typeof gsap {
  if (typeof window !== "undefined" && !registered) {
    gsap.registerPlugin(ScrollTrigger);
    registered = true;
  }
  return gsap;
}

export { gsap, ScrollTrigger };
