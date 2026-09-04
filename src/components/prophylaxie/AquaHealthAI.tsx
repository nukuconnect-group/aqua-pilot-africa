import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain, Stethoscope, AlertTriangle, ShieldAlert, Save, History } from 'lucide-react';
import { loadSymptoms, runDiagnosis, Symptom, DiagnosisResult } from '@/lib/diseaseDiagnosis';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { toast } from '@/hooks/use-toast';

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

  useEffect(() => { loadSymptoms().then(setSymptoms); }, []);
  useEffect(() => { loadHistory(); }, [user?.id]);

  const unitName = (id: string | null) =>
    id ? (units.find(u => u.id === id)?.name ?? 'Unité supprimée') : 'Sans unité';

  const filteredHistory = history.filter(h =>
    historyUnit === 'all' ? true : (h.unit_id ?? 'none') === historyUnit
  );

  const loadHistory = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('aqua_diagnoses').select('*').order('created_at', { ascending: false }).limit(20);
    setHistory(data ?? []);
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
    if (user?.id && res.length > 0) {
      await supabase.from('aqua_diagnoses').insert({
        user_id: user.id,
        unit_id: activeUnit?.id ?? null,
        selected_symptoms: Array.from(selected),
        other_symptoms: otherSymptoms || null,
        results: res.map(r => ({ disease_id: r.disease.id, name: r.disease.name, score: r.score, risk: r.riskLevel })) as any,
        top_disease_id: res[0].disease.id,
        risk_level: res[0].riskLevel,
      });
      loadHistory();
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
              <Brain className="w-4 h-4 mr-2" />{running ? 'Analyse...' : 'Lancer le diagnostic'}
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

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" />Historique des diagnostics</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map(h => (
                <div key={h.id} className="flex items-center justify-between p-2 border rounded-md text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                    <Badge variant="outline">{(h.selected_symptoms ?? []).length} symptômes</Badge>
                    {h.risk_level && <Badge className={RISK_COLOR[h.risk_level]}>{RISK_LABEL[h.risk_level]}</Badge>}
                  </div>
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