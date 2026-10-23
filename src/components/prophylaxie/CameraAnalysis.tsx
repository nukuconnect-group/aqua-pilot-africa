import { getRuntimeLanguage } from '@/i18n/runtime';
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  Scan,
  FileDown,
} from 'lucide-react';
import { buildHealthReportPdf, shareOrDownloadPdf } from '@/lib/healthReportPdf';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useToast } from '@/components/ui/use-toast';
import { getUnitTerms, isAlgaeUnitType } from '@/lib/unitContext';
import { compressImage } from '@/lib/imageCompression';

export interface VisionDisease {
  name: string;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description?: string;
  causes?: string;
  treatment?: string;
  prevention?: string;
}

export interface VisionResult {
  subject?: string | null;
  isFishPhoto?: boolean;
  analysisAllowed?: boolean;
  rejectionReason?: string | null;
  species?: string | null;
  averageWeight?: number | null;
  observations?: string[];
  diseases: VisionDisease[];
  recommendations: string[];
}

export const severityColor = (severity: string) => {
  switch (severity) {
    case 'high': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'medium': return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30';
    default: return 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30';
  }
};

export const severityLabel = (severity: string) =>
  severity === 'high' ? 'Sévère' : severity === 'medium' ? 'Modéré' : 'Léger';

export const VisionResultView: React.FC<{ result: VisionResult }> = ({ result }) => (
  result.analysisAllowed === false ? (
    <div role="status" className="border rounded-lg p-4 space-y-2">
      <p className="font-semibold">Sujet reconnu : {result.subject || 'Non identifiable'}</p>
      <p className="text-sm text-muted-foreground">{result.rejectionReason || 'Cette image ne montre pas de vrais poissons. Analyse sanitaire impossible.'}</p>
    </div>
  ) : (
  <div className="space-y-3">
    {(result.species || result.averageWeight) && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {result.species && (
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Espèce</p>
            <p className="text-lg font-semibold">{result.species}</p>
          </CardContent></Card>
        )}
        {typeof result.averageWeight === 'number' && (
          <Card><CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Poids moyen estimé</p>
            <p className="text-lg font-semibold text-primary">{result.averageWeight} g</p>
          </CardContent></Card>
        )}
      </div>
    )}

    {result.observations && result.observations.length > 0 && (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Observations</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {result.observations.map((o, i) => <li key={i}>• {o}</li>)}
          </ul>
        </CardContent>
      </Card>
    )}

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-primary" />Hypothèses sanitaires
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.diseases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun signe de maladie identifié sur cette photo ; cela ne confirme pas l’absence de maladie.</p>
        ) : result.diseases.map((d, idx) => (
          <div key={idx} className={`p-3 border rounded-lg ${severityColor(d.severity)}`}>
            <div className="flex items-start justify-between gap-2 mb-1">
              <h4 className="font-semibold text-sm">{d.name}</h4>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline">{severityLabel(d.severity)}</Badge>
                {typeof d.confidence === 'number' && (
                  <span className="text-xs">{Math.round(d.confidence)}%</span>
                )}
              </div>
            </div>
            {d.description && <p className="text-xs mb-1">{d.description}</p>}
            {d.causes && <p className="text-xs"><strong>Causes :</strong> {d.causes}</p>}
            {d.treatment && <p className="text-xs"><strong>Traitement :</strong> {d.treatment}</p>}
            {d.prevention && <p className="text-xs"><strong>Prévention :</strong> {d.prevention}</p>}
          </div>
        ))}
      </CardContent>
    </Card>

    {result.recommendations.length > 0 && (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />Recommandations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {result.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    )}
  </div>
  )
);

