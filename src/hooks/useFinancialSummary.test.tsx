import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { useFinancialSummary } from './useFinancialSummary';

vi.mock('@/contexts/ProductionUnitsContext', () => ({ useProductionUnits: () => ({ transactions: [], purchases: [] }) }));
vi.mock('@/hooks/useSales', () => ({ useSales: () => ({ allSales: [
  { unitId: 'a', date: '2026-10-25', status: 'paid', totalAmount: 100 },
  { unitId: 'a', date: '2026-10-01', status: 'confirmed', totalAmount: 200 },
  { unitId: 'a', date: '2026-02-01', status: 'paid', totalAmount: 400 },
  { unitId: 'b', date: '2026-10-25', status: 'paid', totalAmount: 800 },
] }) }));
vi.mock('@/hooks/useEmployees', () => ({ useEmployees: () => ({ employees: [], paySlips: [] }) }));
vi.mock('@/hooks/useFeedStocks', () => ({ useFeedStocks: () => ({ stocks: [] }) }));
vi.mock('@/hooks/useFeedingRecords', () => ({ useFeedingRecords: () => ({ records: [] }) }));

describe('dashboard financial period totals', () => {
  it('changes real dated totals and chart buckets with 7 jours, Mois and Année without mixing units', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 25, 13, 39));
    const container = document.createElement('div');
    const root = createRoot(container);
    let result: ReturnType<typeof useFinancialSummary> | undefined;
    function Read({ period }: { period: '7' | '30' | '365' }) { result = useFinancialSummary('a', period); return null; }
    try {
      for (const [period, total, buckets] of [['7', 100, 7], ['30', 300, 30], ['365', 700, 13]] as const) {
        await act(async () => { root.render(<Read period={period} />); });
        expect(result?.totalSalesRevenue).toBe(total);
        expect(result?.monthlyData).toHaveLength(buckets);
        expect(result?.monthlyData.reduce((sum, p) => sum + p.revenue, 0)).toBe(total);
      }
    } finally { await act(async () => root.unmount()); vi.useRealTimers(); }
  });
});