import React from 'react';
import { Users, Truck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ProductionUnitSelector from './ProductionUnitSelector';
import ClientManager from './economics/ClientManager';
import SuppliersManagement from './SuppliersManagement';

const CrmManagement: React.FC = () => {
  const { activeUnit } = useProductionUnits();

  if (!activeUnit) {
    return (
      <div className="min-w-0 space-y-4">
        <ProductionUnitSelector />
        <p className="p-6 text-center text-muted-foreground">
          Sélectionnez une unité de production pour voir ses clients et fournisseurs.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Clients & Fournisseurs</h1>
          <p className="break-words text-sm text-muted-foreground">{activeUnit.name}</p>
        </div>
      </div>
      <ProductionUnitSelector />
      <Tabs defaultValue="clients" className="space-y-4">
        <TabsList className="rounded-xl">
          <TabsTrigger value="clients" className="text-xs sm:text-sm">
            <Users className="w-4 h-4 mr-1" /> Clients
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="text-xs sm:text-sm">
            <Truck className="w-4 h-4 mr-1" /> Fournisseurs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="clients">
          <ClientManager />
        </TabsContent>
        <TabsContent value="suppliers">
          <SuppliersManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CrmManagement;
