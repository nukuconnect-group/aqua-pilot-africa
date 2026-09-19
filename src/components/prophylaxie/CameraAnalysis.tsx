import { getRuntimeLanguage } from '@/i18n/runtime';
import React, { useState, useRef } from 'react';
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
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useToast } from '@/components/ui/use-toast';

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
          <AlertCircle className="w-4 h-4 text-orange-600" />Maladies détectées
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {result.diseases.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune maladie identifiée.</p>
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
);

export const analyzeWithAI = async (payload: {
  mode: 'image' | 'species';
  imageBase64?: string;
  species?: string;
}): Promise<VisionResult> => {
  const { data, error } = await supabase.functions.invoke('aqua-health-vision', { body: { ...payload, language: getRuntimeLanguage() } });
  if (error) {
    const message = (data as any)?.error || error.message || "L'analyse IA a échoué";
    throw new Error(message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as VisionResult;
};

const CameraAnalysis = () => {
  const { activeUnit } = useProductionUnits();
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [species, setSpecies] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState<VisionResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    try {
      const imageBase64 = await toDataUrl(selectedFile);
      const res = await analyzeWithAI({ mode: 'image', imageBase64, species: species.trim() || undefined });
      setResult(res);
      toast({ title: 'Analyse terminée', description: `${res.diseases.length} anomalie(s) évaluée(s).` });
    } catch (e: any) {
      toast({ title: 'Analyse impossible', description: e?.message ?? 'Erreur inconnue', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => { setSelectedFile(null); setPreviewUrl(''); setResult(null); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="w-4 h-4 text-primary" />
            Détection de maladie par caméra{activeUnit ? ` — ${activeUnit.name}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="ah-species">Espèce (facultatif mais recommandé)</Label>
            <Input
              id="ah-species"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="Ex : Tilapia du Nil, Clarias gariepinus..."
            />
          </div>

          {!selectedFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors"
            >
              <Camera className="w-10 h-10 mx-auto mb-2 text-primary" />
              <p className="font-medium">Prendre ou importer une photo</p>
              <p className="text-sm text-muted-foreground">L'IA identifie les signes cliniques visibles</p>
              <span className="mt-3 inline-flex items-center text-sm text-primary">
                <Upload className="w-4 h-4 mr-1" />Sélectionner une photo
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-muted">
                <img src={previewUrl} alt="Poissons à analyser" className="w-full max-h-80 object-contain" />
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
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />
        </CardContent>
      </Card>

      {result && <VisionResultView result={result} />}
    </div>
  );
};

export default CameraAnalysis;
