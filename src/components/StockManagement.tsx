import React from 'react';
import { Boxes } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import FeedStockManager from './feeding/FeedStockManager';
import StockMovementsPanel from './feeding/StockMovementsPanel';

const StockManagement: React.FC = () => {
  const { activeUnit } = useProductionUnits();
  if (!activeUnit) {
    return <p className="p-6 text-center text-muted-foreground">Sélectionnez une unité de production pour gérer son stock.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Boxes className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Stock</h1>
          <p className="text-xs text-muted-foreground">
            {activeUnit.name} · Créez vos articles (aliments, intrants, matériel…), suivez les entrées, sorties et inventaires. Chaque nourrissage diminue automatiquement le stock.
          </p>
        </div>
      </div>
      <FeedStockManager unitId={activeUnit.id} onStockUpdate={() => undefined} />
      <StockMovementsPanel unitId={activeUnit.id} />
    </div>
  );
};

export default StockManagement;
