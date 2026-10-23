import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import type { CashSession } from '@/hooks/useCashSession';

interface Props { history: CashSession[]; formatCurrency: (n: number) => string; unitId: string }

/** Suivi des écarts de clôture : la clôture reste intacte, la mesure corrective est notée sur l'anomalie. */
const CashDiscrepancies: React.FC<Props> = ({ history, formatCurrency, unitId }) => {
  const { toast } = useToast();
  const db = supabase as any;
  const [notes, setNotes] = useState<Record<string, any>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const gaps = history.filter((h) => Number(h.difference) !== 0 && h.difference != null);

  const load = useCallback(async () => {
    const { data } = await db.from('notifications').select('id, metadata').eq('type', 'cash_discrepancy').order('created_at', { ascending: false }).limit(200);
    const map: Record<string, any> = {};
    (data || []).forEach((n: any) => { const sid = n.metadata?.session_id; if (sid && n.metadata?.unit_id === unitId && !map[sid]) map[sid] = n; });
    setNotes(map);
  }, [unitId]);
  useEffect(() => { load(); }, [load]);

  const save = async (s: CashSession) => {
    const measure = (draft[s.id] || '').trim();
    if (!measure) return;
    const existing = notes[s.id];
    const metadata = { ...(existing?.metadata || { session_id: s.id, unit_id: unitId, expected: s.expected_amount, counted: s.counted_amount, difference: s.difference }), status: 'traité', measure, treated_at: new Date().toISOString() };
    const { data: auth } = await supabase.auth.getUser();
    const res = existing
      ? await db.from('notifications').update({ metadata, is_read: true }).eq('id', existing.id)
      : await db.from('notifications').insert({ user_id: auth.user?.id, type: 'cash_discrepancy', module: 'sales', title: `Écart de caisse — ${s.name || 'Caisse'}`, message: `Écart ${s.difference}`, is_read: true, metadata });
    if (res.error) { toast({ title: 'Enregistrement impossible', description: res.error.message, variant: 'destructive' }); return; }
    setDraft((d) => ({ ...d, [s.id]: '' }));
    toast({ title: 'Mesure corrective enregistrée' });
    load();
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" />Écarts de caisse ({gaps.length})</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {gaps.length === 0 && <p className="text-sm text-muted-foreground">Aucun écart constaté à la clôture.</p>}
        {gaps.map((s) => {
          const n = notes[s.id]?.metadata; const d = Number(s.difference);
          return (
            <div key={s.id} className="rounded-lg border border-border p-3 space-y-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{s.name || 'Caisse'} · {new Date(s.closed_at || s.opened_at).toLocaleString('fr-FR')}</span>
                <Badge variant={n?.status === 'traité' ? 'secondary' : 'destructive'}>{n?.status === 'traité' ? 'Traité' : 'À traiter'}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-muted-foreground">
                <span>Théorique<br /><b className="text-foreground">{formatCurrency(Number(s.expected_amount) || 0)}</b></span>
                <span>Déclaré<br /><b className="text-foreground">{formatCurrency(Number(s.counted_amount) || 0)}</b></span>
                <span>{d > 0 ? 'Excédent' : 'Manquant'}<br /><b className="text-destructive">{formatCurrency(d)}</b></span>
              </div>
              {n?.measure && <p className="text-xs">Mesure : {n.measure} {n.treated_at && `(${new Date(n.treated_at).toLocaleDateString('fr-FR')})`}</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <Textarea rows={1} placeholder="Mesure corrective (ex. recomptage, retenue, régularisation…)" value={draft[s.id] || ''} onChange={(e) => setDraft((x) => ({ ...x, [s.id]: e.target.value }))} />
                <Button size="sm" disabled={!(draft[s.id] || '').trim()} onClick={() => save(s)}>Enregistrer</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CashDiscrepancies;
