import React from 'react';
import { Boxes } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import FeedStockManager from './feeding/FeedStockManager';
import StockMovementsPanel from './feeding/StockMovementsPanel';
import ProductionUnitSelector from './ProductionUnitSelector';

const StockManagement: React.FC = () => {
  const { activeUnit } = useProductionUnits();
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
      <FeedStockManager key={activeUnit.id} unitId={activeUnit.id} onStockUpdate={() => undefined} />
      <StockMovementsPanel key={`movements-${activeUnit.id}`} unitId={activeUnit.id} />
    </div>
  );
};

export default StockManagement;
