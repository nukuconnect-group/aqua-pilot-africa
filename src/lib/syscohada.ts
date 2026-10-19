// Comptabilité SYSCOHADA révisé (AUDCIF 2017) générée depuis les opérations déjà saisies.

export const CHART: Record<string, string> = {
  '101': 'Capital social', '121': 'Report à nouveau', '131': 'Résultat net',
  '401': 'Fournisseurs', '411': 'Clients', '421': 'Personnel, rémunérations dues',
  '521': 'Banques', '5212': 'Mobile Money', '571': 'Caisse',
  '601': 'Achats de marchandises', '602': 'Achats de matières premières (alevins, aliments)',
  '604': 'Achats stockés de matières et fournitures', '605': 'Autres achats (eau, énergie, carburant)',
  '622': 'Locations et charges locatives', '624': 'Entretien, réparations et maintenance',
  '627': 'Publicité', '628': 'Frais de télécommunications', '631': 'Frais bancaires',
  '638': 'Autres charges externes', '641': 'Impôts et taxes',
  '661': 'Rémunérations du personnel', '664': 'Charges sociales', '681': 'Dotations aux amortissements',
  '701': 'Ventes de marchandises', '702': 'Ventes de produits finis', '706': 'Services vendus',
  '707': 'Produits accessoires', '758': 'Produits divers',
};

export type JournalCode = 'VT' | 'AC' | 'CA' | 'BQ' | 'OD';
export const JOURNALS: Record<JournalCode, string> = {
  VT: 'Journal des ventes', AC: 'Journal des achats', CA: 'Journal de caisse', BQ: 'Journal de banque', OD: 'Opérations diverses',
};

export interface EntryLine { account: string; debit: number; credit: number }
export interface Entry { id: string; date: string; journal: JournalCode; label: string; ref?: string; lines: EntryLine[] }

export const treasuryAccount = (method?: string) => {
  const m = (method || '').toLowerCase();
  if (m.includes('mobile')) return '5212';
  if (m.includes('vir') || m.includes('carte') || m.includes('chèque') || m.includes('cheque') || m.includes('banq')) return '521';
  return '571';
};

export const expenseAccount = (category?: string) => {
  const c = (category || '').toLowerCase();
  if (/alevin|aliment|provende|semence|intrant|nutriment/.test(c)) return '602';
  if (/salaire|personnel|paie|rh/.test(c)) return '661';
  if (/social|cnss/.test(c)) return '664';
  if (/eau|énergie|energie|électric|electric|carbur/.test(c)) return '605';
  if (/loyer|location/.test(c)) return '622';
  if (/entretien|répar|repar|maintenance/.test(c)) return '624';
  if (/pub|marketing/.test(c)) return '627';
  if (/télé|tele|internet/.test(c)) return '628';
  if (/banc|frais bancaires/.test(c)) return '631';
  if (/impôt|impot|taxe/.test(c)) return '641';
  if (/amort/.test(c)) return '681';
  if (/matériel|materiel|fourniture|équipement|equipement|médic|medic|traitement/.test(c)) return '604';
  return '638';
};

const jFor = (acc: string): JournalCode => (acc === '571' ? 'CA' : 'BQ');

interface SaleIn { id: string; date: string; clientName: string; totalAmount: number; paidAmount?: number; isCredit?: boolean; paymentMethod?: string; status: string; documentNumber?: string }
interface PurchaseIn { id: string; date: string; category: string; description: string; supplier: string; amount: number; paymentMethod: string; status?: string }
interface TxIn { id: string; date: string; type: 'revenue' | 'expense'; category: string; description: string; amount: number; paymentMethod: string; status: string }

export const SALE_TX_CATEGORY = 'Vente de poissons';

export function buildEntries(sales: SaleIn[], purchases: PurchaseIn[], transactions: TxIn[]): Entry[] {
  const out: Entry[] = [];
  for (const s of sales) {
    if (!(s.status === 'confirmed' || s.status === 'paid' || s.status === 'delivered') || !(s.totalAmount > 0)) continue;
    out.push({ id: `vt-${s.id}`, date: s.date, journal: 'VT', label: `Vente ${s.clientName}`, ref: s.documentNumber,
      lines: [{ account: '411', debit: s.totalAmount, credit: 0 }, { account: '702', debit: 0, credit: s.totalAmount }] });
    const paid = s.isCredit ? (s.paidAmount || 0) : s.totalAmount;
    if (paid > 0) {
      const t = treasuryAccount(s.paymentMethod);
      out.push({ id: `rg-${s.id}`, date: s.date, journal: jFor(t), label: `Règlement ${s.clientName}`, ref: s.documentNumber,
        lines: [{ account: t, debit: paid, credit: 0 }, { account: '411', debit: 0, credit: paid }] });
    }
  }
  for (const p of purchases) {
    if (p.status === 'cancelled' || !(p.amount > 0)) continue;
    const acc = expenseAccount(p.category);
    out.push({ id: `ac-${p.id}`, date: p.date, journal: 'AC', label: `${p.description || p.category} — ${p.supplier || ''}`.trim(),
      lines: [{ account: acc, debit: p.amount, credit: 0 }, { account: '401', debit: 0, credit: p.amount }] });
    if (p.status === 'received' || p.status === 'paid' || !p.status) {
      const t = treasuryAccount(p.paymentMethod);
      out.push({ id: `pf-${p.id}`, date: p.date, journal: jFor(t), label: `Paiement ${p.supplier || p.category}`,
        lines: [{ account: '401', debit: p.amount, credit: 0 }, { account: t, debit: 0, credit: p.amount }] });
    }
  }
  for (const tx of transactions) {
    if (tx.status === 'cancelled' || !(tx.amount > 0) || tx.category === SALE_TX_CATEGORY) continue;
    const t = treasuryAccount(tx.paymentMethod);
    const lines: EntryLine[] = tx.type === 'revenue'
      ? [{ account: t, debit: tx.amount, credit: 0 }, { account: '758', debit: 0, credit: tx.amount }]
      : [{ account: expenseAccount(tx.category), debit: tx.amount, credit: 0 }, { account: t, debit: 0, credit: tx.amount }];
    out.push({ id: `tx-${tx.id}`, date: tx.date, journal: jFor(t), label: tx.description || tx.category, lines });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface BalanceRow { account: string; name: string; debit: number; credit: number; soldeD: number; soldeC: number }
export function trialBalance(entries: Entry[]): BalanceRow[] {
  const m = new Map<string, { d: number; c: number }>();
  entries.forEach((e) => e.lines.forEach((l) => {
    const v = m.get(l.account) || { d: 0, c: 0 };
    v.d += l.debit; v.c += l.credit; m.set(l.account, v);
  }));
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([account, v]) => ({
    account, name: CHART[account] || account, debit: v.d, credit: v.c,
    soldeD: Math.max(0, v.d - v.c), soldeC: Math.max(0, v.c - v.d),
  }));
}

export function incomeStatement(rows: BalanceRow[]) {
  const produits = rows.filter((r) => r.account.startsWith('7')).reduce((s, r) => s + r.credit - r.debit, 0);
  const charges = rows.filter((r) => r.account.startsWith('6')).reduce((s, r) => s + r.debit - r.credit, 0);
  return { produits, charges, resultat: produits - charges };
}
