import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useProductionUnits, ProductionUnitType } from '@/contexts/ProductionUnitsContext';
const ProductionUnitSelector = () => {
  const {
    units,
    activeUnit,
    setActiveUnit
  } = useProductionUnits();
  const getUnitTypeLabel = (type: ProductionUnitType) => {
    switch (type) {
      case 'ecloserie':
        return 'Écloserie';
      case 'grossissement':
        return 'Grossissement';
      case 'transformation':
        return 'Transformation';
      case 'conservation':
        return 'Conservation';
      case 'fabrication_aliment':
        return 'Fabrication Aliment';
      case 'algoculture':
        return 'Algoculture';
      case 'commercialisation':
        return 'Commercialisation';
    }
  };
  const getUnitTypeColor = (type: ProductionUnitType) => {
    switch (type) {
      case 'ecloserie':
        return 'bg-blue-100 text-blue-800';
      case 'grossissement':
        return 'bg-green-100 text-green-800';
      case 'transformation':
        return 'bg-orange-100 text-orange-800';
      case 'conservation':
        return 'bg-purple-100 text-purple-800';
      case 'fabrication_aliment':
        return 'bg-yellow-100 text-yellow-800';
      case 'algoculture':
        return 'bg-emerald-100 text-emerald-800';
      case 'commercialisation':
        return 'bg-red-100 text-red-800';
    }
  };
  return <div className="backdrop-blur-sm rounded-lg p-4 border border-white/20 bg-gray-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-white text-sm mb-2">Unité de Production Active</h3>
          <Select value={activeUnit?.id} onValueChange={value => {
          const unit = units.find(u => u.id === value);
          setActiveUnit(unit || null);
        }}>
            <SelectTrigger className="w-full sm:w-80 bg-white/20 border-white/30 text-white">
              <SelectValue placeholder="Sélectionner une unité" />
            </SelectTrigger>
            <SelectContent>
              {units.map(unit => <SelectItem key={unit.id} value={unit.id}>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{unit.name}</span>
                    <Badge className={getUnitTypeColor(unit.type)}>
                      {getUnitTypeLabel(unit.type)}
                    </Badge>
                  </div>
                </SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        
        {activeUnit && <div className="flex flex-col sm:flex-row gap-4 text-sm text-white">
            <div className="flex items-center space-x-2">
              <span className="text-blue-200">Stock:</span>
              <span className="font-bold">{activeUnit.currentStock.toLocaleString()}/{activeUnit.capacity.toLocaleString()}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-blue-200">Responsable:</span>
              <span className="font-bold">{activeUnit.manager}</span>
            </div>
          </div>}
      </div>
    </div>;
};
export default ProductionUnitSelector;