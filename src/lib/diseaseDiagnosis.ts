import { supabase } from '@/integrations/supabase/appClient';

export interface Symptom { id: string; key: string; label: string; description: string | null }
export interface Disease {
  id: string;
  name: string;
  category: string;
  description: string | null;
  causes: string | null;
  favoring_factors: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mortality_rate_pct: number | null;
  prevention: string | null;
}
export interface DiseaseTreatment {
  id: string;
  disease_id: string;
  name: string;
  active_ingredient: string | null;
  dosage: string | null;
  duration: string | null;
  administration: string | null;
  water_actions: string | null;
  isolation_required: boolean | null;
  follow_up: string | null;
}
export interface DiagnosisResult {
  disease: Disease;
  score: number; // 0..1
  matchedSymptoms: number;
  treatments: DiseaseTreatment[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export async function loadSymptoms(): Promise<Symptom[]> {
  const { data } = await supabase.from('disease_symptoms').select('*').eq('is_active', true).order('label');
  return (data ?? []) as Symptom[];
}

export async function runDiagnosis(symptomIds: string[]): Promise<DiagnosisResult[]> {
  if (symptomIds.length === 0) return [];
  const { data: maps } = await supabase
    .from('disease_symptom_map')
    .select('disease_id, symptom_id, weight');
  const { data: diseases } = await supabase
    .from('aqua_diseases')
    .select('*')
    .eq('is_active', true);
  const { data: treatments } = await supabase
    .from('disease_treatments')
    .select('*')
    .order('order_index');

  const allMaps = (maps ?? []) as Array<{ disease_id: string; symptom_id: string; weight: number }>;
  const diseasesById = new Map<string, Disease>((diseases ?? []).map((d: any) => [d.id, d]));
  const treatmentsByDisease = new Map<string, DiseaseTreatment[]>();
  (treatments ?? []).forEach((t: any) => {
    const arr = treatmentsByDisease.get(t.disease_id) ?? [];
    arr.push(t);
    treatmentsByDisease.set(t.disease_id, arr);
  });

  const totals = new Map<string, number>();
  const matched = new Map<string, { sum: number; count: number }>();
  allMaps.forEach(m => {
    totals.set(m.disease_id, (totals.get(m.disease_id) ?? 0) + Number(m.weight));
    if (symptomIds.includes(m.symptom_id)) {
      const prev = matched.get(m.disease_id) ?? { sum: 0, count: 0 };
      matched.set(m.disease_id, { sum: prev.sum + Number(m.weight), count: prev.count + 1 });
    }
  });

  const results: DiagnosisResult[] = [];
  matched.forEach((mm, did) => {
    const total = totals.get(did) ?? 1;
    const disease = diseasesById.get(did);
    if (!disease) return;
    const score = Math.min(1, mm.sum / total);
    let riskLevel: DiagnosisResult['riskLevel'] = 'low';
    if (score >= 0.7) riskLevel = disease.severity;
    else if (score >= 0.4) riskLevel = disease.severity === 'critical' ? 'high' : (disease.severity === 'high' ? 'high' : 'medium');
    else riskLevel = 'low';
    results.push({
      disease,
      score,
      matchedSymptoms: mm.count,
      treatments: treatmentsByDisease.get(did) ?? [],
      riskLevel,
    });
  });
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 5);
}
