import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, Stethoscope, AlertTriangle, ShieldAlert, Save, History, Search, Loader2, Fish, Leaf } from 'lucide-react';
import { Input } from '@/components/ui/input';
import CameraAnalysis, { analyzeWithAI, VisionResultView, type VisionResult } from './CameraAnalysis';
import { loadSymptoms, runDiagnosis, Symptom, DiagnosisResult } from '@/lib/diseaseDiagnosis';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { toast } from '@/hooks/use-toast';
import ExpertDirectory from './ExpertDirectory';
import { buildHealthReportPdf, shareOrDownloadPdf } from '@/lib/healthReportPdf';
import { FileDown } from 'lucide-react';
import { getUnitTerms, isAlgaeUnitType } from '@/lib/unitContext';

const RISK_COLOR: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  high: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};
const RISK_LABEL: Record<string, string> = { low: 'Faible', medium: 'Modéré', high: 'Élevé', critical: 'Critique' };

const AquaHealthAI: React.FC = () => {
  const { user } = useAuth();
  const { activeUnit, units } = useProductionUnits();
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [otherSymptoms, setOtherSymptoms] = useState('');
  const [results, setResults] = useState<DiagnosisResult[]>([]);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyUnit, setHistoryUnit] = useState<string>('all');
  const [speciesQuery, setSpeciesQuery] = useState('');
  const [speciesLoading, setSpeciesLoading] = useState(false);
  const [speciesResult, setSpeciesResult] = useState<VisionResult | null>(null);
  const unitTerms = getUnitTerms(activeUnit?.type);
  const isAlgae = isAlgaeUnitType(activeUnit?.type);

  useEffect(() => { loadSymptoms().then(setSymptoms); }, []);
  useEffect(() => { loadHistory(); }, [user?.id]);

  const unitName = (id: string | null) =>
    id ? (units.find(u => u.id === id)?.name ?? 'Unité supprimée') : 'Sans unité';

  const filteredHistory = history.filter(h =>
    historyUnit === 'all' ? true : (h.unit_id ?? 'none') === historyUnit
  );

  const loadHistory = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('aqua_diagnoses').select('*').order('created_at', { ascending: false }).limit(50);
    setHistory(data ?? []);
  };


  const exportHistory = (h: any) => {
    const r = h.results;
    const isPhoto = r && !Array.isArray(r) && r.source === 'photo';
    const nameOf = (id: string) => symptoms.find(s => s.id === id)?.name ?? id;
    const blob = buildHealthReportPdf({
      title: isPhoto ? 'Rapport d’analyse photo — AquaHealth AI' : 'Rapport de diagnostic — AquaHealth AI',
      date: new Date(h.created_at),
      unitName: unitName(h.unit_id),
      species: isPhoto ? r.species : null,
      symptoms: isPhoto ? [] : [...(h.selected_symptoms ?? []).map(nameOf), ...(h.other_symptoms ? [h.other_symptoms] : [])],
      observations: isPhoto ? r.observations : [],
      diseases: isPhoto
        ? (r.diseases ?? []).map((d: any) => ({ name: d.name, level: d.severity, confidence: d.confidence }))
        : (Array.isArray(r) ? r : []).map((d: any) => ({ name: d.name, level: d.risk, confidence: d.score })),
      recommendations: isPhoto ? r.recommendations : [],
    });
    shareOrDownloadPdf(blob, `diagnostic-${new Date(h.created_at).toISOString().slice(0, 10)}.pdf`);
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleRun = async () => {
    if (selected.size === 0) { toast({ title: 'Sélectionnez au moins un symptôme', variant: 'destructive' }); return; }
    setRunning(true);
    const res = await runDiagnosis(Array.from(selected));
    setResults(res);
    setRunning(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session && user?.id && res.length > 0) {
        await supabase.from('aqua_diagnoses').insert({
          user_id: sessionData.session.user.id,
          unit_id: activeUnit?.id ?? null,
          selected_symptoms: Array.from(selected),
          other_symptoms: otherSymptoms || null,
          results: res.map(r => ({ disease_id: r.disease.id, name: r.disease.name, score: r.score, risk: r.riskLevel })) as any,
          top_disease_id: res[0].disease.id,
          risk_level: res[0].riskLevel,
        });
        loadHistory();
      }
    } catch {
      /* l'historique est optionnel : le diagnostic reste affiché */
    }
  };

  const handleSpeciesSearch = async () => {
    const value = speciesQuery.trim();
    if (!value) { toast({ title: 'Saisissez une espèce', variant: 'destructive' }); return; }
    setSpeciesLoading(true);
    try {
      const res = await analyzeWithAI({ mode: 'species', species: value, domain: isAlgae ? 'algae' : 'fish' });
      setSpeciesResult(res);
    } catch (e: any) {
      toast({ title: 'Recherche impossible', description: e?.message ?? 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setSpeciesLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg"><Brain className="w-6 h-6 text-primary" /></div>
            <div>
              <CardTitle className="text-xl">AquaHealth AI</CardTitle>
              <CardDescription>Diagnostic sanitaire par analyse des symptômes observés.</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">{isAlgae ? <Leaf className="w-4 h-4" /> : <Fish className="w-4 h-4" />}{unitTerms.aiSpeciesTitle}</CardTitle>
          <CardDescription>{unitTerms.aiSpeciesDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={speciesQuery}
              onChange={e => setSpeciesQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSpeciesSearch(); }}
              placeholder={unitTerms.aiSpeciesPlaceholder}
            />
            <Button onClick={handleSpeciesSearch} disabled={speciesLoading} className="sm:w-auto">
              {speciesLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              <span>Rechercher</span>
            </Button>
          </div>
          {speciesResult && <VisionResultView result={speciesResult} />}
        </CardContent>
      </Card>

      <CameraAnalysis onSaved={loadHistory} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Stethoscope className="w-4 h-4" />Symptômes observés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
              {symptoms.map(s => (
                <label key={s.id} className="flex items-start gap-2 p-2 border rounded-md cursor-pointer hover:bg-muted/40">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                  </div>
                </label>
              ))}
            </div>
            <div>
              <Label>Autres symptômes</Label>
              <Textarea rows={2} value={otherSymptoms} onChange={e => setOtherSymptoms(e.target.value)} placeholder="Précisez si nécessaire..." />
            </div>
            <Button onClick={handleRun} disabled={running} className="w-full">
              <Brain className="w-4 h-4 mr-2" /><span key={running ? 'run' : 'idle'}>{running ? 'Analyse...' : 'Lancer le diagnostic'}</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Résultats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">Aucun diagnostic en cours.</div>
            ) : results.map((r, idx) => (
              <div key={r.disease.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">#{idx + 1} {r.disease.name}</span>
                      <Badge variant="outline">{r.disease.category}</Badge>
                      <Badge className={RISK_COLOR[r.riskLevel]}>{RISK_LABEL[r.riskLevel]}</Badge>
                    </div>
                    {r.disease.description && <p className="text-xs text-muted-foreground mt-1">{r.disease.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary">{Math.round(r.score * 100)}%</p>
                    <p className="text-[10px] text-muted-foreground">{r.matchedSymptoms} symptôme(s)</p>
                  </div>
                </div>
                {idx === 0 && r.treatments.length > 0 && (
                  <div className="bg-muted/40 rounded-md p-2 space-y-2 text-xs">
                    <p className="font-semibold flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Recommandations</p>
                    {r.disease.causes && <p><strong>Causes :</strong> {r.disease.causes}</p>}
                    {r.disease.favoring_factors && <p><strong>Facteurs favorisants :</strong> {r.disease.favoring_factors}</p>}
                    {r.treatments.map(t => (
                      <div key={t.id} className="border-l-2 border-primary pl-2">
                        <p className="font-medium">{t.name}{t.active_ingredient ? ` — ${t.active_ingredient}` : ''}</p>
                        {t.dosage && <p><strong>Dosage :</strong> {t.dosage}</p>}
                        {t.duration && <p><strong>Durée :</strong> {t.duration}</p>}
                        {t.administration && <p><strong>Administration :</strong> {t.administration}</p>}
                        {t.water_actions && <p><strong>Actions sur l'eau :</strong> {t.water_actions}</p>}
                        {t.isolation_required && <p className="text-destructive font-semibold">⚠️ Isolement requis</p>}
                        {t.follow_up && <p><strong>Suivi :</strong> {t.follow_up}</p>}
                      </div>
                    ))}
                    {r.disease.prevention && <p><strong>Prévention :</strong> {r.disease.prevention}</p>}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <ExpertDirectory context={results[0]?.disease.name} />

      {history.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" />Historique des diagnostics</CardTitle>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant={historyUnit === 'all' ? 'default' : 'outline'} onClick={() => setHistoryUnit('all')}>
                  Toutes les unités
                </Button>
                {units.map(u => (
                  <Button key={u.id} size="sm" variant={historyUnit === u.id ? 'default' : 'outline'} onClick={() => setHistoryUnit(u.id)}>
                    {u.name}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun diagnostic pour cette unité.</p>
              ) : filteredHistory.map(h => (
                <div key={h.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                    <Badge variant="secondary">{unitName(h.unit_id)}</Badge>
                    <Badge variant="outline">{(h.selected_symptoms ?? []).length} symptômes</Badge>
                    {h.risk_level && <Badge className={RISK_COLOR[h.risk_level]}>{RISK_LABEL[h.risk_level]}</Badge>}
                    {h.results && !Array.isArray(h.results) && h.results.source === 'photo' && <Badge variant="outline">Photo</Badge>}
                    {(Array.isArray(h.results) ? h.results[0]?.name : h.notes) && (
                      <span className="text-xs font-medium">{Array.isArray(h.results) ? h.results[0].name : h.notes}</span>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => exportHistory(h)} aria-label="Exporter en PDF"><FileDown className="w-4 h-4 mr-1" />PDF</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AquaHealthAI;