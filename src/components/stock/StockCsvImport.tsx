import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileDown, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Trash2 } from 'lucide-react';

interface CsvRow {
  name: string;
  quantity: number;
  unit: string;
  cost?: number;
  supplier?: string;
  min_threshold?: number;
}

/** Parse un CSV simple : nom;quantité;unité;prix;fournisseur;seuil (séparateur ; ou ,). */
export const parseStockCsv = (text: string): CsvRow[] => {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const rows = lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
  // Ignore l'en-tête si la première ligne contient « nom » ou « name »
  const start = /nom|name|produit|article/i.test(rows[0][0] || '') ? 1 : 0;
  return rows.slice(start).map((cols) => ({
    name: cols[0] || '',
    quantity: Number((cols[1] || '0').replace(',', '.')) || 0,
    unit: cols[2] || 'kg',
    cost: cols[3] ? Number(cols[3].replace(',', '.')) || 0 : undefined,
    supplier: cols[4] || undefined,
    min_threshold: cols[5] ? Number(cols[5].replace(',', '.')) || 0 : undefined,
  })).filter((r) => r.name && r.quantity >= 0);
};

const StockCsvImport: React.FC<{ unitId: string; onDone: () => void; onViewStocks?: () => void }> = ({ unitId, onDone, onViewStocks }) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState(0);
  const [running, setRunning] = useState(false);
  const importing = useRef(false);
  const stopRequested = useRef(false);
  const [results, setResults] = useState<{ row: CsvRow; success: boolean }[]>([]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseStockCsv(text);
    setRows(parsed);
    setImported(0);
    setErrors(0);
    setProgress(null);
    setResults([]);
    if (!parsed.length) {
      toast({ title: 'Fichier vide ou illisible', description: 'Format attendu : nom;quantité;unité;prix;fournisseur;seuil', variant: 'destructive' });
    }
  };

  const runImport = async () => {
    if (importing.current || !unitId || !rows.length) return;
    importing.current = true;
    setRunning(true);
    stopRequested.current = false;
    setResults([]);
    let ok = 0;
    let ko = 0;
    try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Connectez-vous avant de téléverser les produits.');
    setProgress(0);
    for (let i = 0; i < rows.length; i++) {
      if (stopRequested.current) break;
      const r = rows[i];
      const { error } = await (supabase as any).from('feed_stocks').insert({
        user_id: user.id,
        unit_id: unitId,
        feed_type: r.name,
        custom_name: r.name,
        quantity: r.quantity,
        unit: r.unit,
        cost: r.cost,
        supplier: r.supplier,
        min_threshold: r.min_threshold,
      });
      if (error) ko++; else ok++;
      setResults(previous => [...previous, { row: r, success: !error }]);
      setImported(ok);
      setErrors(ko);
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    toast({ title: stopRequested.current ? 'Import arrêté' : 'Import terminé', description: `${ok} article(s) ajouté(s) au stock${ko ? `, ${ko} en erreur` : ''}.` });
    onDone();
    } catch {
      toast({ title: 'Import interrompu', description: 'Vérifiez votre connexion et consultez les articles déjà enregistrés avant de relancer un import.', variant: 'destructive' });
      onDone();
    } finally { setRunning(false); importing.current = false; }
  };

  const cancelPreview = () => {
    setRows([]); setProgress(null); setImported(0); setErrors(0); setResults([]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const downloadTemplate = () => {
    const csv = 'nom;quantité;unité;prix;fournisseur;seuil\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modele_import_stock.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Upload className="w-4 h-4 text-primary" /> Importer un stock depuis un fichier CSV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Le fichier doit contenir une ligne par article : <b>nom; quantité; unité; prix; fournisseur; seuil d'alerte</b>.
          Chaque article importé reçoit automatiquement un code-barres.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileDown className="w-4 h-4 mr-1" /> Télécharger le modèle
          </Button>
          <Button size="sm" disabled={running} onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Choisir un fichier CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="hidden"
            disabled={running}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>

        {rows.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{rows.length} article(s) détecté(s) dans le fichier</p>
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left p-2">Article</th>
                    <th className="text-right p-2">Quantité</th>
                    <th className="text-left p-2">Unité</th>
                    <th className="text-right p-2">Prix</th>
                    <th className="p-2">{progress === null ? 'Retirer' : 'Résultat'}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2">{progress === null ? <Input aria-label={`Nom import ${i + 1}`} value={r.name} onChange={e => setRows(previous => previous.map((row, index) => index === i ? { ...row, name: e.target.value } : row))} /> : r.name}</td>
                      <td className="p-2 text-right">{progress === null ? <Input aria-label={`Quantité import ${i + 1}`} type="number" min="0" step="any" value={r.quantity} onChange={e => setRows(previous => previous.map((row, index) => index === i ? { ...row, quantity: Number(e.target.value) } : row))} /> : r.quantity}</td>
                      <td className="p-2">{r.unit}</td>
                      <td className="p-2 text-right">{progress === null ? <Input aria-label={`Coût import ${i + 1}`} type="number" min="0" step="any" value={r.cost ?? ''} onChange={e => setRows(previous => previous.map((row, index) => index === i ? { ...row, cost: Number(e.target.value) } : row))} /> : r.cost ?? '—'}</td>
                      <td className="p-2">{progress === null ? <Button size="icon" variant="ghost" aria-label={`Retirer ${r.name} de l’import`} onClick={() => setRows(previous => previous.filter((_, index) => index !== i))}><Trash2 className="h-4 w-4" /></Button> : results[i] ? (results[i].success ? 'Ajouté au stock' : 'Non ajouté') : running ? 'En attente' : 'Non traité'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {progress === null ? (
              <div className="flex flex-wrap gap-2"><Button disabled={running || rows.some(row => !row.name.trim() || !Number.isFinite(row.quantity) || row.quantity < 0 || (row.cost !== undefined && (!Number.isFinite(row.cost) || row.cost < 0)))} onClick={runImport}>Lancer l'import ({rows.length} articles)</Button><Button variant="outline" disabled={running} onClick={cancelPreview}>Annuler l’import</Button></div>
            ) : (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  {running ? `Téléversement en cours… ${progress}%` : (
                    <><CheckCircle2 className="w-3 h-3 text-green-600" /> {imported} article(s) entré(s) en stock{errors > 0 && <span className="text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{errors} en erreur</span>}</>
                  )}
                </p>
                {running ? <Button variant="outline" onClick={() => { stopRequested.current = true; }}>Arrêter après le produit en cours</Button> : <div className="flex flex-wrap gap-2">{onViewStocks && <Button onClick={onViewStocks}>Voir et corriger les produits en stock</Button>}<Button variant="outline" onClick={cancelPreview}>Nouveau fichier</Button></div>}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StockCsvImport;
