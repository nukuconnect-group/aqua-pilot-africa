/** Calculs de caisse à solde permanent (aucun montant inventé : tout vient des mouvements enregistrés). */
export interface BalanceMovement { type: 'sale' | 'cash_in' | 'cash_out'; amount: number; payment_method: string; label?: string | null }
export interface ClosedSessionLike { name: string | null; status: string; closed_at: string | null; opened_at: string; counted_amount: number | null }

const isTransfer = (m: BalanceMovement) => /^transfert/i.test(m.label || '');

export const summarizeSession = (opening: number, movements: BalanceMovement[]) => {
  const salesByPayment: Record<string, number> = {};
  let sales = 0, cashIn = 0, cashOut = 0, transfersIn = 0, transfersOut = 0;
  movements.forEach((m) => {
    if (m.type === 'sale') { sales += m.amount; salesByPayment[m.payment_method] = (salesByPayment[m.payment_method] || 0) + m.amount; }
    else if (m.type === 'cash_in') { if (isTransfer(m)) transfersIn += m.amount; else cashIn += m.amount; }
    else if (m.payment_method === 'Espèces') { if (isTransfer(m)) transfersOut += m.amount; else cashOut += m.amount; }
  });
  const cashSales = salesByPayment['Espèces'] || 0;
  const expected = opening + cashSales + cashIn + transfersIn - cashOut - transfersOut;
  return { opening, sales, salesByPayment, cashSales, cashIn, cashOut, transfersIn, transfersOut, expected };
};

/** Écart = physique déclaré − théorique. */
export const cashDifference = (counted: number, expected: number) => Math.round((counted - expected) * 100) / 100;

/** Solde repris à la réouverture : montant physique déclaré à la dernière clôture de la même caisse. */
export const carriedOverBalance = (history: ClosedSessionLike[], name: string) => {
  const key = name.trim().toLowerCase();
  const last = history
    .filter((s) => s.status === 'closed' && (s.name || '').trim().toLowerCase() === key && s.counted_amount != null)
    .sort((a, b) => new Date(b.closed_at || b.opened_at).getTime() - new Date(a.closed_at || a.opened_at).getTime())[0];
  return last ? Number(last.counted_amount) : null;
};
