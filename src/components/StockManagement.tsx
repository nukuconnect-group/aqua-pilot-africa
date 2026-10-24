import React, { useState } from 'react';
import { Boxes, Upload, Tag, History } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useFeedStocks } from '@/hooks/useFeedStocks';
import FeedStockManager from './feeding/FeedStockManager';
import StockMovementsPanel from './feeding/StockMovementsPanel';
import StockCsvImport from './stock/StockCsvImport';
import StockBarcodeLabels from './stock/StockBarcodeLabels';
import ProductionUnitSelector from './ProductionUnitSelector';
import { stocksForUnitType } from '@/lib/stockPurpose';

const StockManagement: React.FC = () => {
  const { activeUnit } = useProductionUnits();
  const { stocks, refetch } = useFeedStocks(activeUnit?.id);
  const [tab, setTab] = useState('stocks');

  if (!activeUnit) {
    return <div className="min-w-0 space-y-4"><ProductionUnitSelector /><p className="p-6 text-center text-muted-foreground">Sélectionnez une unité de production pour gérer son stock.</p></div>;
  }
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Stock</h1>
          <p className="break-words text-sm text-muted-foreground">{activeUnit.name}</p>
        </div>
      </div>
      <ProductionUnitSelector />
      <Tabs key={activeUnit.id} value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="stocks" className="text-xs sm:text-sm">
            <Boxes className="w-4 h-4 mr-1" /> Articles
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs sm:text-sm">
            <Upload className="w-4 h-4 mr-1" /> Import CSV
          </TabsTrigger>
          <TabsTrigger value="labels" className="text-xs sm:text-sm">
            <Tag className="w-4 h-4 mr-1" /> Codes-barres
          </TabsTrigger>
          <TabsTrigger value="movements" className="text-xs sm:text-sm">
            <History className="w-4 h-4 mr-1" /> Mouvements
          </TabsTrigger>
        </TabsList>
        <TabsContent value="stocks">
          <FeedStockManager key={activeUnit.id} unitId={activeUnit.id} onStockUpdate={() => refetch()} />
        </TabsContent>
        <TabsContent value="import">
          <StockCsvImport key={activeUnit.id} unitId={activeUnit.id} onDone={() => refetch()} onViewStocks={() => setTab('stocks')} />
        </TabsContent>
        <TabsContent value="labels">
            <StockBarcodeLabels stocks={stocksForUnitType(stocks, activeUnit.type)} />
        </TabsContent>
        <TabsContent value="movements">
          <StockMovementsPanel key={`movements-${activeUnit.id}`} unitId={activeUnit.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StockManagement;
