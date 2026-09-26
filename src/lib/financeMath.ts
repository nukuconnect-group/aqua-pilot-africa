/** Calculs financiers purs (VAN, TRI) — aucune donnée inventée. */
export interface DatedFlow { months: number; amount: number } // months depuis t0

export const npv = (annualRate: number, flows: DatedFlow[]): number =>
  flows.reduce((s, f) => s + f.amount / Math.pow(1 + annualRate, f.months / 12), 0);

/** TRI annuel par dichotomie. Retourne null si non calculable (pas de changement de signe). */
export const irr = (flows: DatedFlow[]): number | null => {
  const hasNeg = flows.some(f => f.amount < 0);
  const hasPos = flows.some(f => f.amount > 0);
  if (!hasNeg || !hasPos) return null;
  let lo = -0.99, hi = 10;
  let fLo = npv(lo, flows), fHi = npv(hi, flows);
  if (fLo * fHi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, flows);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) { hi = mid; fHi = fMid; } else { lo = mid; fLo = fMid; }
  }
  return (lo + hi) / 2;
};

export const monthsBetween = (from: string, to: string) => {
  const a = new Date(from), b = new Date(to);
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) + (b.getDate() - a.getDate()) / 30;
};

export const pct = (part: number, whole: number): number | null => (whole ? (part / whole) * 100 : null);
