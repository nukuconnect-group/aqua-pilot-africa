import type { EntryLine } from './syscohada';

export type MovementKind = 'opening' | 'receipt' | 'payment' | 'transfer';
export interface TreasuryAccount {
  id: string; user_id: string; unit_id: string; name: string; kind: 'cash' | 'bank'; account_code: string; currency: string;
}
export interface TreasuryMovement {
  id: string; unit_id: string; kind: MovementKind; source_id: string | null; destination_id: string | null;
  amount: number; date: string; label: string; journal: 'AN' | 'CA' | 'BQ'; lines: EntryLine[];
}
export const accountBalance = (id: string, movements: TreasuryMovement[]) => movements.reduce((balance, m) =>
  balance + (m.destination_id === id ? Number(m.amount) : 0) - (m.source_id === id ? Number(m.amount) : 0), 0);

export function movementLines(kind: MovementKind, amount: number, source?: TreasuryAccount, destination?: TreasuryAccount, counterpart?: string): EntryLine[] {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Le montant doit être positif.');
  const needsSource = kind === 'payment' || kind === 'transfer';
  const needsDestination = kind !== 'payment';
  if (needsSource && !source) throw new Error('Choisissez le compte source.');
  if (needsDestination && !destination) throw new Error('Choisissez le compte destinataire.');
  if (kind === 'transfer' && source && destination) {
    if (source.id === destination.id || source.account_code === destination.account_code) throw new Error('Choisissez deux comptes distincts.');
    if (source.unit_id !== destination.unit_id || source.user_id !== destination.user_id) throw new Error('Les comptes doivent appartenir à la même unité.');
    if (source.currency !== destination.currency) throw new Error('Les comptes doivent utiliser la même devise.');
  } else if (!counterpart || !/^[1-8][0-9]{2,7}$/.test(counterpart) || counterpart.startsWith('5')) {
    throw new Error('Choisissez une contrepartie hors trésorerie ; utilisez Transférer entre deux comptes.');
  }
  const debit = kind === 'payment' ? counterpart : destination?.account_code;
  const credit = needsSource ? source?.account_code : counterpart;
  if (!debit || !credit) throw new Error('Comptes comptables manquants.');
  return [{ account: debit, debit: amount, credit: 0 }, { account: credit, debit: 0, credit: amount }];
}