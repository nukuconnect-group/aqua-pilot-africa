
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, Plus, TrendingUp, AlertTriangle, CreditCard, FileText, Settings } from 'lucide-react';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ProductionUnitSelector from './ProductionUnitSelector';
import AccountingDashboard from './accounting/AccountingDashboard';
import TransactionManager from './accounting/TransactionManager';
import CashFlowManager from './accounting/CashFlowManager';
import ReportsGenerator from './accounting/ReportsGenerator';
import DepreciationManager from './accounting/DepreciationManager';
import { useSettings } from '@/contexts/SettingsContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFinancialAlerts } from '@/hooks/useFinancialAlerts';

const AccountingManagement = () => {
  const { activeUnit, getUnitFinancialData, getGlobalFinancialData } = useProductionUnits();
  const { currency, setCurrency, t, formatCurrency } = useSettings();
  const [showAlerts, setShowAlerts] = useState(false);
  const { alerts, counts } = useFinancialAlerts(activeUnit?.id);

  const currencies = [
    { code: 'XOF', symbol: 'F CFA', name: 'Franc CFA' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dollar US' }
  ];

  if (!activeUnit) {
    return (
        <div className="space-y-responsive">
        <div className="bg-gradient-ocean p-responsive rounded-xl text-primary-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-responsive">
            <div>
              <h2 className="text-responsive-title font-bold mb-2">{t('accounting_management')}</h2>
              <p className="text-primary-foreground/80 text-responsive">{t('accounting_management_desc')}</p>
            </div>
            <div className="flex items-center gap-responsive">
              <div className="flex items-center gap-2">
                <Settings className="icon-responsive" />
                <select 
                  value={currency} 
                onChange={(e) => setCurrency(e.target.value as 'XOF' | 'EUR' | 'USD' | 'MAD')}
                  className="bg-card/20 border border-border rounded px-2 py-1 text-responsive"
                >
                  {currencies.map(curr => (
                    <option key={curr.code} value={curr.code} className="text-foreground bg-background">
                      {curr.symbol} {curr.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <ProductionUnitSelector />
          </div>
        </div>

        <div className="text-center py-12">
          <Calculator className="icon-responsive-lg mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-responsive-subtitle font-semibold text-foreground mb-2">
            {t('no_unit_selected')}
          </h3>
          <p className="text-muted-foreground text-responsive">
            {t('select_unit_for_accounting')}
          </p>
        </div>
      </div>
    );
  }

  const unitFinancialData = getUnitFinancialData(activeUnit.id);
  const globalFinancialData = getGlobalFinancialData();
  const currentData = unitFinancialData || {
    revenue: 0,
    expenses: 0,
    profit: 0,
    monthlyData: []
  };

  // Données de trésorerie basées sur les transactions réelles
  const cashFlowData = {
    totalInflow: currentData.revenue || 0,
    totalOutflow: currentData.expenses || 0,
    currentBalance: (currentData.revenue || 0) - (currentData.expenses || 0),
    pendingInvoices: counts.pendingInvoices,
    overdueInvoices: counts.overdueInvoices
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec sélecteur d'unité et devise */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-responsive rounded-xl text-white">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4 gap-responsive">
          <div className="flex-1">
            <h2 className="text-responsive-title font-bold mb-2">{t('accounting_management')} - {activeUnit.name}</h2>
            <p className="text-emerald-100 text-responsive mb-2">{t('accounting_management_desc')}</p>
            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4">
              <span className="text-sm">{t('type')}: {activeUnit.type.charAt(0).toUpperCase() + activeUnit.type.slice(1)}</span>
              <Badge variant="secondary" className="bg-white/20 text-white w-fit">
                {activeUnit.type}
              </Badge>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
              <Settings className="icon-responsive flex-shrink-0" />
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value as 'XOF' | 'EUR' | 'USD' | 'MAD')}
                className="bg-white/20 border border-white/30 rounded px-2 py-1 text-white text-responsive min-w-0 flex-1"
              >
                {currencies.map(curr => (
                  <option key={curr.code} value={curr.code} className="text-foreground bg-background">
                    {curr.symbol} {curr.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="text-xs sm:text-sm whitespace-nowrap"
              onClick={() => setShowAlerts(true)}
            >
              <AlertTriangle className="icon-responsive mr-1" />
              {t('active_alerts')} ({counts.total})
            </Button>
          </div>
        </div>
        
        <ProductionUnitSelector />
      </div>

      {/* Onglets principaux */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 overflow-x-auto">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm whitespace-nowrap">
            <TrendingUp className="icon-responsive mr-1" />
            <span className="hidden sm:inline">{t('dashboard')}</span>
            <span className="sm:hidden">{t('dashboard')}</span>
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-xs sm:text-sm whitespace-nowrap">
            <Plus className="icon-responsive mr-1" />
            <span className="hidden sm:inline">{t('transactions')}</span>
            <span className="sm:hidden">Trans.</span>
          </TabsTrigger>
          <TabsTrigger value="depreciation" className="text-xs sm:text-sm whitespace-nowrap">
            <Calculator className="icon-responsive mr-1" />
            <span className="hidden sm:inline">{t('depreciation')}</span>
            <span className="sm:hidden">Amort.</span>
          </TabsTrigger>
          <TabsTrigger value="cashflow" className="text-xs sm:text-sm whitespace-nowrap">
            <CreditCard className="icon-responsive mr-1" />
            <span className="hidden sm:inline">{t('cash_flow')}</span>
            <span className="sm:hidden">Trés.</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="text-xs sm:text-sm whitespace-nowrap">
            <FileText className="icon-responsive mr-1" />
            <span className="hidden sm:inline">{t('reports')}</span>
            <span className="sm:hidden">Rapp.</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AccountingDashboard />
        </TabsContent>

        <TabsContent value="transactions">
          <TransactionManager />
        </TabsContent>

        <TabsContent value="depreciation">
          <DepreciationManager />
        </TabsContent>

        <TabsContent value="cashflow">
          <CashFlowManager />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsGenerator />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AccountingManagement;
