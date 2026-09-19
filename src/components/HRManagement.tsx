import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserCheck, Plus, Users, TrendingUp, Calendar, Download, FileText, Eye, CreditCard, Edit2, Printer } from 'lucide-react';
import { useLogs } from '@/contexts/LogsContext';
import { useToast } from '@/hooks/use-toast';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import ProductionUnitSelector from './ProductionUnitSelector';
import { useSettings } from '@/contexts/SettingsContext';
import { useEmployees, Employee, PaySlip } from '@/hooks/useEmployees';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { generateProfessionalPayslipHTML } from '@/lib/payslipGenerator';
import { printEmployeeList } from '@/lib/employeePrintUtils';
import PayslipEditor from './PayslipEditor';
import EmploymentContractsManager from './hr/EmploymentContractsManager';
import LeaveManagement from './hr/LeaveManagement';
import LoansManagement from './hr/LoansManagement';
import { useHrOperations } from '@/hooks/useHrOperations';

const HRManagement = () => {
  const { addLog } = useLogs();
  const { toast } = useToast();
  const { units, activeUnit } = useProductionUnits();
  const { formatCurrency, companyInfo, t } = useSettings();
  const { user } = useAuth();
  const { 
    employees, 
    paySlips, 
    allEmployees,
    loading,
    addEmployee, 
    addPaySlip 
  } = useEmployees();
  const { payrollDeductionFor, applyPayrollRepayments } = useHrOperations(activeUnit?.id);

  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [showPaySlipGenerator, setShowPaySlipGenerator] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showPayslipEditor, setShowPayslipEditor] = useState(false);
  const [selectedPayslip, setSelectedPayslip] = useState<PaySlip | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  const [employeeFormData, setEmployeeFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    unitId: activeUnit?.id || '',
    salary: 0,
    hireDate: '',
    contractType: 'CDI' as 'CDI' | 'CDD' | 'Stage' | 'Freelance'
  });

  // Synchroniser avec l'unité active
  useEffect(() => {
    if (activeUnit?.id) {
      setEmployeeFormData(prev => ({ ...prev, unitId: activeUnit.id }));
    }
  }, [activeUnit?.id]);

  const filteredEmployees = employees;
  const filteredPaySlips = paySlips;

  const [paySlipData, setPaySlipData] = useState({
    employeeId: '',
    period: '',
    overtime: 0,
    bonuses: 0,
    deductions: 0,
    transportAllowance: 0,
    housingAllowance: 0,
    mealAllowance: 0
  });

  // Pré-remplir automatiquement la période avec le mois en cours dès qu'on ouvre le générateur
  useEffect(() => {
    if (showPaySlipGenerator && !paySlipData.period) {
      const now = new Date();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setPaySlipData(prev => ({ ...prev, period: `${now.getFullYear()}-${month}` }));
    }
  }, [showPaySlipGenerator, paySlipData.period]);

  const selectedPayslipEmployee = employees.find(e => e.id === paySlipData.employeeId) || null;

  const positions = [
    'Directeur',
    'Responsable de production',
    'Responsable Grossissement',
    'Responsable Écloserie',
    'Technicien Aquacole',
    'Technicienne Écloserie',
    'Ouvrier Aquacole',
    'Comptable',
    'Secrétaire'
  ];

  const handleAddEmployee = async () => {
    if (!employeeFormData.firstName || !employeeFormData.lastName || !employeeFormData.unitId) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    const selectedUnit = units.find(u => u.id === employeeFormData.unitId);
    
    const result = await addEmployee({
      ...employeeFormData,
      unitName: selectedUnit?.name || '',
      status: 'active'
    });

    if (result) {
      addLog('Employé ajouté', 'RH', `${employeeFormData.firstName} ${employeeFormData.lastName} ajouté à ${selectedUnit?.name}`, 'success');
      toast({
        title: "Employé ajouté",
        description: `${employeeFormData.firstName} ${employeeFormData.lastName} a été ajouté avec succès`
      });
    }

    resetEmployeeForm();
  };

  const resetEmployeeForm = () => {
    setEmployeeFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      position: '',
      unitId: activeUnit?.id || '',
      salary: 0,
      hireDate: '',
      contractType: 'CDI'
    });
    setShowEmployeeForm(false);
  };

  const generatePaySlip = async () => {
    if (!paySlipData.employeeId || !paySlipData.period) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un employé et une période",
        variant: "destructive"
      });
      return;
    }

    const employee = employees.find(e => e.id === paySlipData.employeeId);
    if (!employee) return;

    const allBonuses = paySlipData.bonuses + paySlipData.transportAllowance + paySlipData.housingAllowance + paySlipData.mealAllowance;
    const grossSalary = employee.salary + paySlipData.overtime + allBonuses;
    
    // Calcul des cotisations (environ 22% du brut)
    const socialDeductions = Math.round(grossSalary * 0.22);
    // Remboursement de prêt/avance retenu automatiquement sur la paie
    const loanDeduction = payrollDeductionFor(paySlipData.employeeId, paySlipData.period);
    const calculatedDeductions = socialDeductions + loanDeduction;
    const netSalary = grossSalary - calculatedDeductions;

    const result = await addPaySlip({
      employeeId: paySlipData.employeeId,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      period: paySlipData.period,
      baseSalary: employee.salary,
      overtime: paySlipData.overtime,
      bonuses: allBonuses,
      deductions: calculatedDeductions,
      netSalary: netSalary,
      generatedAt: new Date().toISOString().split('T')[0],
      unitId: employee.unitId
    });

    if (result) {
      addLog('Bulletin généré', 'RH', `Bulletin de paie généré pour ${employee.firstName} ${employee.lastName} - ${paySlipData.period}`, 'success');
      toast({
        title: "Bulletin généré",
        description: `Bulletin de paie créé pour ${employee.firstName} ${employee.lastName}`
      });
    }

    setPaySlipData({
      employeeId: '',
      period: '',
      overtime: 0,
      bonuses: 0,
      deductions: 0,
      transportAllowance: 0,
      housingAllowance: 0,
      mealAllowance: 0
    });
    setShowPaySlipGenerator(false);
  };

  // Fonction pour effectuer le paiement et créer l'écriture comptable
  const processPayment = async (paySlip: PaySlip) => {
    if (!user?.id) return;
    
    setPaymentProcessing(true);
    try {
      const employee = employees.find(e => e.id === paySlip.employeeId);
      const unitName = employee?.unitName || activeUnit?.name || '';

      // Créer l'écriture comptable pour le paiement de salaire
      const { error } = await supabase
        .from('accounting_transactions')
        .insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          type: 'expense',
          category: 'Salaires et charges',
          amount: paySlip.netSalary,
          description: `Paiement salaire ${paySlip.employeeName} - ${paySlip.period}`,
          reference: `PAY-${paySlip.period}-${paySlip.employeeId.slice(0, 8)}`,
          status: 'completed',
          payment_method: 'Virement bancaire',
          unit_id: paySlip.unitId,
          unit_name: unitName
        });

      if (error) throw error;

      // Créer aussi une écriture pour les charges patronales
      const employerCharges = Math.round((paySlip.baseSalary + paySlip.overtime + paySlip.bonuses) * 0.42);
      
      await supabase
        .from('accounting_transactions')
        .insert({
          user_id: user.id,
          date: new Date().toISOString().split('T')[0],
          type: 'expense',
          category: 'Charges sociales patronales',
          amount: employerCharges,
          description: `Charges patronales ${paySlip.employeeName} - ${paySlip.period}`,
          reference: `CHRG-${paySlip.period}-${paySlip.employeeId.slice(0, 8)}`,
          status: 'completed',
          unit_id: paySlip.unitId,
          unit_name: unitName
        });

      addLog('Paiement effectué', 'RH', `Salaire payé: ${paySlip.employeeName} - ${formatCurrency(paySlip.netSalary)}`, 'success');
      
      toast({
        title: "Paiement enregistré",
        description: `Le paiement de ${formatCurrency(paySlip.netSalary)} pour ${paySlip.employeeName} a été enregistré en comptabilité`
      });

      setShowPaymentDialog(false);
    } catch (err) {
      console.error('Error processing payment:', err);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le paiement",
        variant: "destructive"
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  // Formater en F CFA par défaut - utilisé dans ce module RH
  // FCFA par défaut, change seulement si langue = 'en'
  const formatSalary = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value) + ' F CFA';
  };

  const openPayslipEditor = (paySlip: PaySlip) => {
    const employee = employees.find(e => e.id === paySlip.employeeId);
    setSelectedPayslip(paySlip);
    setSelectedEmployee(employee || null);
    setShowPayslipEditor(true);
  };

  const downloadPaySlip = (paySlip: PaySlip) => {
    // Ouvrir l'éditeur pour permettre la personnalisation avant téléchargement
    openPayslipEditor(paySlip);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-red-100 text-red-800';
      case 'vacation': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const hrStats = {
    totalEmployees: filteredEmployees.length,
    activeEmployees: filteredEmployees.filter(e => e.status === 'active').length,
    totalPayroll: filteredEmployees.reduce((sum, emp) => sum + emp.salary, 0),
    avgSalary: filteredEmployees.length > 0 ? filteredEmployees.reduce((sum, emp) => sum + emp.salary, 0) / filteredEmployees.length : 0
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* En-tête */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-4 md:p-6 rounded-xl text-white">
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-xl md:text-2xl font-bold mb-1 md:mb-2">Gestion des Ressources Humaines</h2>
              <p className="text-sm md:text-base text-blue-100">Personnel, paie et administration RH</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 w-full sm:w-auto text-sm md:text-base" 
                onClick={() => setShowPaySlipGenerator(true)}
              >
                <FileText className="w-4 h-4 mr-2" />
                Générer Bulletin
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/20 border-white/30 text-white hover:bg-white/30 w-full sm:w-auto text-sm md:text-base" 
                onClick={() => setShowEmployeeForm(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nouvel Employé
              </Button>
            </div>
          </div>
          <ProductionUnitSelector />
        </div>
      </div>

      {/* KPIs RH */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold truncate">{hrStats.totalEmployees}</p>
                <p className="text-xs md:text-sm text-gray-600">Employés total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <UserCheck className="w-6 h-6 md:w-8 md:h-8 text-green-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold truncate">{hrStats.activeEmployees}</p>
                <p className="text-xs md:text-sm text-gray-600">Actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <TrendingUp className="w-6 h-6 md:w-8 md:h-8 text-purple-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-base md:text-2xl font-bold truncate">{formatCurrency(hrStats.totalPayroll)}</p>
                <p className="text-xs md:text-sm text-gray-600">Masse salariale</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Calendar className="w-6 h-6 md:w-8 md:h-8 text-orange-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-base md:text-2xl font-bold truncate">{formatCurrency(Math.round(hrStats.avgSalary))}</p>
                <p className="text-xs md:text-sm text-gray-600">Salaire moyen</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="employees" className="space-y-3 md:space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full text-xs md:text-sm">
            <TabsTrigger value="employees">Employés</TabsTrigger>
            <TabsTrigger value="contracts">Contrats</TabsTrigger>
            <TabsTrigger value="payroll">Bulletins</TabsTrigger>
            <TabsTrigger value="leaves">Congés</TabsTrigger>
            <TabsTrigger value="loans">Prêts</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="employees">
          <Card>
            <CardHeader className="p-3 sm:p-4 md:p-6 flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg">Liste des Employés</CardTitle>
{filteredEmployees.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => printEmployeeList(
                    filteredEmployees, 
                    {
                      name: companyInfo.name,
                      address: companyInfo.address,
                      phone: companyInfo.phone,
                      email: companyInfo.email,
                      logoUrl: companyInfo.logoUrl,
                      registrationNumber: companyInfo.registrationNumber,
                      taxId: companyInfo.taxId
                    },
                    activeUnit?.name,
                    formatCurrency
                  )}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Imprimer
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 sm:p-3 md:p-6">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucun employé enregistré{activeUnit ? ` pour ${activeUnit.name}` : ''}</p>
                  <p className="text-sm text-muted-foreground mt-2">Cliquez sur "Nouvel Employé" pour ajouter votre premier employé</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs lg:text-sm">Nom</TableHead>
                          <TableHead className="text-xs lg:text-sm">Poste</TableHead>
                          <TableHead className="text-xs lg:text-sm">Unité</TableHead>
                          <TableHead className="text-xs lg:text-sm">Salaire</TableHead>
                          <TableHead className="text-xs lg:text-sm">Statut</TableHead>
                          <TableHead className="text-xs lg:text-sm">Contrat</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredEmployees.map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-xs lg:text-sm">{employee.firstName} {employee.lastName}</p>
                                <p className="text-xs text-muted-foreground">{employee.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs lg:text-sm">{employee.position}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {employee.unitName}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs lg:text-sm">{formatCurrency(employee.salary)}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(employee.status) + " text-xs"}>
                                {employee.status === 'active' ? 'Actif' : 
                                 employee.status === 'inactive' ? 'Inactif' : 'Congés'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{employee.contractType}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="md:hidden space-y-3 p-3">
                    {filteredEmployees.map((employee) => (
                      <Card key={employee.id} className="border">
                        <CardContent className="p-3">
                          <div className="space-y-2">
                            <div>
                              <p className="font-medium text-sm">{employee.firstName} {employee.lastName}</p>
                              <p className="text-xs text-muted-foreground">{employee.email}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge variant="outline" className="text-xs">{employee.position}</Badge>
                              <Badge variant="outline" className="text-xs">{employee.unitName}</Badge>
                              <Badge className={getStatusColor(employee.status) + " text-xs"}>
                                {employee.status === 'active' ? 'Actif' : 
                                 employee.status === 'inactive' ? 'Inactif' : 'Congés'}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">{employee.contractType}</Badge>
                            </div>
                            <p className="text-sm font-medium">{formatCurrency(employee.salary)}/mois</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts">
          <EmploymentContractsManager employees={filteredEmployees} />
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Bulletins de Paie</CardTitle>
            </CardHeader>
            <CardContent>
              {filteredPaySlips.length === 0 ? (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucun bulletin de paie généré{activeUnit ? ` pour ${activeUnit.name}` : ''}</p>
                  <p className="text-sm text-muted-foreground mt-2">Cliquez sur "Générer Bulletin" pour créer un bulletin de paie</p>
                </div>
              ) : (
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Salaire Base</TableHead>
                      <TableHead>Net</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPaySlips.map((paySlip) => (
                      <TableRow key={paySlip.id}>
                        <TableCell>{paySlip.employeeName}</TableCell>
                        <TableCell>{paySlip.period}</TableCell>
                        <TableCell>{formatSalary(paySlip.baseSalary)}</TableCell>
                        <TableCell className="font-bold">{formatSalary(paySlip.netSalary)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPayslipEditor(paySlip)}
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              Éditer
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => processPayment(paySlip)}
                              disabled={paymentProcessing}
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Payer
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves">
          <LeaveManagement employees={filteredEmployees} unitId={activeUnit?.id} />
        </TabsContent>

        <TabsContent value="loans">
          <LoansManagement employees={filteredEmployees} unitId={activeUnit?.id} />
        </TabsContent>

        <TabsContent value="reports">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Répartition par Unité</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {units.map(unit => {
                    const unitEmployees = employees.filter(emp => emp.unitId === unit.id);
                    return (
                      <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{unit.name}</p>
                          <Badge variant="outline" className="text-xs">{unit.type}</Badge>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{unitEmployees.length} employés</p>
                           <p className="text-sm text-gray-600">
                            {formatCurrency(unitEmployees.reduce((sum, emp) => sum + emp.salary, 0))}/mois
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Indicateurs RH</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Taux de rotation:</span>
                    <span className="font-medium">5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ancienneté moyenne:</span>
                    <span className="font-medium">18 mois</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coût RH/CA:</span>
                    <span className="font-medium">35%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Absentéisme:</span>
                    <span className="font-medium">2.1%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Nouvel Employé */}
      <Dialog open={showEmployeeForm} onOpenChange={setShowEmployeeForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Ajouter un nouvel employé</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prénom *</Label>
                <Input
                  value={employeeFormData.firstName}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, firstName: e.target.value})}
                />
              </div>
              <div>
                <Label>Nom *</Label>
                <Input
                  value={employeeFormData.lastName}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, lastName: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={employeeFormData.email}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, email: e.target.value})}
                />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={employeeFormData.phone}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, phone: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label>Poste *</Label>
              <Select value={employeeFormData.position} onValueChange={(value) => setEmployeeFormData({...employeeFormData, position: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un poste" />
                </SelectTrigger>
                <SelectContent>
                  {positions.map(pos => (
                    <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Unité de rattachement *</Label>
              <Select value={employeeFormData.unitId} onValueChange={(value) => setEmployeeFormData({...employeeFormData, unitId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une unité" />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit.id} value={unit.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {unit.type}
                        </Badge>
                        {unit.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Salaire (F CFA) *</Label>
                <Input
                  type="number"
                  value={employeeFormData.salary}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, salary: parseInt(e.target.value) || 0})}
                  placeholder="Salaire en F CFA"
                />
              </div>
              <div>
                <Label>Date d'embauche</Label>
                <Input
                  type="date"
                  value={employeeFormData.hireDate}
                  onChange={(e) => setEmployeeFormData({...employeeFormData, hireDate: e.target.value})}
                />
              </div>
              <div>
                <Label>Type de contrat</Label>
                <Select value={employeeFormData.contractType} onValueChange={(value: 'CDI' | 'CDD' | 'Stage' | 'Freelance') => setEmployeeFormData({...employeeFormData, contractType: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CDI">CDI</SelectItem>
                    <SelectItem value="CDD">CDD</SelectItem>
                    <SelectItem value="Stage">Stage</SelectItem>
                    <SelectItem value="Freelance">Freelance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetEmployeeForm}>
              Annuler
            </Button>
            <Button onClick={handleAddEmployee}>
              Ajouter l'employé
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Génération Bulletin */}
      <Dialog open={showPaySlipGenerator} onOpenChange={setShowPaySlipGenerator}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Générer un bulletin de paie</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div>
              <Label>Employé *</Label>
              <Select value={paySlipData.employeeId} onValueChange={(value) => setPaySlipData({...paySlipData, employeeId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(emp => emp.status === 'active').map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} - {emp.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPayslipEmployee && (
              <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-muted-foreground">Nom complet</span><span className="font-medium">{selectedPayslipEmployee.firstName} {selectedPayslipEmployee.lastName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Poste</span><span className="font-medium">{selectedPayslipEmployee.position}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Contrat</span><span className="font-medium">{selectedPayslipEmployee.contractType}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Unité</span><span className="font-medium">{selectedPayslipEmployee.unitName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Salaire de base</span><span className="font-semibold text-primary">{formatSalary(selectedPayslipEmployee.salary)}</span></div>
              </div>
            )}

            <div>
              <Label>Période *</Label>
              <Input
                type="month"
                value={paySlipData.period}
                onChange={(e) => setPaySlipData({...paySlipData, period: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Heures supplémentaires (€)</Label>
                <Input
                  type="number"
                  value={paySlipData.overtime}
                  onChange={(e) => setPaySlipData({...paySlipData, overtime: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Primes (€)</Label>
                <Input
                  type="number"
                  value={paySlipData.bonuses}
                  onChange={(e) => setPaySlipData({...paySlipData, bonuses: parseInt(e.target.value) || 0})}
                />
              </div>
              <div>
                <Label>Cotisations (€)</Label>
                <Input
                  type="number"
                  value={paySlipData.deductions}
                  onChange={(e) => setPaySlipData({...paySlipData, deductions: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowPaySlipGenerator(false)}>
              Annuler
            </Button>
            <Button onClick={generatePaySlip}>
              Générer le bulletin
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Éditeur de Bulletin */}
      {selectedPayslip && (
        <PayslipEditor
          isOpen={showPayslipEditor}
          onClose={() => {
            setShowPayslipEditor(false);
            setSelectedPayslip(null);
          }}
          paySlip={selectedPayslip}
          employee={selectedEmployee}
        />
      )}
    </div>
  );
};

export default HRManagement;
