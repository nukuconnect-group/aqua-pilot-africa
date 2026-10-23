export interface Installment { n: number; date: string; amount: number; remaining: number }

/** Échéancier d'un prêt sans intérêt : mensualités égales, la dernière absorbe l'arrondi. */
export const loanSchedule = (amount: number, months: number, startDate: string): Installment[] => {
  if (!(amount > 0) || !(months > 0)) return [];
  const n = Math.floor(months);
  const base = Math.floor(amount / n);
  const start = new Date(startDate);
  let remaining = amount;
  return Array.from({ length: n }, (_, i) => {
    const pay = i === n - 1 ? remaining : base;
    remaining = Math.round((remaining - pay) * 100) / 100;
    const d = new Date(start.getFullYear(), start.getMonth() + i, Math.min(start.getDate(), 28));
    return { n: i + 1, date: d.toISOString().slice(0, 10), amount: pay, remaining };
  });
};
