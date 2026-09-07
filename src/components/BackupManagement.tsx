import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Download, Upload, FileJson, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BackupData {
  version: string;
  exportDate: string;
  userId: string;
  data: {
    production_units?: any[];
    unit_infrastructures?: any[];
    unit_equipment?: any[];
    purchases?: any[];
    accounting_transactions?: any[];
    depreciable_assets?: any[];
    feed_stocks?: any[];
    livestock_batches?: any[];
    production_cycles?: any[];
    cycle_infrastructures?: any[];
    health_records?: any[];
    feeding_records?: any[];
    feeding_plans?: any[];
    reproduction_records?: any[];
  };
}

const DATA_TABLES = [
  { key: 'production_units', label: 'Unités de production', icon: '🏭' },
  { key: 'unit_infrastructures', label: 'Infrastructures', icon: '🏗️' },
  { key: 'unit_equipment', label: 'Équipements', icon: '⚙️' },
  { key: 'purchases', label: 'Achats', icon: '🛒' },
  { key: 'accounting_transactions', label: 'Transactions comptables', icon: '💰' },
  { key: 'depreciable_assets', label: 'Actifs amortissables', icon: '📊' },
  { key: 'feed_stocks', label: 'Stocks d\'aliments', icon: '🌾' },
  { key: 'livestock_batches', label: 'Lots de cheptel', icon: '🐟' },
  { key: 'production_cycles', label: 'Cycles de production', icon: '🔄' },
  { key: 'cycle_infrastructures', label: 'Infrastructures de cycle', icon: '🏠' },
  { key: 'health_records', label: 'Enregistrements de santé', icon: '🏥' },
  { key: 'feeding_records', label: 'Enregistrements d\'alimentation', icon: '🍽️' },
  { key: 'feeding_plans', label: 'Plans d\'alimentation', icon: '📋' },
  { key: 'reproduction_records', label: 'Enregistrements de reproduction', icon: '🥚' },
];

export const BackupManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>(DATA_TABLES.map(t => t.key));
  const [importFile, setImportFile] = useState<File | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [importPreview, setImportPreview] = useState<BackupData | null>(null);

  const toggleTable = (key: string) => {
    setSelectedTables(prev => 
      prev.includes(key) 
        ? prev.filter(k => k !== key)
        : [...prev, key]
    );
  };

  const selectAll = () => setSelectedTables(DATA_TABLES.map(t => t.key));
  const deselectAll = () => setSelectedTables([]);

  const handleExport = async () => {
    if (!user) {
      toast({ title: 'Erreur', description: 'Vous devez être connecté', variant: 'destructive' });
      return;
    }

    if (selectedTables.length === 0) {
      toast({ title: 'Erreur', description: 'Sélectionnez au moins une table', variant: 'destructive' });
      return;
    }

    setIsExporting(true);
    try {
      const backupData: BackupData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        userId: user.id,
        data: {}
      };

      for (const tableKey of selectedTables) {
        const { data, error } = await supabase
          .from(tableKey as any)
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error(`Error fetching ${tableKey}:`, error);
          continue;
        }

        (backupData.data as any)[tableKey] = data || [];
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aquapilot-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ title: 'Succès', description: 'Sauvegarde exportée avec succès' });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: 'Erreur', description: 'Échec de l\'exportation', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as BackupData;

      if (!data.version || !data.data) {
        toast({ title: 'Erreur', description: 'Format de fichier invalide', variant: 'destructive' });
        return;
      }

      setImportFile(file);
      setImportPreview(data);
    } catch (error) {
      toast({ title: 'Erreur', description: 'Impossible de lire le fichier', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (!user || !importPreview) return;

    setIsImporting(true);
    setShowImportConfirm(false);

    try {
      let importedCount = 0;
      let errorCount = 0;

      for (const [tableKey, records] of Object.entries(importPreview.data)) {
        if (!records || !Array.isArray(records) || records.length === 0) continue;

        // Update user_id to current user
        const updatedRecords = records.map(record => ({
          ...record,
          user_id: user.id,
          id: undefined // Remove id to let Supabase generate new ones
        }));

        const { error } = await supabase
          .from(tableKey as any)
          .insert(updatedRecords);

        if (error) {
          console.error(`Error importing ${tableKey}:`, error);
          errorCount++;
        } else {
          importedCount++;
        }
      }

      if (errorCount > 0) {
        toast({ 
          title: 'Import partiel', 
          description: `${importedCount} tables importées, ${errorCount} erreurs`,
          variant: 'destructive'
        });
      } else {
        toast({ title: 'Succès', description: 'Données importées avec succès' });
      }

      setImportFile(null);
      setImportPreview(null);
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: 'Erreur', description: 'Échec de l\'importation', variant: 'destructive' });
    } finally {
      setIsImporting(false);
    }
  };

  const getRecordCount = (data: BackupData['data']) => {
    return Object.values(data).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <FileJson className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Gestion des sauvegardes</h1>
          <p className="text-muted-foreground">Exportez et importez vos données</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Exporter les données
            </CardTitle>
            <CardDescription>
              Téléchargez une sauvegarde de vos données au format JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                Tout sélectionner
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                Tout désélectionner
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
              {DATA_TABLES.map(table => (
                <div key={table.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`export-${table.key}`}
                    checked={selectedTables.includes(table.key)}
                    onCheckedChange={() => toggleTable(table.key)}
                  />
                  <Label htmlFor={`export-${table.key}`} className="flex items-center gap-2 cursor-pointer">
                    <span>{table.icon}</span>
                    <span>{table.label}</span>
                  </Label>
                </div>
              ))}
            </div>

            <Button 
              onClick={handleExport} 
              disabled={isExporting || selectedTables.length === 0}
              className="w-full"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exportation...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Exporter ({selectedTables.length} tables)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importer les données
            </CardTitle>
            <CardDescription>
              Restaurez vos données depuis une sauvegarde JSON
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-file">Fichier de sauvegarde</Label>
              <Input
                id="import-file"
                type="file"
                accept=".json"
                onChange={handleFileSelect}
              />
            </div>

            {importPreview && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>Fichier valide</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <p>Version: {importPreview.version}</p>
                    <p>Date: {new Date(importPreview.exportDate).toLocaleDateString('fr-FR')}</p>
                    <p>Total: {getRecordCount(importPreview.data)} enregistrements</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Tables incluses:
                    <ul className="list-disc list-inside mt-1">
                      {Object.entries(importPreview.data).map(([key, records]) => {
                        if (!records?.length) return null;
                        const table = DATA_TABLES.find(t => t.key === key);
                        return (
                          <li key={key}>
                            {table?.icon} {table?.label || key}: {records.length}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg text-sm">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <span className="text-yellow-700 dark:text-yellow-400">
                L'importation ajoutera de nouvelles données sans supprimer les existantes.
              </span>
            </div>

            <Button 
              onClick={() => setShowImportConfirm(true)}
              disabled={isImporting || !importPreview}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importation...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Importer les données
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showImportConfirm} onOpenChange={setShowImportConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer l'importation</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir importer ces données ? Cette action ajoutera 
              {importPreview && ` ${getRecordCount(importPreview.data)} enregistrements`} à votre compte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleImport}>
              Importer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BackupManagement;
