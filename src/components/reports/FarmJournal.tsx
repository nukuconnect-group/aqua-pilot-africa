import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BookOpen, CalendarDays, Download, RefreshCw, Building2, CheckCircle2 } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/clientConfig';
import { exportToPDF, exportToExcel, type ReportData } from '@/lib/reportExportUtils';
import { toast } from 'sonner';

type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'custom';

const PERIOD_LABELS: Record<PeriodType, string> = {
  day: 'Journalier',
  week: 'Hebdomadaire',
  month: 'Mensuel',
  quarter: 'Trimestriel',
  custom: 'Personnalisé',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fr = (d: string) => new Date(d).toLocaleDateString('fr-FR');

const computeRange = (type: PeriodType, ref: string, customStart: string, customEnd: string) => {
  const base = new Date(`${ref}T00:00:00`);
  switch (type) {
    case 'day':
      return { start: iso(base), end: iso(base) };
    case 'week': {
      const day = (base.getDay() + 6) % 7; // lundi = 0
      const start = new Date(base); start.setDate(base.getDate() - day);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      return { start: iso(start), end: iso(end) };
    }
    case 'month': {
      const start = new Date(base.getFullYear(), base.getMonth(), 1);
      const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
      return { start: iso(start), end: iso(end) };
    }
    case 'quarter': {
      const q = Math.floor(base.getMonth() / 3);
      const start = new Date(base.getFullYear(), q * 3, 1);
      const end = new Date(base.getFullYear(), q * 3 + 3, 0);
      return { start: iso(start), end: iso(end) };
    }
    case 'custom':
    default:
      return { start: customStart, end: customEnd };
  }
};

interface JournalEntry {
  id: string;
  unitId: string;
  unitName: string;
  periodType: PeriodType;
  start: string;
  end: string;
  generatedAt: string;
  auto: boolean;
  data: ReportData;
}

const STORAGE_KEY = 'aquapilote.farm-journal.history';
const AUTO_KEY = 'aquapilote.farm-journal.autoDone';

const FarmJournal: React.FC = () => {
  const { units } = useProductionUnits();
  const { user } = useAuth();

  const today = iso(new Date());
  const [periodType, setPeriodType] = useState<PeriodType>('day');
  const [refDate, setRefDate] = useState(today);
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(today);
  const [unitId, setUnitId] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(() => localStorage.getItem('aquapilote.farm-journal.auto') !== 'off');
  const [history, setHistory] = useState<JournalEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [current, setCurrent] = useState<JournalEntry | null>(null);

  const range = useMemo(
    () => computeRange(periodType, refDate, customStart, customEnd),
    [periodType, refDate, customStart, customEnd]
  );

  const persist = (entries: JournalEntry[]) => {
    setHistory(entries);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 40))); } catch { /* quota */ }
  };

  const buildJournal = useCallback(async (
    targetUnitId: string,
    targetUnitName: string,
    start: string,
    end: string,
    type: PeriodType
  ): Promise<ReportData> => {
    const scoped = <T extends { eq: (c: string, v: string) => T }>(q: T) =>
      targetUnitId === 'all' ? q : q.eq('unit_id', targetUnitId);

    const [feedingRes, healthRes, salesRes, cyclesRes, batchesRes] = await Promise.all([
      scoped(supabase.from('feeding_records').select('*').gte('date', start).lte('date', end) as any),
      scoped(supabase.from('health_records').select('*').gte('date', start).lte('date', end) as any),
      scoped(supabase.from('sales').select('*').gte('date', start).lte('date', end) as any),
      scoped(supabase.from('production_cycles').select('*') as any),
      supabase.from('livestock_batches').select('*'),
    ]);

    const feeding = (feedingRes as any).data ?? [];
    const health = (healthRes as any).data ?? [];
    const sales = (salesRes as any).data ?? [];
    const cycles = ((cyclesRes as any).data ?? []).filter((c: any) => c.status === 'active');
    const batches = ((batchesRes as any).data ?? []).filter(
      (b: any) => targetUnitId === 'all' || b.unit_id === targetUnitId
    );

    const totalFeed = feeding.reduce((s: number, f: any) => s + (Number(f.quantity) || 0), 0);
    const mortality =
      feeding.reduce((s: number, f: any) => s + (Number(f.mortality) || 0), 0) +
      health.reduce((s: number, h: any) => s + (Number(h.mortality) || 0), 0);
    const revenue = sales.reduce((s: number, v: any) => s + (Number(v.total_amount) || 0), 0);
    const stock = batches.reduce((s: number, b: any) => s + (Number(b.quantity) || 0), 0);
    const biomass = batches.reduce((s: number, b: any) => s + (Number(b.total_weight) || 0), 0);
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    const sections: ReportData['sections'] = [
      {
        title: '📌 Résumé de la journée',
        type: 'summary',
        summary: [
          { label: 'Unité', value: targetUnitName },
          { label: 'Période', value: start === end ? fr(start) : `${fr(start)} → ${fr(end)}` },
          { label: 'Cycles actifs', value: cycles.length },
          { label: 'Effectif en stock', value: stock.toLocaleString('fr-FR') },
          { label: 'Biomasse (kg)', value: biomass.toFixed(1) },
          { label: 'Aliment distribué (kg)', value: totalFeed.toFixed(2) },
          { label: 'Mortalités déclarées', value: mortality },
          { label: 'Ventes (montant)', value: revenue.toLocaleString('fr-FR') },
        ],
      },
      {
        title: '🍽️ Alimentation',
        type: 'table',
        headers: ['Date', 'Séance', 'Aliment', 'Quantité (kg)', 'Responsable', 'Notes'],
        rows: feeding.map((f: any) => [
          fr(f.date), f.session_type || '-', f.feed_type || '-',
          String(f.quantity ?? 0), f.feeder_name || '-', f.notes || '-',
        ]),
      },
      {
        title: '🩺 Suivi sanitaire & qualité de l\'eau',
        type: 'table',
        headers: ['Date', 'Température', 'pH', 'Oxygène', 'Mortalité', 'Poids moyen', 'Notes'],
        rows: health.map((h: any) => [
          fr(h.date), String(h.temperature ?? '-'), String(h.ph ?? '-'), String(h.oxygen ?? '-'),
          String(h.mortality ?? 0), String(h.average_weight ?? '-'), h.notes || '-',
        ]),
      },
      {
        title: '💰 Ventes',
        type: 'table',
        headers: ['Date', 'Document', 'Client', 'Montant', 'Statut'],
        rows: sales.map((v: any) => [
          fr(v.date), v.document_number || v.document_type, v.client_name,
          String(v.total_amount ?? 0), v.status,
        ]),
      },
      {
        title: '🐟 Cheptel et cycles',
        type: 'table',
        headers: ['Cycle / Lot', 'Espèce', 'Quantité', 'Poids moyen (g)', 'Statut'],
        rows: [
          ...cycles.map((c: any) => [c.name, c.species || '-', String(c.current_quantity ?? 0), '-', c.status]),
          ...batches.map((b: any) => [
            b.batch_number || b.species, b.species, String(b.quantity ?? 0),
            String(b.average_weight ?? '-'), b.status,
          ]),
        ],
      },
    ];

    if (health.length) {
      sections[2].headers?.length; // conservé pour lisibilité
    }

    return {
      title: `Journal de ferme — ${PERIOD_LABELS[type]}`,
      period: start === end ? fr(start) : `${fr(start)} au ${fr(end)}`,
      generatedAt: new Date().toLocaleString('fr-FR'),
      unitName: targetUnitName,
      sections: sections.concat(
        health.length
          ? [{
              title: '📈 Moyennes de la période',
              type: 'summary',
              summary: [
                { label: 'Température moyenne', value: avg(health.map((h: any) => Number(h.temperature) || 0)).toFixed(1) },
                { label: 'pH moyen', value: avg(health.map((h: any) => Number(h.ph) || 0)).toFixed(2) },
                { label: 'Oxygène moyen', value: avg(health.map((h: any) => Number(h.oxygen) || 0)).toFixed(2) },
              ],
            }]
          : []
      ),
    };
  }, []);

  const generate = useCallback(async (opts?: { auto?: boolean; silent?: boolean; overrideDate?: string }) => {
    const targetRange = opts?.overrideDate
      ? { start: opts.overrideDate, end: opts.overrideDate }
      : range;
    if (!targetRange.start || !targetRange.end) {
      toast.error('Sélectionnez une période valide');
      return;
    }
    setLoading(true);
    try {
      const unitName = unitId === 'all'
        ? 'Toutes les unités'
        : units.find(u => u.id === unitId)?.name || 'Unité';
      const data = await buildJournal(unitId, unitName, targetRange.start, targetRange.end, opts?.auto ? 'day' : periodType);
      const entry: JournalEntry = {
        id: `${Date.now()}`,
        unitId,
        unitName,
        periodType: opts?.auto ? 'day' : periodType,
        start: targetRange.start,
        end: targetRange.end,
        generatedAt: new Date().toLocaleString('fr-FR'),
        auto: !!opts?.auto,
        data,
      };
      setCurrent(entry);
      persist([entry, ...history]);

      if (user?.id) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: opts?.auto ? 'Journal de ferme du jour prêt' : 'Journal de ferme généré',
          message: `${unitName} — ${data.period} : votre journal est disponible dans le module Journal de ferme.`,
          type: 'success',
          module: 'reports',
          is_critical: false,
        } as any);
      }
      if (!opts?.silent) toast.success('Journal de ferme prêt');
      else toast.info('Le journal de ferme du jour est prêt');
    } catch (e) {
      console.error(e);
      toast.error("Impossible de générer le journal de ferme");
    } finally {
      setLoading(false);
    }
  }, [range, unitId, units, periodType, buildJournal, history, user?.id]);

  // Génération automatique quotidienne (une fois par jour)
  useEffect(() => {
    if (!autoEnabled || !user?.id) return;
    const done = localStorage.getItem(AUTO_KEY);
    if (done === today) return;
    localStorage.setItem(AUTO_KEY, today);
    generate({ auto: true, silent: true, overrideDate: today });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoEnabled, user?.id]);

  const download = async (entry: JournalEntry, format: 'pdf' | 'excel') => {
    const filename = `journal-ferme-${entry.unitName.replace(/\s+/g, '-').toLowerCase()}-${entry.start}`;
    if (format === 'pdf') await exportToPDF(entry.data, filename);
    else exportToExcel(entry.data, filename);
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><BookOpen className="w-5 h-5 text-primary" /></div>
            <div>
              <CardTitle className="text-lg">Journal de ferme</CardTitle>
              <CardDescription>
                Journal détaillé par unité : jour, semaine, mois, trimestre ou période personnalisée.
                Le journal du jour est préparé automatiquement et vous êtes alerté dès qu'il est prêt.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <Label className="text-xs flex items-center gap-1"><Building2 className="w-3 h-3" />Unité</Label>
            <Select value={unitId} onValueChange={setUnitId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les unités</SelectItem>
                {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs flex items-center gap-1"><CalendarDays className="w-3 h-3" />Périodicité</Label>
            <Select value={periodType} onValueChange={(v) => setPeriodType(v as PeriodType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Jour</SelectItem>
                <SelectItem value="week">Semaine</SelectItem>
                <SelectItem value="month">Mois</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="custom">Personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodType === 'custom' ? (
            <>
              <div>
                <Label className="text-xs">Du</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Au</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
              </div>
            </>
          ) : (
            <div className="lg:col-span-2">
              <Label className="text-xs">Date de référence</Label>
              <Input type="date" value={refDate} onChange={e => setRefDate(e.target.value)} />
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => generate()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Génération...' : 'Générer le journal'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const next = !autoEnabled;
                setAutoEnabled(next);
                localStorage.setItem('aquapilote.farm-journal.auto', next ? 'on' : 'off');
              }}
            >
              <CheckCircle2 className={`w-4 h-4 mr-2 ${autoEnabled ? 'text-emerald-600' : 'text-muted-foreground'}`} />
              Journal automatique : {autoEnabled ? 'activé' : 'désactivé'}
            </Button>
            <Badge variant="outline">
              Période : {range.start ? fr(range.start) : '—'}{range.start !== range.end && range.end ? ` → ${fr(range.end)}` : ''}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {current && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">{current.data.title}</CardTitle>
                <CardDescription>{current.unitName} — {current.data.period}</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => download(current, 'pdf')}>
                  <Download className="w-4 h-4 mr-1" />PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => download(current, 'excel')}>
                  <Download className="w-4 h-4 mr-1" />Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {current.data.sections.map((s, i) => (
              <div key={i} className="border rounded-lg p-3">
                <p className="font-semibold text-sm mb-2">{s.title}</p>
                {s.type === 'summary' && s.summary && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    {s.summary.map((it, j) => (
                      <div key={j} className="flex justify-between bg-muted/40 rounded-md p-2 text-sm">
                        <span className="text-muted-foreground">{it.label}</span>
                        <span className="font-semibold">{it.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.type === 'table' && s.headers && (
                  s.rows && s.rows.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            {s.headers.map((h, j) => <th key={j} className="p-2 text-left">{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.slice(0, 30).map((r, j) => (
                            <tr key={j} className="border-b">
                              {r.map((c, k) => <td key={k} className="p-2">{c}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Aucune activité enregistrée sur la période.</p>
                  )
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Journaux récents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.slice(0, 15).map(h => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 border rounded-md p-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{PERIOD_LABELS[h.periodType]}</Badge>
                  {h.auto && <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30">Auto</Badge>}
                  <span className="font-medium">{h.unitName}</span>
                  <span className="text-muted-foreground text-xs">{h.data.period} · généré le {h.generatedAt}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setCurrent(h)}>Ouvrir</Button>
                  <Button size="sm" variant="ghost" onClick={() => download(h, 'pdf')}><Download className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default FarmJournal;
