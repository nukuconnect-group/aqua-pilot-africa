import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { CreditCard } from 'lucide-react';

type Row = { label: string; amount: number; count: number };

export const groupMovements = (
  movements: { session_id: string; type: string; amount: number; payment_method: string; created_by?: string }[],
  names: Record<string, string>,
  people: Record<string, string> = {},
) => {
  const byCashier: Record<string, Row> = {};
  const byReg: Record<string, Row> = {};
  const byPay: Record<string, Row> = {};
  for (const m of movements) {
    if (m.type !== 'sale') continue;
    const r = (byReg[m.session_id] ||= { label: names[m.session_id] || 'Caisse', amount: 0, count: 0 });
    r.amount += Number(m.amount) || 0; r.count += 1;
    const p = (byPay[m.payment_method] ||= { label: m.payment_method || 'Autre', amount: 0, count: 0 });
    p.amount += Number(m.amount) || 0; p.count += 1;
    const who = m.created_by || 'inconnu';
    const c = (byCashier[who] ||= { label: people[who] || 'Membre de l’équipe', amount: 0, count: 0 });
    c.amount += Number(m.amount) || 0; c.count += 1;
  }
  const sort = (o: Record<string, Row>) => Object.values(o).sort((a, b) => b.amount - a.amount);
  return { registers: sort(byReg), payments: sort(byPay), cashiers: sort(byCashier) };
};

export default function RevenueByRegister() {
  const { activeUnit } = useProductionUnits();
  const { formatCurrency } = useSettings();
  const [data, setData] = useState<{ registers: Row[]; payments: Row[]; cashiers: Row[] }>({ registers: [], payments: [], cashiers: [] });

  useEffect(() => {
    if (!activeUnit?.id) return;
    const db = supabase as any;
    (async () => {
      const [{ data: sessions }, { data: moves }] = await Promise.all([
        db.from('cash_sessions').select('id, name, opened_at').eq('unit_id', activeUnit.id),
        db.from('cash_movements').select('session_id, type, amount, payment_method, created_by').eq('unit_id', activeUnit.id).eq('type', 'sale'),
      ]);
      const names: Record<string, string> = {};
      for (const s of sessions || []) names[s.id] = s.name || `Caisse du ${new Date(s.opened_at).toLocaleDateString('fr-FR')}`;
      const ids = [...new Set((moves || []).map((m: any) => m.created_by).filter(Boolean))];
      const people: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await db.from('profiles').select('id, full_name, email').in('id', ids);
        for (const p of profs || []) people[p.id] = p.full_name || p.email || 'Membre de l’équipe';
      }
      setData(groupMovements(moves || [], names, people));
    })();
  }, [activeUnit?.id]);

  const List = ({ title, rows }: { title: string; rows: Row[] }) => (
    <Card>
      <CardHeader className="p-4"><CardTitle className="flex items-center gap-2 text-base"><CreditCard className="w-4 h-4 text-primary" />{title}</CardTitle></CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Aucun encaissement.</p> : rows.map((r) => (
          <div key={r.label} className="flex justify-between gap-2 rounded-lg border p-3">
            <div className="min-w-0"><p className="font-medium truncate">{r.label}</p><p className="text-xs text-muted-foreground">{r.count} vente(s)</p></div>
            <p className="font-semibold shrink-0">{formatCurrency(r.amount)}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <List title="Encaissements par caisse" rows={data.registers} />
      <List title="Encaissements par mode de paiement" rows={data.payments} />
      <List title="Encaissements par caissier" rows={data.cashiers} />
    </div>
  );
}
