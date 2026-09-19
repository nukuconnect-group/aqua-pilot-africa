import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FlaskConical, FolderOpen, Boxes, Factory, Wallet, Package, LayoutDashboard, ShieldCheck, ScanLine, Workflow } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useFeedMill, StoredFormulation } from './useFeedMill';
import FormulationStudio from './FormulationStudio';
import IngredientLibrary from './IngredientLibrary';
import FormulationsList from './FormulationsList';
import ManufacturingHistory from './ManufacturingHistory';
import ManufactureDialog from './ManufactureDialog';
import FeedLabStudio from './FeedLabStudio';
import FeedMillDashboard from './FeedMillDashboard';
import useFeedOperations from './useFeedOperations';
import FeedQualityControls from './FeedQualityControls';
import FeedProductionCycles from './FeedProductionCycles';
import FeedTraceability from './FeedTraceability';
import { useSettings } from '@/contexts/SettingsContext';
import { tr } from '@/i18n/runtime';

interface Props { onBack: () => void; }

const FeedMillWorkspace: React.FC<Props> = ({ onBack }) => {
  const { formatCurrency, activeUnit } = useProductionUnits();
  const { language } = useSettings();
  const text = (value: string) => tr(value, language);
  const mill = useFeedMill();
  const [tab, setTab] = useState('dashboard');
  const [editing, setEditing] = useState<StoredFormulation | null>(null);
  const [toManufacture, setToManufacture] = useState<StoredFormulation | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetIngredientIds, setPresetIngredientIds] = useState<string[]>([]);
  const ops = useFeedOperations();

  const stats = useMemo(() => {
    const producedKg = mill.batches.reduce((s, b) => s + Number(b.quantity_kg || 0), 0);
    const cost = mill.batches.reduce((s, b) => s + Number(b.total_cost || 0), 0);
    return {
      formulations: mill.formulations.filter(f => f.status !== 'archived').length,
      ingredients: mill.ingredients.length,
      producedKg,
      avgCost: producedKg > 0 ? cost / producedKg : 0,
    };
  }, [mill.formulations, mill.ingredients, mill.batches]);

  const openManufacture = (f: StoredFormulation) => { setToManufacture(f); setDialogOpen(true); };

  const duplicate = async (f: StoredFormulation) => {
    const { id, created_at, ...rest } = f as any;
    await mill.saveFormulation({ ...rest, name: `${f.name} (copie)`, status: 'active' });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1.5" />AquaFeed AI</Button>
          <div>
            <h2 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />{text("Fabrication & Formulation d'aliments")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {text('Formulez, optimisez, fabriquez et suivez vos aliments')}{activeUnit ? ` — ${activeUnit.name}` : ''}.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
         <Kpi icon={<FolderOpen className="w-4 h-4" />} label={text('Formulations actives')} value={String(stats.formulations)} />
         <Kpi icon={<Boxes className="w-4 h-4" />} label={text('Matières premières')} value={String(stats.ingredients)} />
         <Kpi icon={<Package className="w-4 h-4" />} label={text('Aliment fabriqué')} value={`${stats.producedKg.toFixed(1)} kg`} />
         <Kpi icon={<Wallet className="w-4 h-4" />} label={text('Coût moyen / kg')} value={formatCurrency(stats.avgCost)} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-9 w-full">
          <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1.5" />{text('Tableau de bord')}</TabsTrigger>
          <TabsTrigger value="lab"><FlaskConical className="w-4 h-4 mr-1.5" />{text('Laboratoire')}</TabsTrigger>
          <TabsTrigger value="studio"><FlaskConical className="w-4 h-4 mr-1.5" />{text('Formuler')}</TabsTrigger>
          <TabsTrigger value="formulations"><FolderOpen className="w-4 h-4 mr-1.5" />{text('Mes formulations')}</TabsTrigger>
          <TabsTrigger value="ingredients"><Boxes className="w-4 h-4 mr-1.5" />{text('Ingrédients')}</TabsTrigger>
          <TabsTrigger value="batches"><Factory className="w-4 h-4 mr-1.5" />{text('Fabrications')}</TabsTrigger>
          <TabsTrigger value="cycles"><Workflow className="w-4 h-4 mr-1.5" />{text('Cycles')}</TabsTrigger>
          <TabsTrigger value="quality"><ShieldCheck className="w-4 h-4 mr-1.5" />{text('Prophylaxie')}</TabsTrigger>
          <TabsTrigger value="trace"><ScanLine className="w-4 h-4 mr-1.5" />{text('Traçabilité')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <FeedMillDashboard
            formulations={mill.formulations}
            batches={mill.batches}
            ingredients={mill.ingredients}
            onNavigate={setTab}
          />
        </TabsContent>

        <TabsContent value="lab">
          <FeedLabStudio />
        </TabsContent>

        <TabsContent value="studio">
          <FormulationStudio
            ingredients={mill.ingredients}
            onSave={mill.saveFormulation}
            onManufacture={openManufacture}
            editing={editing}
            presetIngredientIds={presetIngredientIds}
            onClearEditing={() => setEditing(null)}
          />
        </TabsContent>

        <TabsContent value="formulations">
          <FormulationsList
            formulations={mill.formulations}
            onEdit={(f) => { setEditing(f); setTab('studio'); }}
            onDuplicate={duplicate}
            onDelete={mill.deleteFormulation}
            onStatus={mill.setFormulationStatus}
            onManufacture={openManufacture}
          />
        </TabsContent>

        <TabsContent value="ingredients">
          <IngredientLibrary
            ingredients={mill.ingredients}
            onSave={mill.saveIngredient}
            onDelete={mill.deleteIngredient}
            onUseSelection={(ids) => { setPresetIngredientIds(ids); setTab('studio'); }}
          />
        </TabsContent>

        <TabsContent value="batches">
          <ManufacturingHistory batches={mill.batches} onDelete={mill.deleteBatch} />
        </TabsContent>

        <TabsContent value="cycles">
          <FeedProductionCycles
            cycles={ops.cycles}
            formulationNames={mill.formulations.map(f => f.name)}
            onSave={ops.saveCycle}
            onDelete={ops.deleteCycle}
          />
        </TabsContent>

        <TabsContent value="quality">
          <FeedQualityControls controls={ops.controls} onSave={ops.saveControl} onDelete={ops.deleteControl} />
        </TabsContent>

        <TabsContent value="trace">
          <FeedTraceability records={ops.traces} onSave={ops.saveTrace} onDelete={ops.deleteTrace} />
        </TabsContent>
      </Tabs>

      <ManufactureDialog
        formulation={toManufacture}
        ingredients={mill.ingredients}
        batchCount={mill.batches.length}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConfirm={async (opts) => {
          const res = await mill.manufacture(opts);
          if (res) setTab('batches');
          return res;
        }}
      />
    </div>
  );
};

const Kpi: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <Card>
    <CardContent className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </CardContent>
  </Card>
);

export default FeedMillWorkspace;
