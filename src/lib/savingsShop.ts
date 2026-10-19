export interface SavingsTx { member_id: string; agent_id: string | null; type: 'deposit' | 'withdrawal'; amount: number; date: string }

/** Solde d'un adhérent : dépôts − retraits. */
export const memberBalance = (memberId: string, txs: SavingsTx[]) =>
  txs.filter((t) => t.member_id === memberId)
    .reduce((s, t) => s + (t.type === 'deposit' ? Number(t.amount) : -Number(t.amount)), 0);

/** Un retrait ne peut pas dépasser le solde disponible. */
export const canWithdraw = (balance: number, amount: number) => amount > 0 && amount <= balance;

/** Collecte d'un agent sur une période et commission (taux en %). */
export const agentCollection = (agentId: string, rate: number, txs: SavingsTx[], from: string, to: string) => {
  const collected = txs
    .filter((t) => t.agent_id === agentId && t.type === 'deposit' && t.date >= from && t.date <= to)
    .reduce((s, t) => s + Number(t.amount), 0);
  return { collected, commission: Math.round(collected * rate) / 100 };
};

export interface OrderItem { product_id: string; name: string; quantity: number; unit_price: number }
export const orderTotal = (items: OrderItem[]) => items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

export const isMissingTable = (err: any) =>
  !!err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message || ''));
