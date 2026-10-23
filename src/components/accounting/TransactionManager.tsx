
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Filter, Download, Edit, Trash2, Search, DollarSign, TrendingUp, TrendingDown, CreditCard } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useLogs } from '@/contexts/LogsContext';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line } from 'recharts';

const TransactionManager = () => {
  const { 
    transactions, 
    units,
    activeUnit,
    currency,
    setCurrency,
    addTransaction, 
    updateTransaction, 
    deleteTransaction,
    convertCurrency
  } = useProductionUnits();
  const { addLog } = useLogs();

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    unitId: activeUnit?.id || 'all',
    status: ''
  });

  const [newTransaction, setNewTransaction] = useState({
    type: 'expense' as 'revenue' | 'expense',
    category: '',
    description: '',
    amount: 0,
    currency: currency,
    paymentMethod: '',
    reference: '',
    supplier: '',
    client: '',
    unitId: activeUnit?.id || '',
    status: 'confirmed' as 'pending' | 'confirmed' | 'cancelled'
  });

  useEffect(() => {
    if (!activeUnit?.id) return;
    setFilters((prev) => ({ ...prev, unitId: activeUnit.id }));
    setNewTransaction((prev) => ({ ...prev, unitId: activeUnit.id }));
  }, [activeUnit?.id]);

  const transactionCategories = {
    revenue: [
      'Vente de poissons',
      'Vente d\'alevins',
      'Services de transformation',
      'Prestations externes',
      'Subventions',
      'Autres revenus'
    ],
    expense: [
      'Alimentation',
      'Personnel',
      'Maintenance',
      'Équipements',
      'Carburant',
      'Électricité',
      'Frais bancaires',
      'Assurances',
      'Taxes',
      'Autres charges'
    ]
  };

  const paymentMethods = [
    'Espèces',
    'Carte bancaire',
    'Virement',
    'Chèque',
    'Prélèvement',
    'Mobile Money'
  ];

  const currencies = [
    { code: 'XOF', symbol: 'F CFA', name: 'Franc CFA' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dollar US' }
  ];

  const handleAddTransaction = () => {
    const selectedUnit = units.find(u => u.id === newTransaction.unitId);
    addTransaction({
      date: new Date().toISOString().split('T')[0],
      type: newTransaction.type,
      category: newTransaction.category,
      description: newTransaction.description,
      amount: Number(newTransaction.amount),
      currency: newTransaction.currency as 'XOF' | 'EUR' | 'USD' | 'MAD',
      paymentMethod: newTransaction.paymentMethod,
      reference: newTransaction.reference,
      supplier: newTransaction.supplier || undefined,
      client: newTransaction.client || undefined,
      status: newTransaction.status,
      unitId: newTransaction.unitId || undefined,
      unitName: selectedUnit?.name || undefined
    });
    
    addLog('Transaction ajoutée', 'Comptabilité', `${newTransaction.description} - ${newTransaction.amount} ${newTransaction.currency}`, 'success');
    resetForm();
  };

  const handleUpdateTransaction = () => {
    if (!editingTransaction) return;
    
    const selectedUnit = units.find(u => u.id === newTransaction.unitId);
    updateTransaction(editingTransaction.id, {
      type: newTransaction.type,
      category: newTransaction.category,
      description: newTransaction.description,
      amount: Number(newTransaction.amount),
      currency: newTransaction.currency as 'XOF' | 'EUR' | 'USD' | 'MAD',
      paymentMethod: newTransaction.paymentMethod,
      reference: newTransaction.reference,
      supplier: newTransaction.supplier || undefined,
      client: newTransaction.client || undefined,
      status: newTransaction.status,
      unitId: newTransaction.unitId || undefined,
      unitName: selectedUnit?.name || undefined
    });
    
    addLog('Transaction modifiée', 'Comptabilité', `Transaction modifiée: ${newTransaction.description}`, 'info');
    resetForm();
  };

  const resetForm = () => {
    setNewTransaction({
      type: 'expense',
      category: '',
      description: '',
      amount: 0,
      currency: currency,
      paymentMethod: '',
      reference: '',
      supplier: '',
      client: '',
      unitId: activeUnit?.id || '',
      status: 'confirmed'
    });
    setShowTransactionForm(false);
    setEditingTransaction(null);
  };

  const handleEditTransaction = (transaction: any) => {
    setEditingTransaction(transaction);
    setNewTransaction({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description,
      amount: transaction.amount,
      currency: transaction.currency,
      paymentMethod: transaction.paymentMethod,
      reference: transaction.reference || '',
      supplier: transaction.supplier || '',
      client: transaction.client || '',
      unitId: transaction.unitId || '',
      status: transaction.status
    });
    setShowTransactionForm(true);
  };

  const filteredTransactions = transactions.filter(transaction => {
    return (
      (!filters.type || filters.type === 'all' || transaction.type === filters.type) &&
      (!filters.category || filters.category === 'all' || transaction.category === filters.category) &&
      (!filters.search || transaction.description.toLowerCase().includes(filters.search.toLowerCase())) &&
      (!filters.dateFrom || transaction.date >= filters.dateFrom) &&
      (!filters.dateTo || transaction.date <= filters.dateTo) &&
      (!filters.unitId || filters.unitId === 'all' || transaction.unitId === filters.unitId) &&
      (!filters.status || filters.status === 'all' || transaction.status === filters.status)
    );
  });

  const totalRevenue = filteredTransactions
    .filter(t => t.type === 'revenue' && t.status === 'confirmed')
    .reduce((sum, t) => sum + convertCurrency(t.amount, t.currency, currency), 0);
    
  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense' && t.status === 'confirmed')
    .reduce((sum, t) => sum + convertCurrency(t.amount, t.currency, currency), 0);

  const balance = totalRevenue - totalExpenses;

  const monthlyData = filteredTransactions.reduce((acc, transaction) => {
    const month = new Date(transaction.date).toLocaleDateString('fr-FR', { month: 'short' });
    const amount = convertCurrency(transaction.amount, transaction.currency, currency);
    
    const existing = acc.find(item => item.month === month);
    if (existing) {
      if (transaction.type === 'revenue') {
        existing.revenue += amount;
      } else {
        existing.expenses += amount;
      }
    } else {
      acc.push({ 
        month, 
        revenue: transaction.type === 'revenue' ? amount : 0,
        expenses: transaction.type === 'expense' ? amount : 0
      });
    }
    return acc;
  }, [] as { month: string; revenue: number; expenses: number }[]);

  const getCurrencySymbol = (currencyCode: string) => {
    return currencies.find(c => c.code === currencyCode)?.symbol || currencyCode;
  };

  const exportTransactions = () => {
    const csvContent = [
      ['Date', 'Type', 'Catégorie', 'Description', 'Montant', 'Devise', 'Mode de paiement', 'Statut'].join(','),
      ...filteredTransactions.map(t => [
        t.date,
        t.type === 'revenue' ? 'Recette' : 'Dépense',
        t.category,
        t.description,
        t.amount,
        t.currency,
        t.paymentMethod,
        t.status
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    addLog('Export transactions', 'Comptabilité', 'Export CSV des transactions généré', 'info');
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur de devise */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Gestion des Transactions</h3>
          <p className="text-sm text-gray-600">Suivi des recettes et dépenses</p>
        </div>
        <div className="flex gap-2">
          <Select value={currency} onValueChange={(value) => setCurrency(value as 'XOF' | 'EUR' | 'USD' | 'MAD')}>
            <SelectTrigger className="w-32">
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
          <Button variant="outline" onClick={exportTransactions}>
            <Download className="w-4 h-4 mr-2" />
            Exporter
          </Button>
          <Button onClick={() => setShowTransactionForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Transaction
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Recettes</p>
                <p className="text-2xl font-bold text-green-600">
                  {totalRevenue.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Dépenses</p>
                <p className="text-2xl font-bold text-red-600">
                  {totalExpenses.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Solde</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {balance.toLocaleString()} {getCurrencySymbol(currency)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Transactions</p>
                <p className="text-2xl font-bold">{filteredTransactions.length}</p>
              </div>
              <CreditCard className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="analytics">Analyses</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {/* Filtres */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filtres
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={filters.type} onValueChange={(value) => setFilters({...filters, type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="revenue">Recettes</SelectItem>
                      <SelectItem value="expense">Dépenses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Catégorie</Label>
                  <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes</SelectItem>
                      {[...transactionCategories.revenue, ...transactionCategories.expense].map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Statut</Label>
                  <Select value={filters.status} onValueChange={(value) => setFilters({...filters, status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="confirmed">Confirmé</SelectItem>
                      <SelectItem value="cancelled">Annulé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Date début</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Date fin</Label>
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Recherche</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Description..."
                      value={filters.search}
                      onChange={(e) => setFilters({...filters, search: e.target.value})}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Liste des transactions */}
          <Card>
            <CardHeader>
              <CardTitle>Historique des transactions ({filteredTransactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {filteredTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={transaction.type === 'revenue' ? 'default' : 'destructive'}>
                          {transaction.type === 'revenue' ? 'Recette' : 'Dépense'}
                        </Badge>
                        <Badge variant="outline">{transaction.category}</Badge>
                        <Badge variant={
                          transaction.status === 'confirmed' ? 'default' : 
                          transaction.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {transaction.status === 'confirmed' ? 'Confirmé' : 
                           transaction.status === 'pending' ? 'En attente' : 'Annulé'}
                        </Badge>
                        <span className="text-sm text-gray-500">{transaction.date}</span>
                      </div>
                      <h4 className="font-medium">{transaction.description}</h4>
                      <p className="text-sm text-gray-600">
                        {transaction.paymentMethod}
                        {transaction.reference && ` • Réf: ${transaction.reference}`}
                        {transaction.supplier && ` • Fournisseur: ${transaction.supplier}`}
                        {transaction.client && ` • Client: ${transaction.client}`}
                        {transaction.unitName && ` • Unité: ${transaction.unitName}`}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`text-lg font-bold ${
                        transaction.type === 'revenue' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {transaction.type === 'revenue' ? '+' : '-'}
                        {convertCurrency(transaction.amount, transaction.currency, currency).toLocaleString()} {getCurrencySymbol(currency)}
                      </span>
                      <div className="flex space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditTransaction(transaction)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            deleteTransaction(transaction.id);
                            addLog('Transaction supprimée', 'Comptabilité', `Transaction supprimée: ${transaction.description}`, 'info');
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Évolution mensuelle</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [`${Number(value).toLocaleString()} ${getCurrencySymbol(currency)}`, '']} />
                  <Bar dataKey="revenue" fill="#10b981" name="Recettes" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Dépenses" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Formulaire de transaction */}
      <Dialog open={showTransactionForm} onOpenChange={setShowTransactionForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? 'Modifier la transaction' : 'Nouvelle transaction'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={newTransaction.type}
                  onValueChange={(value) => setNewTransaction({...newTransaction, type: value as 'revenue' | 'expense', category: ''})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revenue">Recette</SelectItem>
                    <SelectItem value="expense">Dépense</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Catégorie *</Label>
                <Select
                  value={newTransaction.category}
                  onValueChange={(value) => setNewTransaction({...newTransaction, category: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {transactionCategories[newTransaction.type].map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description *</Label>
              <Input
                value={newTransaction.description}
                onChange={(e) => setNewTransaction({...newTransaction, description: e.target.value})}
                placeholder="Description de la transaction"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Montant *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newTransaction.amount}
                  onChange={(e) => setNewTransaction({...newTransaction, amount: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Devise</Label>
                <Select
                  value={newTransaction.currency}
                  onValueChange={(value) => setNewTransaction({...newTransaction, currency: value as 'XOF' | 'EUR' | 'USD' | 'MAD'})}
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
                <Label>Mode de paiement *</Label>
                <Select
                  value={newTransaction.paymentMethod}
                  onValueChange={(value) => setNewTransaction({...newTransaction, paymentMethod: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner..." />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map(method => (
                      <SelectItem key={method} value={method}>{method}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Référence</Label>
                <Input
                  value={newTransaction.reference}
                  onChange={(e) => setNewTransaction({...newTransaction, reference: e.target.value})}
                  placeholder="Numéro de référence"
                />
              </div>
              <div>
                <Label>Unité</Label>
                <Select
                  value={newTransaction.unitId}
                  onValueChange={(value) => setNewTransaction({...newTransaction, unitId: value})}
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
            </div>

            {newTransaction.type === 'expense' && (
              <div>
                <Label>Fournisseur</Label>
                <Input
                  value={newTransaction.supplier}
                  onChange={(e) => setNewTransaction({...newTransaction, supplier: e.target.value})}
                  placeholder="Nom du fournisseur"
                />
              </div>
            )}

            {newTransaction.type === 'revenue' && (
              <div>
                <Label>Client</Label>
                <Input
                  value={newTransaction.client}
                  onChange={(e) => setNewTransaction({...newTransaction, client: e.target.value})}
                  placeholder="Nom du client"
                />
              </div>
            )}

            <div>
              <Label>Statut</Label>
              <Select
                value={newTransaction.status}
                onValueChange={(value) => setNewTransaction({...newTransaction, status: value as 'pending' | 'confirmed' | 'cancelled'})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="confirmed">Confirmé</SelectItem>
                  <SelectItem value="cancelled">Annulé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={resetForm}>
                Annuler
              </Button>
              <Button onClick={editingTransaction ? handleUpdateTransaction : handleAddTransaction}>
                {editingTransaction ? 'Modifier' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TransactionManager;