export const analyzeWithAI = async (payload: {
  mode: 'image' | 'species';
  domain?: 'algae' | 'fish';
  imageBase64?: string;
  species?: string;
}): Promise<VisionResult> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Reconnectez-vous pour analyser une photo.');
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aqua-health-vision`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ ...payload, language: getRuntimeLanguage() }),
    });
  } catch { throw new Error('L’analyse n’a pas pu être jointe. Vérifiez votre connexion avant de réessayer.'); }
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.error) throw new Error(data?.error || (response.status === 401 ? 'Reconnectez-vous pour utiliser AquaHealth IA.' : 'L’analyse est indisponible pour le moment.'));
  if (!data || !Array.isArray(data.diseases) || !Array.isArray(data.recommendations)) throw new Error('La réponse est incomplète. Aucun diagnostic ne peut être affiché.');
  return data as VisionResult;
};

const CameraAnalysis = ({ onSaved }: { onSaved?: () => void }) => {
  const { activeUnit } = useProductionUnits();
  const saveToHistory = async (res: VisionResult) => {
    try {
      const { data: s } = await supabase.auth.getSession();
      const uid = s?.session?.user.id;
      if (!uid) return;
      const top = res.diseases[0];
      const { error } = await supabase.from('aqua_diagnoses').insert({
        user_id: uid,
        unit_id: activeUnit?.id ?? null,
        selected_symptoms: [],
        other_symptoms: `Analyse photo${res.species ? ` — ${res.species}` : ''}`,
        results: { source: 'photo', species: res.species ?? null, observations: res.observations ?? [], recommendations: res.recommendations ?? [], diseases: res.diseases } as any,
        risk_level: top?.severity ?? null,
        notes: top?.name ?? null,
      } as any);
      if (error) throw error;
      onSaved?.();
    } catch {
      toast({ title: 'Analyse non enregistrée dans l’historique', description: 'Le résultat reste affiché et peut être exporté.', variant: 'destructive' });
    }
  };
  const exportPdf = () => {
    if (!result) return;
    const blob = buildHealthReportPdf({
      title: 'Rapport d’analyse photo — AquaHealth AI',
      date: new Date(),
      unitName: activeUnit?.name ?? 'Toutes les unités',
      species: result.species,
      subject: result.subject,
      observations: result.observations,
      diseases: result.diseases.map((d: any) => ({ name: d.name, level: d.severity, confidence: d.confidence })),
      recommendations: result.recommendations,
    });
    shareOrDownloadPdf(blob, `analyse-photo-${new Date().toISOString().slice(0, 10)}.pdf`);
  };
  const isAlgae = isAlgaeUnitType(activeUnit?.type);
  const unitTerms = getUnitTerms(activeUnit?.type);
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [species, setSpecies] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState<VisionResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestVersion = useRef(0);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => {
    requestVersion.current += 1;
    setSelectedFile(null); setPreviewUrl(''); setResult(null); setSpecies(''); setAnalysisError(null); setAnalyzing(false);
  }, [activeUnit?.id]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Format non supporté', description: 'Sélectionnez une image (JPG ou PNG).', variant: 'destructive' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: 'Image trop lourde', description: 'Choisissez une photo de moins de 8 Mo.', variant: 'destructive' });
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setResult(null);
    setAnalysisError(null);
    requestVersion.current += 1;
  };

  const toDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.readAsDataURL(file);
  });

  const runAnalysis = async () => {
    if (!selectedFile || analyzing) return;
    setAnalyzing(true);
    setResult(null); setAnalysisError(null);
    const version = requestVersion.current;
    try {
      const converted = await compressImage(selectedFile, { maxWidth: 1600, maxHeight: 1600, maxSizeMB: 2 });
      const imageBase64 = await toDataUrl(converted.file);
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(imageBase64)) throw new Error('Format non pris en charge. Utilisez une photo JPG, PNG ou WebP.');
      const res = await analyzeWithAI({ mode: 'image', domain: 'fish', imageBase64, species: species.trim() || undefined });
      if (version !== requestVersion.current) return;
      setResult(res);
      if (res.analysisAllowed !== false) {
        toast({ title: 'Analyse terminée', description: `${res.diseases.length} hypothèse(s) évaluée(s).` });
        await saveToHistory(res);
      }
    } catch (e: any) {
      if (version === requestVersion.current) setAnalysisError(e?.message ?? 'L’analyse est indisponible pour le moment.');
    } finally {
      if (version === requestVersion.current) setAnalyzing(false);
    }
  };

  const reset = () => { requestVersion.current += 1; setSelectedFile(null); setPreviewUrl(''); setResult(null); setAnalysisError(null); setAnalyzing(false); if (fileInputRef.current) fileInputRef.current.value = ''; };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
             Analyse photo des poissons{activeUnit ? ` — ${activeUnit.name}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="ah-species">Espèce (facultatif mais recommandé)</Label>
            <Input
              id="ah-species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder={unitTerms.aiSpeciesPlaceholder}
            />
          </div>

          {!selectedFile ? (
            <Button
              variant="outline"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-auto border-dashed rounded-lg p-6 text-center flex flex-col whitespace-normal"
            >
              <Camera className="w-10 h-10 mx-auto mb-2 text-primary" />
              <p className="font-medium">Prendre ou importer une photo</p>
              <span className="mt-3 inline-flex items-center text-sm text-primary">
                <Upload className="w-4 h-4 mr-1" />Sélectionner une photo
              </span>
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-muted">
                  <img src={previewUrl} alt="Photo soumise à AquaHealth" className="w-full max-h-80 object-contain" />
                <Button size="icon" variant="secondary" className="absolute top-2 right-2" onClick={reset} aria-label="Retirer la photo">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <Button onClick={runAnalysis} disabled={analyzing} className="w-full">
                {analyzing
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyse en cours...</>
                  : <><Scan className="w-4 h-4 mr-2" />Lancer l'analyse IA</>}
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {analysisError && <p role="alert" className="text-sm text-destructive">{analysisError}</p>}
      {result && <VisionResultView result={result} />}
      {result && result.analysisAllowed !== false && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportPdf}><FileDown className="w-4 h-4 mr-2" />Exporter en PDF</Button>
        </div>
      )}
    </div>
  );
};

export default CameraAnalysis;
