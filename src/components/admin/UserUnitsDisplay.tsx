import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Building2, Factory, Warehouse, FlaskConical, Package, Store, Leaf } from 'lucide-react';
import { ProductionUnitType } from '@/contexts/ProductionUnitsContext';

interface UserUnit {
  id: string;
  name: string;
  type: ProductionUnitType;
  isActive: boolean;
}

interface UserUnitsDisplayProps {
  units: UserUnit[];
  compact?: boolean;
}

const unitTypeIcons: Record<ProductionUnitType, React.ReactNode> = {
  ecloserie: <FlaskConical className="w-3 h-3" />,
  grossissement: <Building2 className="w-3 h-3" />,
  transformation: <Factory className="w-3 h-3" />,
  conservation: <Warehouse className="w-3 h-3" />,
  fabrication_aliment: <Package className="w-3 h-3" />,
  algoculture: <Leaf className="w-3 h-3" />,
  commercialisation: <Store className="w-3 h-3" />
};

const unitTypeLabels: Record<ProductionUnitType, string> = {
  ecloserie: 'Écloserie',
  grossissement: 'Grossissement',
  transformation: 'Transformation',
  conservation: 'Conservation',
  fabrication_aliment: 'Fab. Aliment',
  algoculture: 'Algoculture',
  commercialisation: 'Commercial'
};

const unitTypeColors: Record<ProductionUnitType, string> = {
  ecloserie: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  grossissement: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  transformation: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  conservation: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  fabrication_aliment: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  algoculture: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  commercialisation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
};

const UserUnitsDisplay: React.FC<UserUnitsDisplayProps> = ({ units, compact = false }) => {
  if (!units || units.length === 0) {
    return (
      <span className="text-sm text-muted-foreground italic">
        Aucune unité
      </span>
    );
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {units.slice(0, 3).map((unit) => (
          <Badge 
            key={unit.id} 
            variant="outline" 
            className={`text-xs ${unitTypeColors[unit.type]} border-0`}
          >
            {unitTypeIcons[unit.type]}
            <span className="ml-1">{unitTypeLabels[unit.type]}</span>
          </Badge>
        ))}
        {units.length > 3 && (
          <Badge variant="secondary" className="text-xs">
            +{units.length - 3}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {units.map((unit) => (
        <div 
          key={unit.id}
          className="flex items-center justify-between p-2 bg-muted/30 rounded-lg"
        >
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded ${unitTypeColors[unit.type]}`}>
              {unitTypeIcons[unit.type]}
            </div>
            <div>
              <p className="text-sm font-medium">{unit.name}</p>
              <p className="text-xs text-muted-foreground">
                {unitTypeLabels[unit.type]}
              </p>
            </div>
          </div>
          <Badge variant={unit.isActive ? 'default' : 'secondary'}>
            {unit.isActive ? 'Actif' : 'Inactif'}
          </Badge>
        </div>
      ))}
    </div>
  );
};

export default UserUnitsDisplay;
