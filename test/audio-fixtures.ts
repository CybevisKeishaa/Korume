/**
 * Synthetic audio generator for deterministic pitch (F0) unit tests.
 *
 * A pure sine tone has a known, exact fundamental frequency, so an F0
 * extractor can be asserted against it without any recorded/real audio
 * fixture (CLAUDE.md §7 — deterministic tests for pitch logic).
 */

/**
 * Generates `seconds` of a pure sine wave at `freqHz`, sampled at
 * `sampleRate`, amplitude 1, phase 0.
 *
 * @throws RangeError if `freqHz`/`sampleRate` are not positive or `seconds` is negative.
 */
export function makeToneBuffer(
  freqHz: number,
  sampleRate: number,
  seconds: number,
): Float32Array {
  if (!(freqHz > 0)) {
    throw new RangeError(`freqHz must be > 0, got ${freqHz}`);
  }
  if (!(sampleRate > 0)) {
    throw new RangeError(`sampleRate must be > 0, got ${sampleRate}`);
  }
  if (!(seconds >= 0)) {
    throw new RangeError(`seconds must be >= 0, got ${seconds}`);
  }

  const length = Math.round(sampleRate * seconds);
  const buffer = new Float32Array(length);
  const angularFreq = (2 * Math.PI * freqHz) / sampleRate;
  for (let i = 0; i < length; i++) {
    buffer[i] = Math.sin(angularFreq * i);
  }
  return buffer;
}

/**
 * Generates `seconds` of digital silence at `sampleRate` — useful as a
 * negative fixture for F0/voiced-detection tests (no pitch should be
 * reported for silence).
 */
export function makeSilenceBuffer(
  sampleRate: number,
  seconds: number,
): Float32Array {
  if (!(sampleRate > 0)) {
    throw new RangeError(`sampleRate must be > 0, got ${sampleRate}`);
  }
  if (!(seconds >= 0)) {
    throw new RangeError(`seconds must be >= 0, got ${seconds}`);
  }
  return new Float32Array(Math.round(sampleRate * seconds));
}
