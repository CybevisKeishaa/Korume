/** Client-safe seeded permutation of 0..n-1 (FNV-1a seed hash -> mulberry32 -> Fisher-Yates). */
export function bankOrder(n: number, seed: string): number[] {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193) >>> 0;
  let a = h;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const x = order[i] ?? 0;
    order[i] = order[j] ?? 0;
    order[j] = x;
  }
  // the bank must never show the answer order
  if (n > 1 && order.every((v, i) => v === i)) order.push(order.shift() ?? 0);
  return order;
}
