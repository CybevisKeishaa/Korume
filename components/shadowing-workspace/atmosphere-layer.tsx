"use client";

import type { StudyAtmosphere } from "@/lib/preferences/options";

/** The places whose document lists ambient particles that read as the place (rain, petals, fireflies). */
const PARTICLES: ReadonlySet<StudyAtmosphere> = new Set(["rainy_day", "spring_morning", "summer_night"]);
const PARTICLE_COUNT = 12;

/**
 * The Study Environment backdrop (spec §6.2): glow and temperature from the `--atmosphere-*` tokens, behind
 * every workspace surface, never a target and never in the accessibility tree. Particles are CSS-only, at
 * most 12, and are not rendered at all under Reduce Motion (globals.css also removes them for the OS
 * setting and the app toggle).
 */
export function AtmosphereLayer({ atmosphere, reduceMotion }: { atmosphere: StudyAtmosphere; reduceMotion: boolean }) {
  if (atmosphere === "none") return null;
  return (
    <div aria-hidden="true" className="atmosphere-layer pointer-events-none absolute inset-0 -z-10 overflow-hidden" data-testid="atmosphere-layer">
      {PARTICLES.has(atmosphere) && !reduceMotion && (
        <div className="atmosphere-particles absolute inset-0">
          {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
            // Spread across the width and staggered in time; a negative delay starts each one mid-flight.
            <span key={index} style={{ left: `${(index * 37 + 11) % 100}%`, animationDelay: `${-index * 1.3}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
