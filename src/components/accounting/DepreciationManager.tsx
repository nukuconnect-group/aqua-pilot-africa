
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Calculator, TrendingDown } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLogs } from '@/contexts/LogsContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const DepreciationManager = () => {
  const { 
    depreciableAssets, 
    units,
    activeUnit,
    currency,
    addDepreciableAsset, 
    updateDepreciableAsset, 
    deleteDepreciableAsset,
    calculateDepreciation,
    convertCurrency
  } = useProductionUnits();
  const { addLog } = useLogs();

  const [showAssetForm, setShowAssetForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);

  const [newAsset, setNewAsset] = useState({
    name: '',
    category: '',
    purchasePrice: 0,
    currency: currency,
    purchaseDate: '',
    depreciationMethod: 'linear' as 'linear' | 'accelerated',
    usefulLife: 5,
    unitId: activeUnit?.id || '',
    status: 'active' as 'active' | 'disposed' | 'inactive'
  });

  useEffect(() => {
    if (!activeUnit?.id) return;
    setNewAsset((prev) => ({ ...prev, unitId: activeUnit.id }));
  }, [activeUnit?.id]);

  const assetCategories = [
    'Équipements de production',
    'Équipements de transformation',
    'Véhicules',
    'Matériel informatique',
    'Mobilier et aménagements',
    'Installations techniques',
    'Équipements de sécurité',
    'Autres équipements'
  ];

  const currencies = [
    { code: 'XOF', symbol: 'F CFA', name: 'Franc CFA' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dollar US' }
  ];

  const handleAddAsset = () => {
    const selectedUnit = units.find(u => u.id === newAsset.unitId);
    const currentValue = newAsset.purchasePrice;
    
    addDepreciableAsset({
      name: newAsset.name,
      category: newAsset.category,
      purchasePrice: Number(newAsset.purchasePrice),
      currency: newAsset.currency as 'XOF' | 'EUR' | 'USD' | 'MAD',
      purchaseDate: newAsset.purchaseDate,
      depreciationMethod: newAsset.depreciationMethod,
      usefulLife: newAsset.usefulLife,
      currentValue: currentValue,
      accumulatedDepreciation: 0,
      unitId: newAsset.unitId || undefined,
      status: newAsset.status
    });
    
    addLog('Équipement ajouté', 'Amortissements', `${newAsset.name} - ${newAsset.purchasePrice} ${newAsset.currency}`, 'success');
    resetForm();
  };

  const handleUpdateAsset = () => {
    if (!editingAsset) return;
    
    const selectedUnit = units.find(u => u.id === newAsset.unitId);
    updateDepreciableAsset(editingAsset.id, {
      name: newAsset.name,
      category: newAsset.category,
      purchasePrice: Number(newAsset.purchasePrice),
      currency: newAsset.currency as 'XOF' | 'EUR' | 'USD' | 'MAD',
      purchaseDate: newAsset.purchaseDate,
      depreciationMethod: newAsset.depreciationMethod,
      usefulLife: newAsset.usefulLife,
      unitId: newAsset.unitId || undefined,
      status: newAsset.status
    });
    
    addLog('Équipement modifié', 'Amortissements', `Équipement modifié: ${newAsset.name}`, 'info');
    resetForm();
  };

  const resetForm = () => {
    setNewAsset({
      name: '',
      category: '',
      purchasePrice: 0,
      currency: currency,
      purchaseDate: '',
      depreciationMethod: 'linear',
      usefulLife: 5,
      unitId: activeUnit?.id || '',
      status: 'active'
    });
    setShowAssetForm(false);
    setEditingAsset(null);
  };

  const handleEditAsset = (asset: any) => {
    setEditingAsset(asset);
    setNewAsset({
      name: asset.name,
      category: asset.category,
      purchasePrice: asset.purchasePrice,
      currency: asset.currency,
      purchaseDate: asset.purchaseDate,
      depreciationMethod: asset.depreciationMethod,
      usefulLife: asset.usefulLife,
      unitId: asset.unitId || '',
      status: asset.status
    });
    setShowAssetForm(true);
  };

  const calculateCurrentValue = (asset: any) => {
    const depreciation = calculateDepreciation(asset.id);
    return Math.max(0, asset.purchasePrice - depreciation);
  };

  const calculateDepreciationRate = (asset: any) => {
    const depreciation = calculateDepreciation(asset.id);
    return asset.purchasePrice > 0 ? (depreciation / asset.purchasePrice) * 100 : 0;
  };

  const getCurrencySymbol = (currencyCode: string) => {
    return currencies.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  const totalAssetValue = depreciableAssets.reduce((sum, asset) => 
    sum + convertCurrency(asset.purchasePrice, asset.currency, currency), 0);
    
  const totalCurrentValue = depreciableAssets.reduce((sum, asset) => 
    sum + convertCurrency(calculateCurrentValue(asset), asset.currency, currency), 0);
    
  const totalDepreciation = totalAssetValue - totalCurrentValue;

  const categoryData = assetCategories.map(category => ({
    name: category,
    value: depreciableAssets
      .filter(asset => asset.category === category)
      .reduce((sum, asset) => sum + convertCurrency(calculateCurrentValue(asset), asset.currency, currency), 0)
  })).filter(item => item.value > 0);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Gestion des Amortissements</h3>
          <p className="text-sm text-gray-600">Suivi des équipements et matériels amortissables</p>
        </div>
        <Button onClick={() => setShowAssetForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nouvel équipement
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valeur d'acquisition</p>
                <p className="text-2xl font-bold text-blue-600">
                  {totalAssetValue.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
              <Calculator className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Valeur actuelle</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalCurrentValue.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Amortissements</p>
                <p className="text-2xl font-bold text-orange-600">
                  {totalDepreciation.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Équipements</p>
                <p className="text-2xl font-bold">{depreciableAssets.length}</p>
              </div>
              <Calculator className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Graphique par catégorie */}
      <Card>
        <CardHeader>
          <CardTitle>Répartition par catégorie (valeur actuelle)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} ${getCurrencySymbol(currency)}`, 'Valeur']} />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Liste des équipements */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des équipements ({depreciableAssets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {depreciableAssets.map((asset) => {
              const currentValue = calculateCurrentValue(asset);
              const depreciationRate = calculateDepreciationRate(asset);
              const unitName = units.find(u => u.id === asset.unitId)?.name;
              
              return (
                <div key={asset.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline">{asset.category}</Badge>
                      <Badge variant={
                        asset.status === 'active' ? 'default' : 
                        asset.status === 'inactive' ? 'secondary' : 'destructive'
                      }>
                        {asset.status === 'active' ? 'Actif' : 
                         asset.status === 'inactive' ? 'Inactif' : 'Cédé'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        Acheté le {new Date(asset.purchaseDate).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <h4 className="font-medium">{asset.name}</h4>
                    <p className="text-sm text-gray-600">
                      Méthode: {asset.depreciationMethod === 'linear' ? 'Linéaire' : 'Accélérée'}
                      • Durée: {asset.usefulLife} ans
                      • Amortissement: {depreciationRate.toFixed(1)}%
                      {unitName && ` • Unité: ${unitName}`}
                    </p>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Valeur d'acquisition</p>
                      <p className="font-semibold">
                        {asset.purchasePrice.toLocaleString()} {getCurrencySymbol(asset.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Valeur actuelle</p>
                      <p className="font-semibold text-green-600">
                        {convertCurrency(currentValue, asset.currency, currency).toLocaleString()} {getCurrencySymbol(currency)}
                      </p>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditAsset(asset)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          deleteDepreciableAsset(asset.id);
                          addLog('Équipement supprimé', 'Amortissements', `Équipement supprimé: ${asset.name}`, 'info');
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire d'équipement */}
      <Dialog open={showAssetForm} onOpenChange={setShowAssetForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? 'Modifier l\'équipement' : 'Nouvel équipement'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom de l'équipement *</Label>
              <Input
                value={newAsset.name}
                onChange={(e) => setNewAsset({...newAsset, name: e.target.value})}
                placeholder="Nom de l'équipement"
              />
            </div>

            <div>
              <Label>Catégorie *</Label>
              <Select
                value={newAsset.category}
                onValueChange={(value) => setNewAsset({...newAsset, category: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {assetCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Prix d'acquisition *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newAsset.purchasePrice}
                  onChange={(e) => setNewAsset({...newAsset, purchasePrice: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Devise</Label>
                <Select
                  value={newAsset.currency}
                  onValueChange={(value) => setNewAsset({...newAsset, currency: value as 'XOF' | 'EUR' | 'USD' | 'MAD'})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(curr => (
                      <SelectItem key={curr.code} value={curr.code}>
                        {curr.symbol} {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date d'acquisition *</Label>
                <Input
                  type="date"
                  value={newAsset.purchaseDate}
                  onChange={(e) => setNewAsset({...newAsset, purchaseDate: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Méthode d'amortissement</Label>
                <Select
                  value={newAsset.depreciationMethod}
                  onValueChange={(value) => setNewAsset({...newAsset, depreciationMethod: value as 'linear' | 'accelerated'})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="linear">Linéaire</SelectItem>
                    <SelectItem value="accelerated">Accélérée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Durée d'utilisation (années) *</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={newAsset.usefulLife}
                  onChange={(e) => setNewAsset({...newAsset, usefulLife: parseInt(e.target.value) || 5})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unité d'affectation</Label>
                <Select
                  value={newAsset.unitId}
                  onValueChange={(value) => setNewAsset({...newAsset, unitId: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map(unit => (
                      <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Statut</Label>
                <Select
                  value={newAsset.status}
                  onValueChange={(value) => setNewAsset({...newAsset, status: value as 'active' | 'disposed' | 'inactive'})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                    <SelectItem value="disposed">Cédé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={editingAsset ? handleUpdateAsset : handleAddAsset}>
                {editingAsset ? 'Modifier' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DepreciationManager;
