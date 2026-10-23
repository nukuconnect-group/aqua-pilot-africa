import { useMemo } from 'react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSales } from '@/hooks/useSales';
import { useEmployees } from '@/hooks/useEmployees';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import { useFeedingRecords } from '@/hooks/useFeedingRecords';

export interface FinancialSummary {
  // Revenus
  totalSalesRevenue: number;
  salesCount: number;
  confirmedSales: number;
  pendingSales: number;
  
  // Dépenses
  totalPurchases: number;
  purchasesCount: number;
  feedPurchases: number;
  otherPurchases: number;
  
  // RH / Paie
  totalSalaries: number;
  employeesCount: number;
  
  // Alimentation
  feedStockValue: number;
  feedConsumed: number;
  feedStocksCount: number;
  
  // Transactions comptables
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  
  // Par mois
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
    sales: number;
    purchases: number;
    salaries: number;
    feed: number;
  }>;
  
  // Répartition des dépenses
  expenseBreakdown: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  
  // Répartition des revenus
  revenueBreakdown: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

/** Écriture de revenu créée automatiquement à l'enregistrement d'une vente (déjà comptée via la vente). */
export const isSaleMirror = (t: { category?: string; description?: string }) =>
  t.category === 'Vente de poissons' && (t.description || '').startsWith('Vente à ');

export const useFinancialSummary = (unitId?: string) => {
  const { transactions, purchases } = useProductionUnits();
  const { allSales: sales } = useSales();
  const { employees } = useEmployees();
  const { stocks: feedStocks } = useFeedStocks(unitId);
  const { records: feedingRecords } = useFeedingRecords(undefined, unitId);

  const summary = useMemo<FinancialSummary>(() => {
    // Filtrer par unité si spécifié
    const filteredTransactions = unitId 
      ? transactions.filter(t => t.unitId === unitId)
      : transactions;
    
    const filteredPurchases = unitId
      ? purchases.filter(p => p.unitId === unitId)
      : purchases;

    const filteredSales = unitId
      ? sales.filter(s => s.unitId === unitId)
      : sales;

    const filteredEmployees = unitId
      ? employees.filter(e => e.unitId === unitId)
      : employees;

    // Ventes
    const confirmedSalesData = filteredSales.filter(s => s.status === 'confirmed' || s.status === 'paid');
    const pendingSalesData = filteredSales.filter(s => s.status === 'pending');
    const totalSalesRevenue = confirmedSalesData.reduce((sum, s) => sum + s.totalAmount, 0);

    // Achats
    const receivedPurchases = filteredPurchases.filter(p => p.status === 'received');
    const totalPurchases = receivedPurchases.reduce((sum, p) => sum + p.amount, 0);
    const feedPurchases = receivedPurchases
      .filter(p => p.category?.toLowerCase().includes('aliment') || p.category === 'alimentation')
      .reduce((sum, p) => sum + p.amount, 0);
    const otherPurchases = totalPurchases - feedPurchases;

    // Salaires (estimation mensuelle)
    const totalMonthlySalaries = filteredEmployees
      .filter(e => e.status === 'active')
      .reduce((sum, e) => sum + (e.salary || 0), 0);

    // Stock d'aliments - valeur totale
    const feedStockValue = feedStocks.reduce((sum, s) => sum + ((s.cost || 0) * s.quantity), 0);
    
    // Alimentation consommée
    const feedConsumed = feedingRecords.reduce((sum, r) => sum + r.quantity, 0);

    // Transactions comptables
    // Les ventes et achats sont déjà comptés depuis leurs propres tables : on exclut leurs écritures miroir
    // pour ne jamais compter deux fois le même argent.
    const revenueTransactions = filteredTransactions.filter(t => t.type === 'revenue' && t.status !== 'cancelled' && !isSaleMirror(t));
    const expenseTransactions = filteredTransactions.filter(t => t.type === 'expense' && t.status !== 'cancelled' && !t.purchaseId);
    
    const transactionRevenue = revenueTransactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Total revenus = ventes confirmées + autres revenus comptables
    const totalRevenue = totalSalesRevenue + transactionRevenue;
    
    // Total dépenses = achats reçus + salaires + autres dépenses comptables
    const totalExpenses = totalPurchases + totalMonthlySalaries + transactionExpenses;
    
    const netBalance = totalRevenue - totalExpenses;

    // Données mensuelles (6 derniers mois)
    const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthNames[date.getMonth()];

      // Ventes du mois
      const monthSales = confirmedSalesData
        .filter(s => s.date.startsWith(monthKey))
        .reduce((sum, s) => sum + s.totalAmount, 0);

      // Achats du mois
      const monthPurchases = receivedPurchases
        .filter(p => p.date.startsWith(monthKey))
        .reduce((sum, p) => sum + p.amount, 0);

      // Transactions du mois
      const monthRevenue = revenueTransactions
        .filter(t => t.date.startsWith(monthKey))
        .reduce((sum, t) => sum + t.amount, 0);
      
      const monthExpenses = expenseTransactions
        .filter(t => t.date.startsWith(monthKey))
        .reduce((sum, t) => sum + t.amount, 0);

      const revenue = monthSales + monthRevenue;
      const expenses = monthPurchases + totalMonthlySalaries + monthExpenses;

      return {
        month: monthName,
        revenue,
        expenses,
        profit: revenue - expenses,
        sales: monthSales,
        purchases: monthPurchases,
        salaries: totalMonthlySalaries,
        feed: feedPurchases / 6, // Estimation mensuelle
      };
    });

    // Répartition des dépenses
    const expenseBreakdown = [
      { name: 'Alimentation', value: feedPurchases, color: '#f97316' },
      { name: 'Personnel', value: totalMonthlySalaries, color: '#8b5cf6' },
      { name: 'Achats divers', value: otherPurchases, color: '#06b6d4' },
      { name: 'Autres charges', value: transactionExpenses, color: '#64748b' },
    ].filter(e => e.value > 0);

    // Répartition des revenus
    const revenueBreakdown = [
      { name: 'Ventes', value: totalSalesRevenue, color: '#10b981' },
      { name: 'Autres revenus', value: transactionRevenue, color: '#3b82f6' },
    ].filter(r => r.value > 0);

    return {
      totalSalesRevenue,
      salesCount: filteredSales.length,
      confirmedSales: confirmedSalesData.length,
      pendingSales: pendingSalesData.length,
      
      totalPurchases,
      purchasesCount: receivedPurchases.length,
      feedPurchases,
      otherPurchases,
      
      totalSalaries: totalMonthlySalaries,
      employeesCount: filteredEmployees.filter(e => e.status === 'active').length,
      
      feedStockValue,
      feedConsumed,
      feedStocksCount: feedStocks.length,
      
      totalRevenue,
      totalExpenses,
      netBalance,
      
      monthlyData,
      expenseBreakdown,
      revenueBreakdown,
    };
  }, [transactions, purchases, sales, employees, feedStocks, feedingRecords, unitId]);

  return summary;
};
