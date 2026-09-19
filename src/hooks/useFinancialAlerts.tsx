import { useMemo } from 'react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSales } from '@/hooks/useSales';
import { formatMoney } from '@/lib/currency';

export type FinancialAlertLevel = 'critical' | 'warning' | 'info';

export interface FinancialAlert {
  id: string;
  level: FinancialAlertLevel;
  category: 'echeance' | 'paiement' | 'depense' | 'facture' | 'revenu' | 'anomalie';
  title: string;
  message: string;
  amount?: number;
  date?: string;
}

const daysBetween = (from: Date, to: Date) =>
  Math.round((to.getTime() - from.getTime()) / 86_400_000);

/**
 * Alertes financières générées uniquement à partir des données réelles
 * (transactions comptables, achats, ventes) de l'unité active.
 */
export const useFinancialAlerts = (unitId?: string) => {
  const { transactions, purchases } = useProductionUnits();
  const { allSales } = useSales();

  const alerts = useMemo<FinancialAlert[]>(() => {
    const now = new Date();
    const list: FinancialAlert[] = [];

    const tx = (transactions || []).filter(t => !unitId || t.unitId === unitId);
    const pu = (purchases || []).filter(p => !unitId || p.unitId === unitId);
    const sl = (allSales || []).filter(s => !unitId || s.unitId === unitId);

    // --- Factures clients impayées / échues ---
    sl.forEach(sale => {
      const paid = sale.paidAmount ?? (sale.status === 'paid' ? sale.totalAmount : 0);
      const remaining = Math.max(0, (sale.totalAmount || 0) - paid);
      if (remaining <= 0) return;

      const due = sale.dueDate ? new Date(sale.dueDate) : null;
      const label = sale.documentNumber || sale.id.slice(0, 8);

      if (due && due < now) {
        list.push({
          id: `sale-overdue-${sale.id}`,
          level: 'critical',
          category: 'facture',
          title: `Facture impayée ${label}`,
          message: `${sale.clientName} — échéance dépassée de ${daysBetween(due, now)} jour(s). Reste à encaisser : ${formatMoney(remaining)}`,
          amount: remaining,
          date: sale.dueDate,
        });
      } else if (due && daysBetween(now, due) <= 7) {
        list.push({
          id: `sale-due-${sale.id}`,
          level: 'warning',
          category: 'echeance',
          title: `Échéance proche ${label}`,
          message: `${sale.clientName} — paiement attendu le ${due.toLocaleDateString()} : ${formatMoney(remaining)}`,
          amount: remaining,
          date: sale.dueDate,
        });
      } else if (sale.isCredit || sale.status === 'pending') {
        list.push({
          id: `sale-pending-${sale.id}`,
          level: 'info',
          category: 'paiement',
          title: `Paiement en attente ${label}`,
          message: `${sale.clientName} — ${formatMoney(remaining)} restant à encaisser`,
          amount: remaining,
          date: sale.date,
        });
      }
    });

    // --- Achats fournisseurs à régler ---
    pu.forEach(purchase => {
      const paid = purchase.paidAmount ?? 0;
      const remaining = Math.max(0, (purchase.amount || 0) - paid);
      const due = purchase.dueDate ? new Date(purchase.dueDate) : null;
      if (remaining <= 0) return;

      if (due && due < now) {
        list.push({
          id: `purchase-overdue-${purchase.id}`,
          level: 'critical',
          category: 'echeance',
          title: `Dette fournisseur échue`,
          message: `${purchase.supplier || 'Fournisseur'} — ${formatMoney(remaining)} en retard depuis ${daysBetween(due, now)} jour(s)`,
          amount: remaining,
          date: purchase.dueDate,
        });
      } else if (purchase.isCredit || purchase.status === 'pending') {
        list.push({
          id: `purchase-pending-${purchase.id}`,
          level: 'warning',
          category: 'paiement',
          title: `Achat à régler`,
          message: `${purchase.supplier || 'Fournisseur'} — ${formatMoney(remaining)}${due ? ` avant le ${due.toLocaleDateString()}` : ''}`,
          amount: remaining,
          date: purchase.dueDate || purchase.date,
        });
      }
    });

    // --- Transactions comptables en attente ---
    tx.filter(t => t.status === 'pending').forEach(t => {
      list.push({
        id: `tx-pending-${t.id}`,
        level: 'info',
        category: 'paiement',
        title: `Transaction en attente`,
        message: `${t.description || t.category} — ${formatMoney(t.amount)}`,
        amount: t.amount,
        date: t.date,
      });
    });

    // --- Dépenses importantes (30 derniers jours, au-dessus du triple de la moyenne) ---
    const recentExpenses = tx.filter(t => {
      if (t.type !== 'expense' || t.status === 'cancelled') return false;
      return daysBetween(new Date(t.date), now) <= 30;
    });
    if (recentExpenses.length >= 3) {
      const avg = recentExpenses.reduce((s, t) => s + (t.amount || 0), 0) / recentExpenses.length;
      recentExpenses
        .filter(t => t.amount > avg * 3)
        .forEach(t => {
          list.push({
            id: `expense-high-${t.id}`,
            level: 'warning',
            category: 'depense',
            title: `Dépense importante`,
            message: `${t.description || t.category} — ${formatMoney(t.amount)} (moyenne du mois : ${formatMoney(Math.round(avg))})`,
            amount: t.amount,
            date: t.date,
          });
        });
    }

    // --- Solde et rentabilité du mois en cours ---
    const monthTx = tx.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status !== 'cancelled';
    });
    const monthRevenue = monthTx.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amount || 0), 0);
    const monthExpense = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);

    if (monthTx.length > 0 && monthExpense > monthRevenue) {
      list.push({
        id: 'month-negative-balance',
        level: 'critical',
        category: 'anomalie',
        title: 'Solde du mois négatif',
        message: `Dépenses ${formatMoney(monthExpense)} supérieures aux revenus ${formatMoney(monthRevenue)}`,
        amount: monthExpense - monthRevenue,
      });
    } else if (monthRevenue > 0) {
      list.push({
        id: 'month-positive-balance',
        level: 'info',
        category: 'revenu',
        title: 'Revenus du mois',
        message: `${formatMoney(monthRevenue)} encaissés, solde ${formatMoney(monthRevenue - monthExpense)}`,
        amount: monthRevenue,
      });
    }

    // --- Anomalies : montants nuls ou négatifs ---
    tx.filter(t => !Number.isFinite(t.amount) || t.amount <= 0).forEach(t => {
      list.push({
        id: `tx-anomaly-${t.id}`,
        level: 'warning',
        category: 'anomalie',
        title: 'Montant invalide',
        message: `${t.description || t.category} — montant enregistré : ${t.amount}`,
        date: t.date,
      });
    });

    const order: Record<FinancialAlertLevel, number> = { critical: 0, warning: 1, info: 2 };
    return list.sort((a, b) => order[a.level] - order[b.level]);
  }, [transactions, purchases, allSales, unitId]);

  const counts = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.level === 'critical').length,
    warning: alerts.filter(a => a.level === 'warning').length,
    info: alerts.filter(a => a.level === 'info').length,
    pendingInvoices: alerts.filter(a => a.category === 'paiement').length,
    overdueInvoices: alerts.filter(a => a.category === 'facture' || (a.category === 'echeance' && a.level === 'critical')).length,
  }), [alerts]);

  return { alerts, counts };
};
