import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileJson, Loader2, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { createUnitBackup, readUnitBackup, UNIT_BACKUP_TABLES, type UnitBackup, type UnitBackupTable } from '@/lib/unitBackup';

const LABELS: Record<UnitBackupTable, string> = {
  production_units: 'Unité', unit_infrastructures: 'Infrastructures', unit_equipment: 'Matériel',
  purchases: 'Achats', accounting_transactions: 'Écritures comptables', depreciable_assets: 'Amortissements',
  feed_stocks: 'Stocks', livestock_batches: 'Cheptel', production_cycles: 'Cycles de production',
  cycle_infrastructures: 'Infrastructures de cycle', health_records: 'Relevés de santé', feeding_records: 'Nourrissage',
  feeding_plans: 'Programmes d’alimentation', feeding_sheets: 'Fiches d’alimentation', reproduction_records: 'Reproduction',
  sales: 'Ventes', sale_items: 'Articles vendus', cash_sessions: 'Sessions de caisse', cash_movements: 'Opérations de caisse',
  treasury_accounts: 'Comptes de trésorerie', treasury_movements: 'Mouvements de trésorerie',
};

export const BackupManagement = () => {
  const { user } = useAuth();
  const { units, activeUnit } = useProductionUnits();
  const { toast } = useToast();
  const [unitChoice, setUnitChoice] = useState<string | null>(null);
  const selectedUnitId = unitChoice ?? activeUnit?.id ?? (units.length === 1 ? units[0].id : '');
  const selectedUnit = units.find(u => u.id === selectedUnitId);
  const [selectedTables, setSelectedTables] = useState<UnitBackupTable[]>([...UNIT_BACKUP_TABLES]);
  const [isExporting, setIsExporting] = useState(false);
  const [preview, setPreview] = useState<UnitBackup | null>(null);
  const [fileError, setFileError] = useState('');

  const handleExport = async () => {
    if (!user || !selectedUnit || !selectedTables.length) return;
    setIsExporting(true);
    try {
      const backup = await createUnitBackup({
        read: async (table, column, ids, offset, limit) => {
          const { data, error } = await supabase.from(table as any).select('*').in(column, ids).order('id').range(offset, offset + limit - 1);
          if (error) throw new Error(`${LABELS[table]} : ${error.message}`);
          return (data ?? []) as unknown as Record<string, unknown>[];
        },
      }, { id: selectedUnit.id, name: selectedUnit.name }, selectedTables);
      readUnitBackup(backup);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `aquapilote-unite-${selectedUnit.id}-${backup.exportDate.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: 'Sauvegarde téléchargée', description: selectedUnit.name });
    } catch (error) {
      toast({ title: 'Sauvegarde interrompue', description: error instanceof Error ? error.message : 'Impossible de lire les données. Aucun fichier incomplet téléchargé.', variant: 'destructive' });
    } finally { setIsExporting(false); }
  };

  const handleFile = async (file?: File) => {
    setPreview(null); setFileError('');
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error('Fichier trop volumineux (50 Mo maximum).');
      setPreview(readUnitBackup(JSON.parse(await file.text())));
    } catch (error) { setFileError(error instanceof Error ? error.message : 'Fichier illisible.'); }
  };

  return <div className="min-w-0 space-y-4">
    <h2 className="flex items-center gap-2 text-xl font-semibold"><FileJson className="h-5 w-5 shrink-0 text-primary" />Sauvegarde par unité</h2>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader><CardTitle className="text-base">Télécharger une sauvegarde</CardTitle><CardDescription>Données accessibles de l’unité sélectionnée. Les photos et fichiers joints ne sont pas inclus.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label htmlFor="backup-unit">Unité à sauvegarder</Label>
            <Select value={selectedUnit?.id ?? ''} onValueChange={setUnitChoice} disabled={isExporting}>
              <SelectTrigger id="backup-unit" className="w-full min-w-0"><SelectValue placeholder="Choisir une unité" /></SelectTrigger>
              <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!units.length && <p className="text-sm text-muted-foreground">Aucune unité accessible.</p>}
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" disabled={isExporting} onClick={() => setSelectedTables([...UNIT_BACKUP_TABLES])}>Tout sélectionner</Button>
            <Button size="sm" variant="outline" disabled={isExporting} onClick={() => setSelectedTables([])}>Désélectionner</Button>
          </div>
          <div className="grid max-h-72 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
            {UNIT_BACKUP_TABLES.map(table => <div key={table} className="flex min-w-0 items-start gap-2">
              <Checkbox id={`backup-${table}`} disabled={isExporting} checked={selectedTables.includes(table)} onCheckedChange={checked => setSelectedTables(prev => checked ? [...prev, table] : prev.filter(t => t !== table))} />
              <Label htmlFor={`backup-${table}`} className="min-w-0 cursor-pointer break-words leading-4">{LABELS[table]}</Label>
            </div>)}
          </div>
          <Button className="w-full" disabled={isExporting || !selectedUnit || !selectedTables.length || !user} onClick={handleExport}>
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {isExporting ? 'Préparation…' : 'Télécharger la sauvegarde'}
          </Button>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FolderOpen className="h-4 w-4" />Consulter une sauvegarde</CardTitle><CardDescription>La consultation ne modifie aucune donnée de l’application. La restauration automatique n’est pas disponible.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <Label htmlFor="backup-file">Fichier de sauvegarde de l’unité</Label>
          <Input id="backup-file" type="file" accept=".json,application/json" onChange={e => void handleFile(e.target.files?.[0])} />
          {fileError && <p role="alert" className="text-sm text-destructive">{fileError}</p>}
          {preview && <div className="min-w-0 space-y-3">
            <div className="text-sm"><p className="break-words font-semibold">{preview.unit.name}</p><p className="text-muted-foreground">{new Date(preview.exportDate).toLocaleString('fr-FR')}</p></div>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {Object.entries(preview.data).map(([table, rows]) => <details key={table} className="border-b pb-2">
                <summary className="cursor-pointer text-sm">{LABELS[table as UnitBackupTable]} · {rows?.length ?? 0}</summary>
                <pre className="mt-2 max-h-64 overflow-auto bg-muted p-2 text-xs">{JSON.stringify(rows, null, 2)}</pre>
              </details>)}
            </div>
          </div>}
        </CardContent>
      </Card>
    </div>
  </div>;
};
export default BackupManagement;
