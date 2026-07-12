"use client";

import { motion } from "framer-motion";
import { useTheme } from "@/components/providers/theme-provider";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to delay the entrance. */
  delay?: number;
}

/**
 * Fade + rise on scroll into view. Under reduce-motion it renders the content
 * statically (fully visible, no transform) so nothing is hidden or animated.
 */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  const { reduceMotion } = useTheme();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
