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
import { exportToPDF, exportToExcel, type ReportData } from '@/lib/reportExportUtils';
import {
  AUTO_ENABLED_KEY,
  JOURNAL_EVENT,
  PERIOD_LABELS,
  buildJournal,
  computeRange,
  frDate as fr,
  isoDate as iso,
  notifyJournalReady,
  readHistory,
  writeHistory,
  markJournalsRead,
  type JournalEntry,
  type JournalPeriodType as PeriodType,
} from '@/lib/farmJournal';
import { toast } from 'sonner';

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
  const [autoEnabled, setAutoEnabled] = useState(() => localStorage.getItem(AUTO_ENABLED_KEY) !== 'off');
  const [history, setHistory] = useState<JournalEntry[]>(() => readHistory());
  const [current, setCurrent] = useState<JournalEntry | null>(null);

  const range = useMemo(
    () => computeRange(periodType, refDate, customStart, customEnd),
    [periodType, refDate, customStart, customEnd]
  );

  const persist = (entries: JournalEntry[]) => {
    setHistory(entries);
    writeHistory(entries);
  };

  useEffect(() => {
    const refresh = () => setHistory(readHistory());
    window.addEventListener(JOURNAL_EVENT, refresh);
    return () => window.removeEventListener(JOURNAL_EVENT, refresh);
  }, []);

  // Les journaux vus dans ce module ne sont plus signalés comme nouveaux
  useEffect(() => { markJournalsRead(); }, []);

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
        await notifyJournalReady(user.id, unitName, data.period);
      }
      if (!opts?.silent) toast.success('Journal de ferme prêt');
      else toast.info('Le journal de ferme du jour est prêt');
    } catch (e) {
      console.error(e);
      toast.error("Impossible de générer le journal de ferme");
    } finally {
      setLoading(false);
    }
  }, [range, unitId, units, periodType, history, user?.id]);

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
                localStorage.setItem(AUTO_ENABLED_KEY, next ? 'on' : 'off');
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
