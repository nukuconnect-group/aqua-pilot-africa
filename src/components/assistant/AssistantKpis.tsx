import React, { useEffect, useState } from 'react';
import { TrendingUp, ShoppingCart, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';

const db = supabase as any;
const fmt = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F CFA`;

/** Trois chiffres réels du mois en cours pour l'unité choisie : ventes, achats, résultat. */
const AssistantKpis: React.FC<{ unitId?: string | null }> = ({ unitId }) => {
  const [data, setData] = useState<{ sales: number; purchases: number } | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const scope = (q: any) => (unitId ? q.eq('unit_id', unitId) : q);
    Promise.all([
      scope(db.from('sales').select('total_amount,status').gte('date', start)),
      scope(db.from('purchases').select('amount,status').gte('date', start)),
    ]).then(([s, p]: any[]) => {
      if (!alive || s.error || p.error) return;
      const ok = (r: any) => r.status !== 'cancelled';
      setData({
        sales: (s.data || []).filter(ok).reduce((t: number, r: any) => t + Number(r.total_amount || 0), 0),
        purchases: (p.data || []).filter(ok).reduce((t: number, r: any) => t + Number(r.amount || 0), 0),
      });
    }).catch(() => undefined);
    return () => { alive = false; };
  }, [unitId]);

  if (!data) return null;
  const result = data.sales - data.purchases;
  const items = [
    { icon: TrendingUp, label: 'Ventes du mois', value: fmt(data.sales), tone: 'text-primary' },
    { icon: ShoppingCart, label: 'Achats du mois', value: fmt(data.purchases), tone: 'text-muted-foreground' },
    { icon: Scale, label: 'Résultat', value: fmt(result), tone: result >= 0 ? 'text-primary' : 'text-destructive' },
  ];
  return (
    <div className="grid grid-cols-3 divide-x divide-border border-b bg-muted/30" aria-label="Chiffres réels du mois">
      {items.map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="min-w-0 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Icon className={`size-3.5 shrink-0 ${tone}`} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </p>
          <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${tone === 'text-muted-foreground' ? 'text-foreground' : tone}`}>{value}</p>
        </div>
      ))}
    </div>
  );
};

export default AssistantKpis;
