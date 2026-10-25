import React, { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import {formatMoney} from '@/lib/currency';
import {useProductionUnits} from '@/contexts/ProductionUnitsContext';

const db = supabase as any;
const fmt = formatMoney;

/** Trois chiffres réels du mois en cours pour l'unité choisie : ventes, achats, résultat. */
const AssistantKpis: React.FC<{ unitId?: string | null }> = ({ unitId }) => {
  const {currency,convertCurrency}=useProductionUnits();
  const [data, setData] = useState<{ sales: number; purchases: number } | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end=now.toISOString().slice(0,10);
    const scope = (q: any) => (unitId ? q.eq('unit_id', unitId) : q);
    Promise.all([
      scope(db.from('sales').select('total_amount,status').gte('date', start).lte('date',end)),
      scope(db.from('purchases').select('amount,status,currency').gte('date', start).lte('date',end)),
    ]).then(([s, p]: any[]) => {
      if (!alive || s.error || p.error || s.data?.length>=1000 || p.data?.length>=1000) return;
      const ok = (r: any) => r.status !== 'cancelled';
      setData({
        sales: (s.data || []).filter(ok).reduce((t: number, r: any) => t + Number(r.total_amount || 0), 0),
        purchases: (p.data || []).filter(ok).reduce((t: number, r: any) => t + convertCurrency(Number(r.amount || 0),r.currency||'XOF',currency), 0),
      });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [unitId,currency]);

  if (!data) return null;
  const result = data.sales - data.purchases;
  const items = [
    { icon: TrendingUp, label: 'Ventes du mois', value: fmt(data.sales), tone: 'text-primary' },
    { icon: ShoppingCart, label: 'Achats du mois', value: fmt(data.purchases), tone: 'text-muted-foreground' },
    { icon: Scale, label: 'Solde ventes − achats', value: fmt(result), tone: result >= 0 ? 'text-primary' : 'text-destructive' },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-border border-b bg-muted/30" aria-label="Chiffres réels du mois">
      {items.map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="min-w-0 px-2 py-2 sm:px-3 sm:py-2.5">
          <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:gap-1.5 sm:text-[11px]">
            <Icon className={`size-3.5 shrink-0 ${tone}`} aria-hidden="true" />
            <span className="break-words">{label}</span>
          </p>
          <p className={`mt-0.5 break-words text-xs font-semibold tabular-nums sm:text-sm ${tone === 'text-muted-foreground' ? 'text-foreground' : tone}`}>{value}</p>
        </div>
      ))}
    </div>
  );
};

export default AssistantKpis;
