import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/appClient';
import { emitDataMutation, recordHookState } from '@/lib/appRecovery';

export type ProductionUnitType = 
  | 'ecloserie' 
  | 'grossissement' 
  | 'transformation' 
  | 'conservation' 
  | 'fabrication_aliment' 
  | 'commercialisation';

export interface Equipment {
  id: string;
  name: string;
  type: string;
  specifications: Record<string, any>;
  status: 'active' | 'maintenance' | 'inactive';
  unitId: string;
  purchasePrice?: number;
  purchaseDate?: string;
  depreciationRate?: number;
  currentValue?: number;
}

export interface ProductionCycle {
  id: string;
  unitId: string;
  name: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'paused';
  targetQuantity: number;
  currentQuantity: number;
  notes: string;
}

export interface UnitFinancialData {
  unitId: string;
  revenue: number;
  expenses: number;
  profit: number;
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
}

export interface ProductionUnit {
  id: string;
  name: string;
  type: ProductionUnitType;
  description: string;
  isActive: boolean;
  capacity: number;
  currentStock: number;
  manager: string;
  createdAt: string;
  photoUrl?: string;
  customEquipment?: Equipment[];
  activeCycles?: ProductionCycle[];
  financialData?: UnitFinancialData;
  userId?: string;
}

export interface Infrastructure {
  id: string;
  name: string;
  unitId: string;
  type: string;
  customTypeName?: string;
  capacity: number;
  status: 'active' | 'maintenance' | 'inactive';
  specifications: Record<string, any>;
  nextMaintenanceDate?: string;
  maintenanceFrequencyDays?: number;
  lastMaintenanceDate?: string;
  maintenanceNotes?: string;
}

// Purchase interface intégrée
export interface Purchase {
  id: string;
  date: string;
  category: string;
  subcategory?: string;
  description: string;
  supplier: string;
  amount: number;
  currency: 'XOF' | 'EUR' | 'USD' | 'MAD';
  quantity?: number;
  unit?: string;
  paymentMethod: string;
  reference?: string;
  unitId?: string;
  unitName?: string;
  status: 'pending' | 'received' | 'cancelled';
  deliveryDate?: string;
  notes?: string;
  dueDate?: string;
  isCredit?: boolean;
  paidAmount?: number;
  paymentTerms?: string;
}

// Transaction interface pour le module comptabilité
export interface Transaction {
  id: string;
  date: string;
  type: 'revenue' | 'expense';
  category: string;
  description: string;
  amount: number;
  currency: 'XOF' | 'EUR' | 'USD' | 'MAD';
  paymentMethod: string;
  reference?: string;
  supplier?: string;
  client?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  unitId?: string;
  unitName?: string;
  purchaseId?: string; // Lien avec les achats
}

// Interface pour les équipements à amortir
export interface DepreciableAsset {
  id: string;
  name: string;
  category: string;
  purchasePrice: number;
  currency: 'XOF' | 'EUR' | 'USD' | 'MAD';
  purchaseDate: string;
  depreciationMethod: 'linear' | 'accelerated';
  usefulLife: number; // en années
  currentValue: number;
  accumulatedDepreciation: number;
  unitId?: string;
  status: 'active' | 'disposed' | 'inactive';
}

interface ProductionUnitsContextType {
  units: ProductionUnit[];
  infrastructures: Infrastructure[];
  transactions: Transaction[];
  purchases: Purchase[];
  depreciableAssets: DepreciableAsset[];
  currency: 'XOF' | 'EUR' | 'USD' | 'MAD';
  formatCurrency: (amount: number) => string;
  activeUnit: ProductionUnit | null;
  setActiveUnit: (unit: ProductionUnit | null) => void;
  setCurrency: (currency: 'XOF' | 'EUR' | 'USD' | 'MAD') => void;
  setInfrastructures: (infrastructures: Infrastructure[]) => void;
  addUnit: (unit: Omit<ProductionUnit, 'id' | 'createdAt'>) => void;
  updateUnit: (id: string, updates: Partial<ProductionUnit>) => void;
  deleteUnit: (id: string) => void;
  getUnitInfrastructures: (unitId: string) => Infrastructure[];
  addInfrastructure: (infrastructure: Omit<Infrastructure, 'id'>) => void;
  updateInfrastructure: (id: string, updates: Partial<Infrastructure>) => void;
  deleteInfrastructure: (id: string) => void;
  getUnitEquipment: (unitId: string) => Equipment[];
  addEquipment: (equipment: Omit<Equipment, 'id'>) => void;
  updateEquipment: (id: string, updates: Partial<Equipment>) => void;
  getUnitCycles: (unitId: string) => ProductionCycle[];
  addCycle: (cycle: Omit<ProductionCycle, 'id'>) => void;
  updateCycle: (id: string, updates: Partial<ProductionCycle>) => void;
  getUnitFinancialData: (unitId: string) => UnitFinancialData | null;
  getGlobalFinancialData: () => UnitFinancialData;
  // Transaction methods
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  getUnitTransactions: (unitId: string) => Transaction[];
  // Purchase methods
  addPurchase: (purchase: Omit<Purchase, 'id'>) => void;
  updatePurchase: (id: string, updates: Partial<Purchase>) => void;
  deletePurchase: (id: string) => void;
  getUnitPurchases: (unitId: string) => Purchase[];
  // Depreciable assets methods
  addDepreciableAsset: (asset: Omit<DepreciableAsset, 'id'>) => void;
  updateDepreciableAsset: (id: string, updates: Partial<DepreciableAsset>) => void;
  deleteDepreciableAsset: (id: string) => void;
  getUnitDepreciableAssets: (unitId: string) => DepreciableAsset[];
  calculateDepreciation: (assetId: string) => number;
  convertCurrency: (amount: number, fromCurrency: string, toCurrency: string) => number;
}

const EMPTY_FINANCIAL_DATA: UnitFinancialData = {
  unitId: '',
  revenue: 0,
  expenses: 0,
  profit: 0,
  monthlyData: [],
};

const EMPTY_PRODUCTION_UNITS_CONTEXT: ProductionUnitsContextType = {
  units: [],
  infrastructures: [],
  transactions: [],
  purchases: [],
  depreciableAssets: [],
  currency: 'XOF',
  formatCurrency: (amount) => formatMoney(amount),
  activeUnit: null,
  setActiveUnit: () => undefined,
  setCurrency: () => undefined,
  setInfrastructures: () => undefined,
  addUnit: () => undefined,
  updateUnit: () => undefined,
  deleteUnit: () => undefined,
  getUnitInfrastructures: () => [],
  addInfrastructure: () => undefined,
  updateInfrastructure: () => undefined,
  deleteInfrastructure: () => undefined,
  getUnitEquipment: () => [],
  addEquipment: () => undefined,
  updateEquipment: () => undefined,
  getUnitCycles: () => [],
  addCycle: () => undefined,
  updateCycle: () => undefined,
  getUnitFinancialData: () => null,
  getGlobalFinancialData: () => EMPTY_FINANCIAL_DATA,
  addTransaction: () => undefined,
  updateTransaction: () => undefined,
  deleteTransaction: () => undefined,
  getUnitTransactions: () => [],
  addPurchase: () => undefined,
  updatePurchase: () => undefined,
  deletePurchase: () => undefined,
  getUnitPurchases: () => [],
  addDepreciableAsset: () => undefined,
  updateDepreciableAsset: () => undefined,
  deleteDepreciableAsset: () => undefined,
  getUnitDepreciableAssets: () => [],
  calculateDepreciation: () => 0,
  convertCurrency: (amount) => amount,
};

// Keep consumers operational during a transient provider remount instead of
// escalating a recoverable empty state to the application error boundary.
const ProductionUnitsContext = createContext<ProductionUnitsContextType>(EMPTY_PRODUCTION_UNITS_CONTEXT);

export const useProductionUnits = () => {
  return useContext(ProductionUnitsContext);
};

// Données de démonstration
const getDemoUnits = (): ProductionUnit[] => [
  {
    id: 'ECLO001',
    name: 'Écloserie Principale',
    type: 'ecloserie',
    description: 'Production d\'alevins de tilapia et carpe',
    isActive: true,
    capacity: 100000,
    currentStock: 85000,
    manager: 'Dr. Marie Dubois',
    createdAt: '2024-01-15',
    financialData: {
      unitId: 'ECLO001',
      revenue: 25000,
      expenses: 15000,
      profit: 10000,
      monthlyData: [
        { month: 'Jan', revenue: 20000, expenses: 12000, profit: 8000 },
        { month: 'Fév', revenue: 22000, expenses: 13000, profit: 9000 },
        { month: 'Mar', revenue: 25000, expenses: 15000, profit: 10000 }
      ]
    }
  },
  {
    id: 'GROSS001',
    name: 'Unité de Grossissement A',
    type: 'grossissement',
    description: 'Élevage jusqu\'à maturité commerciale',
    isActive: true,
    capacity: 50000,
    currentStock: 42000,
    manager: 'Jean Martin',
    createdAt: '2024-02-01',
    financialData: {
      unitId: 'GROSS001',
      revenue: 45000,
      expenses: 28000,
      profit: 17000,
      monthlyData: [
        { month: 'Jan', revenue: 40000, expenses: 25000, profit: 15000 },
        { month: 'Fév', revenue: 42000, expenses: 26000, profit: 16000 },
        { month: 'Mar', revenue: 45000, expenses: 28000, profit: 17000 }
      ]
    }
  },
  {
    id: 'TRANSF001',
    name: 'Unité de Transformation',
    type: 'transformation',
    description: 'Découpe et préparation des poissons',
    isActive: true,
    capacity: 2000,
    currentStock: 1500,
    manager: 'Sarah Laurent',
    createdAt: '2024-03-10',
    financialData: {
      unitId: 'TRANSF001',
      revenue: 35000,
      expenses: 22000,
      profit: 13000,
      monthlyData: [
        { month: 'Jan', revenue: 30000, expenses: 18000, profit: 12000 },
        { month: 'Fév', revenue: 32000, expenses: 20000, profit: 12000 },
        { month: 'Mar', revenue: 35000, expenses: 22000, profit: 13000 }
      ]
    }
  }
];

const getDemoInfrastructures = (): Infrastructure[] => [
  {
    id: 'INF001',
    name: 'Bassin d\'incubation 1',
    unitId: 'ECLO001',
    type: 'bassin_incubation',
    capacity: 20000,
    status: 'active',
    specifications: { temperature: 26, ph: 7.2, oxygenLevel: 8.5 }
  },
  {
    id: 'INF002',
    name: 'Bassin de grossissement A1',
    unitId: 'GROSS001',
    type: 'bassin_grossissement',
    capacity: 15000,
    status: 'active',
    specifications: { volume: 15000, profondeur: 2.5 }
  },
  {
    id: 'INF003',
    name: 'Chambre froide principale',
    unitId: 'TRANSF001',
    type: 'chambre_froide',
    capacity: 1000,
    status: 'active',
    specifications: { temperature: -18, humidity: 85 }
  }
];

export const ProductionUnitsProvider = ({ children }: { children: ReactNode }) => {
  const { isDemoMode, isAuthenticated, user } = useAuth();
  const [currency, setCurrency] = useState<'XOF' | 'EUR' | 'USD' | 'MAD'>('XOF');
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  
  // Initialiser avec des tableaux vides - les données démo seront ajoutées via useEffect
  const [units, setUnits] = useState<ProductionUnit[]>([]);
  const [infrastructures, setInfrastructures] = useState<Infrastructure[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [cycles, setCycles] = useState<ProductionCycle[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depreciableAssets, setDepreciableAssets] = useState<DepreciableAsset[]>([]);
  const [activeUnit, setActiveUnit] = useState<ProductionUnit | null>(null);

  // Fonction pour charger les unités depuis la base de données
  const fetchUnitsFromDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setIsLoadingUnits(true);
      
      // Vérifier si l'utilisateur est un membre d'équipe
      let ownerId = user.id;
      let allowedUnitIds: string[] = [];
      
        if (user.isTeamMember && user.teamMemberOwnerId) {
        ownerId = user.teamMemberOwnerId;
        
          // Charger les unités assignées au membre via user_id pour garantir l'accès après création de compte
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('id')
            .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        
        if (teamMember) {
          const { data: memberUnits } = await supabase
            .from('team_member_units')
            .select('unit_id')
            .eq('team_member_id', teamMember.id);
          
          allowedUnitIds = (memberUnits || []).map((u: any) => u.unit_id);
        }
      }
      
      const { data, error } = await (supabase as any)
        .from('production_units')
        .select('*')
        .eq('user_id', ownerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching production units:', error);
        return;
      }

      if (data) {
        let filteredData = data;
        
        // Si membre d'équipe, filtrer par unités assignées
        if (user.isTeamMember && allowedUnitIds.length > 0) {
          filteredData = data.filter((unit: any) => allowedUnitIds.includes(unit.id));
        }
        
        const convertedUnits: ProductionUnit[] = filteredData.map((unit: any) => ({
          id: unit.id,
          name: unit.name,
          type: unit.type as ProductionUnitType,
          description: unit.description || '',
          isActive: unit.is_active,
          capacity: unit.capacity,
          currentStock: unit.current_stock,
          manager: unit.manager || '',
          createdAt: unit.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          photoUrl: unit.photo_url || undefined,
          userId: unit.user_id,
        }));
        
        setUnits(convertedUnits);
        setActiveUnit((current) => {
          if (!convertedUnits.length) return null;
          if (!current) return convertedUnits[0];
          return convertedUnits.find((unit) => unit.id === current.id) ?? convertedUnits[0];
        });
      }
    } catch (err) {
      console.error('Error loading units:', err);
    } finally {
      setIsLoadingUnits(false);
    }
  }, [user?.id, user?.isTeamMember, user?.teamMemberOwnerId, user?.email]);

  // Charger les infrastructures depuis la base de données
  const fetchInfrastructuresFromDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('unit_infrastructures')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching infrastructures:', error);
        return;
      }

      if (data) {
        const convertedInfrastructures: Infrastructure[] = data.map((inf: any) => ({
          id: inf.id,
          name: inf.name,
          unitId: inf.unit_id,
          type: inf.type,
          customTypeName: inf.custom_type_name,
          capacity: inf.capacity || 0,
          status: inf.status || 'active',
          specifications: inf.specifications || {},
        }));
        setInfrastructures(convertedInfrastructures);
      }
    } catch (err) {
      console.error('Error loading infrastructures:', err);
    }
  }, [user?.id]);

  // Charger les équipements depuis la base de données
  const fetchEquipmentFromDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('unit_equipment')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching equipment:', error);
        return;
      }

      if (data) {
        const convertedEquipment: Equipment[] = data.map((eq: any) => ({
          id: eq.id,
          name: eq.name,
          type: eq.type,
          unitId: eq.unit_id,
          specifications: eq.specifications || {},
          status: eq.status || 'active',
          purchasePrice: eq.purchase_price,
          purchaseDate: eq.purchase_date,
          depreciationRate: eq.depreciation_rate,
          currentValue: eq.current_value,
        }));
        setEquipment(convertedEquipment);
      }
    } catch (err) {
      console.error('Error loading equipment:', err);
    }
  }, [user?.id]);

  // Charger les achats depuis la base de données
  const fetchPurchasesFromDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('purchases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching purchases:', error);
        return;
      }

      if (data) {
        const convertedPurchases: Purchase[] = data.map((p: any) => ({
          id: p.id,
          date: p.date,
          category: p.category,
          subcategory: p.subcategory,
          description: p.description,
          supplier: p.supplier,
          amount: p.amount,
          currency: p.currency || 'XOF',
          quantity: p.quantity,
          unit: p.unit,
          paymentMethod: p.payment_method,
          reference: p.reference,
          unitId: p.unit_id,
          unitName: p.unit_name,
          status: p.status || 'pending',
          deliveryDate: p.delivery_date,
          notes: p.notes,
        }));
        setPurchases(convertedPurchases);
      }
    } catch (err) {
      console.error('Error loading purchases:', err);
    }
  }, [user?.id]);

  // Charger les transactions depuis la base de données
  const fetchTransactionsFromDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('accounting_transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching transactions:', error);
        return;
      }

      if (data) {
        const convertedTransactions: Transaction[] = data.map((t: any) => ({
          id: t.id,
          date: t.date,
          type: t.type,
          category: t.category,
          description: t.description,
          amount: t.amount,
          currency: t.currency || 'XOF',
          paymentMethod: t.payment_method,
          reference: t.reference,
          supplier: t.supplier,
          client: t.client,
          status: t.status || 'pending',
          unitId: t.unit_id,
          unitName: t.unit_name,
          purchaseId: t.purchase_id,
        }));
        setTransactions(convertedTransactions);
      }
    } catch (err) {
      console.error('Error loading transactions:', err);
    }
  }, [user?.id]);

  // Charger les actifs amortissables depuis la base de données
  const fetchDepreciableAssetsFromDB = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('depreciable_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching depreciable assets:', error);
        return;
      }

      if (data) {
        const convertedAssets: DepreciableAsset[] = data.map((a: any) => ({
          id: a.id,
          name: a.name,
          category: a.category,
          purchasePrice: a.purchase_price,
          currency: a.currency || 'XOF',
          purchaseDate: a.purchase_date,
          depreciationMethod: a.depreciation_method || 'linear',
          usefulLife: a.useful_life || 5,
          currentValue: a.current_value,
          accumulatedDepreciation: a.accumulated_depreciation,
          unitId: a.unit_id,
          status: a.status || 'active',
        }));
        setDepreciableAssets(convertedAssets);
      }
    } catch (err) {
      console.error('Error loading depreciable assets:', err);
    }
  }, [user?.id]);

  // Charger les données démo ou de la DB
  useEffect(() => {
    if (isDemoMode) {
      // Mode démo: charger les données de démonstration
      const demoUnits = getDemoUnits();
      const demoInfrastructures = getDemoInfrastructures();
      
      setUnits(demoUnits);
      setInfrastructures(demoInfrastructures);
      setActiveUnit(demoUnits[0] || null);
      
      // Données démo pour équipements
      setEquipment([
        {
          id: 'EQ001',
          name: 'Four électrique principal',
          type: 'four_electrique',
          unitId: 'TRANSF001',
          status: 'active',
          specifications: { power: '15kW', capacity: '500kg/h', temperature_max: 200 },
          purchasePrice: 2500000,
          purchaseDate: '2024-01-15',
          depreciationRate: 10,
          currentValue: 2250000
        }
      ]);
      
      // Données démo pour cycles
      setCycles([
        {
          id: 'CY001',
          unitId: 'ECLO001',
          name: 'Cycle Tilapia Q1 2024',
          startDate: '2024-01-15',
          status: 'active',
          targetQuantity: 50000,
          currentQuantity: 45000,
          notes: 'Excellente croissance observée'
        }
      ]);
      
      // Données démo pour achats
      setPurchases([
        {
          id: '1',
          date: '2024-01-18',
          category: 'Aliments',
          subcategory: 'Granulés flottants',
          description: 'Aliment poisson croissance 25kg',
          supplier: 'Biomar France',
          amount: 425000,
          currency: 'XOF',
          quantity: 10,
          unit: 'sacs',
          paymentMethod: 'Virement',
          reference: 'CMD-2024-001',
          unitId: 'GROSS001',
          unitName: 'Unité de Grossissement A',
          status: 'received'
        }
      ]);
      
      // Données démo pour transactions
      setTransactions([
        {
          id: '1',
          date: '2024-01-18',
          type: 'revenue',
          category: 'Vente de poissons',
          description: 'Vente carpes - Restaurant Les Saveurs',
          amount: 1250000,
          currency: 'XOF',
          paymentMethod: 'Virement',
          client: 'Restaurant Les Saveurs',
          status: 'confirmed',
          unitId: 'GROSS001',
          unitName: 'Unité de Grossissement A'
        }
      ]);
      
      // Données démo pour amortissements
      setDepreciableAssets([
        {
          id: '1',
          name: 'Four électrique principal',
          category: 'Équipements de transformation',
          purchasePrice: 2500000,
          currency: 'XOF',
          purchaseDate: '2024-01-15',
          depreciationMethod: 'linear',
          usefulLife: 10,
          currentValue: 2250000,
          accumulatedDepreciation: 250000,
          unitId: 'TRANSF001',
          status: 'active'
        }
      ]);
    } else if (isAuthenticated && user?.id) {
      // Utilisateur connecté: charger depuis la base de données
      fetchUnitsFromDB();
      fetchInfrastructuresFromDB();
      fetchEquipmentFromDB();
      fetchPurchasesFromDB();
      fetchTransactionsFromDB();
      fetchDepreciableAssetsFromDB();
    } else {
      // Non connecté: données vides
      setUnits([]);
      setInfrastructures([]);
      setEquipment([]);
      setCycles([]);
      setPurchases([]);
      setTransactions([]);
      setDepreciableAssets([]);
      setActiveUnit(null);
    }
  }, [isDemoMode, isAuthenticated, user?.id, fetchUnitsFromDB, fetchInfrastructuresFromDB, fetchEquipmentFromDB, fetchPurchasesFromDB, fetchTransactionsFromDB, fetchDepreciableAssetsFromDB]);

  const refreshCoreData = useCallback(async (reason = 'manual') => {
    if (isDemoMode || !isAuthenticated || !user?.id) return;
    await Promise.allSettled([
      fetchUnitsFromDB(),
      fetchInfrastructuresFromDB(),
      fetchEquipmentFromDB(),
      fetchPurchasesFromDB(),
      fetchTransactionsFromDB(),
      fetchDepreciableAssetsFromDB(),
    ]);
  }, [
    isDemoMode,
    isAuthenticated,
    user?.id,
    fetchUnitsFromDB,
    fetchInfrastructuresFromDB,
    fetchEquipmentFromDB,
    fetchPurchasesFromDB,
    fetchTransactionsFromDB,
    fetchDepreciableAssetsFromDB,
  ]);

  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      void refreshCoreData(detail?.reason || detail?.table || 'event');
    };
    window.addEventListener('aqua:data-refresh', handleRefresh);
    return () => window.removeEventListener('aqua:data-refresh', handleRefresh);
  }, [refreshCoreData]);

  useEffect(() => {
    recordHookState('ProductionUnitsContext', {
      units: units.length,
      infrastructures: infrastructures.length,
      activeUnit: activeUnit?.id ?? null,
      isLoadingUnits,
      isAuthenticated,
    });
  }, [units.length, infrastructures.length, activeUnit?.id, isLoadingUnits, isAuthenticated]);

  const formatCurrency = (amount: number): string => {
    const currencySymbols = {
      'XOF': 'FCFA',
      'EUR': '€',
      'USD': '$',
      'MAD': 'DH'
    };
    
    const symbol = currencySymbols[currency];
    const formatted = amount.toLocaleString('fr-FR');
    
    if (currency === 'XOF' || currency === 'MAD') {
      return `${formatted} ${symbol}`;
    } else {
      return currency === 'USD' ? `${symbol}${formatted}` : `${formatted}${symbol}`;
    }
  };

  const exchangeRates = {
    'XOF': 1,
    'EUR': 655.957,
    'USD': 600,
    'MAD': 10.8
  };

  const convertCurrency = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount;
    
    // Convertir d'abord en XOF (Franc CFA)
    const xofAmount = fromCurrency === 'XOF' ? amount : amount * exchangeRates[fromCurrency as keyof typeof exchangeRates];
    
    // Puis convertir vers la devise cible
    return toCurrency === 'XOF' ? xofAmount : xofAmount / exchangeRates[toCurrency as keyof typeof exchangeRates];
  };

  const addUnit = async (unitData: Omit<ProductionUnit, 'id' | 'createdAt'>) => {
    // Mode démo: ajout local uniquement
    if (isDemoMode) {
      const newUnit: ProductionUnit = {
        ...unitData,
        id: `UNIT${Date.now()}`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setUnits(prev => [...prev, newUnit]);
      return;
    }

    // Mode connecté: sauvegarder dans la base de données
    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('production_units')
        .insert({
          user_id: user.id,
          name: unitData.name,
          type: unitData.type,
          description: unitData.description || null,
          is_active: unitData.isActive ?? true,
          capacity: unitData.capacity || 0,
          current_stock: unitData.currentStock || 0,
          manager: unitData.manager || null,
          photo_url: unitData.photoUrl || null,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating unit:', error);
        throw error;
      }

      // Convertir et ajouter au state
      const newUnit: ProductionUnit = {
        id: data.id,
        name: data.name,
        type: data.type as ProductionUnitType,
        description: data.description || '',
        isActive: data.is_active,
        capacity: data.capacity,
        currentStock: data.current_stock,
        manager: data.manager || '',
        createdAt: data.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
        photoUrl: data.photo_url || undefined,
        userId: data.user_id,
      };
      
      setUnits(prev => [newUnit, ...prev]);
      emitDataMutation({ table: 'production_units', action: 'create', id: data.id, module: 'units' });
      await refreshCoreData('unit-created');
    } catch (err) {
      console.error('Error adding unit:', err);
    }
  };

  const updateUnit = async (id: string, updates: Partial<ProductionUnit>) => {
    // Mode démo: mise à jour locale uniquement
    if (isDemoMode) {
      setUnits(units.map(unit => 
        unit.id === id ? { ...unit, ...updates } : unit
      ));
      return;
    }

    // Mode connecté: sauvegarder dans la base de données
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
      if (updates.currentStock !== undefined) dbUpdates.current_stock = updates.currentStock;
      if (updates.manager !== undefined) dbUpdates.manager = updates.manager;
      if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;

      const { error } = await (supabase as any)
        .from('production_units')
        .update(dbUpdates)
        .eq('id', id);

      if (error) {
        console.error('Error updating unit:', error);
        throw error;
      }

      setUnits(units.map(unit => 
        unit.id === id ? { ...unit, ...updates } : unit
      ));
      emitDataMutation({ table: 'production_units', action: 'update', id, module: 'units' });
      await refreshCoreData('unit-updated');
    } catch (err) {
      console.error('Error updating unit:', err);
    }
  };

  const deleteUnit = async (id: string) => {
    // Mode démo: suppression locale uniquement
    if (isDemoMode) {
      setUnits(units.filter(unit => unit.id !== id));
      setInfrastructures(infrastructures.filter(inf => inf.unitId !== id));
      setEquipment(equipment.filter(eq => eq.unitId !== id));
      setCycles(cycles.filter(cy => cy.unitId !== id));
      return;
    }

    // Mode connecté: supprimer de la base de données
    try {
      const { error } = await (supabase as any)
        .from('production_units')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting unit:', error);
        throw error;
      }

      setUnits(units.filter(unit => unit.id !== id));
      setInfrastructures(infrastructures.filter(inf => inf.unitId !== id));
      setEquipment(equipment.filter(eq => eq.unitId !== id));
      setCycles(cycles.filter(cy => cy.unitId !== id));
      emitDataMutation({ table: 'production_units', action: 'delete', id, module: 'units' });
      await refreshCoreData('unit-deleted');
    } catch (err) {
      console.error('Error deleting unit:', err);
    }
  };

  const getUnitInfrastructures = (unitId: string) => {
    return infrastructures.filter(inf => inf.unitId === unitId);
  };

  const addInfrastructure = async (infraData: Omit<Infrastructure, 'id'>) => {
    if (isDemoMode) {
      const newInfrastructure: Infrastructure = {
        ...infraData,
        id: `INF${Date.now()}`
      };
      setInfrastructures([...infrastructures, newInfrastructure]);
      return;
    }

    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('unit_infrastructures')
        .insert({
          user_id: user.id,
          unit_id: infraData.unitId,
          name: infraData.name,
          type: infraData.type,
          custom_type_name: infraData.customTypeName,
          capacity: infraData.capacity || 0,
          status: infraData.status || 'active',
          specifications: infraData.specifications || {},
        })
        .select()
        .single();

      if (error) throw error;

      const newInfrastructure: Infrastructure = {
        id: data.id,
        name: data.name,
        unitId: data.unit_id,
        type: data.type,
        customTypeName: data.custom_type_name,
        capacity: data.capacity,
        status: data.status,
        specifications: data.specifications,
      };
      setInfrastructures([newInfrastructure, ...infrastructures]);
      emitDataMutation({ table: 'unit_infrastructures', action: 'create', id: data.id, module: 'infrastructures' });
      await refreshCoreData('infrastructure-created');
    } catch (err) {
      console.error('Error adding infrastructure:', err);
    }
  };

  const updateInfrastructure = async (id: string, updates: Partial<Infrastructure>) => {
    if (isDemoMode) {
      setInfrastructures(infrastructures.map(inf => 
        inf.id === id ? { ...inf, ...updates } : inf
      ));
      return;
    }

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.unitId !== undefined) dbUpdates.unit_id = updates.unitId;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.customTypeName !== undefined) dbUpdates.custom_type_name = updates.customTypeName;
      if (updates.capacity !== undefined) dbUpdates.capacity = updates.capacity;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.specifications !== undefined) dbUpdates.specifications = updates.specifications;

      const { error } = await (supabase as any)
        .from('unit_infrastructures')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setInfrastructures(infrastructures.map(inf => 
        inf.id === id ? { ...inf, ...updates } : inf
      ));
      emitDataMutation({ table: 'unit_infrastructures', action: 'update', id, module: 'infrastructures' });
      await refreshCoreData('infrastructure-updated');
    } catch (err) {
      console.error('Error updating infrastructure:', err);
    }
  };

  const deleteInfrastructure = async (id: string) => {
    if (isDemoMode) {
      setInfrastructures(infrastructures.filter(inf => inf.id !== id));
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('unit_infrastructures')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setInfrastructures(infrastructures.filter(inf => inf.id !== id));
      emitDataMutation({ table: 'unit_infrastructures', action: 'delete', id, module: 'infrastructures' });
      await refreshCoreData('infrastructure-deleted');
    } catch (err) {
      console.error('Error deleting infrastructure:', err);
    }
  };

  const getUnitEquipment = (unitId: string) => {
    return equipment.filter(eq => eq.unitId === unitId);
  };

  const addEquipment = async (equipData: Omit<Equipment, 'id'>) => {
    if (isDemoMode) {
      const newEquipment: Equipment = {
        ...equipData,
        id: `EQ${Date.now()}`
      };
      setEquipment([...equipment, newEquipment]);
      return;
    }

    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('unit_equipment')
        .insert({
          user_id: user.id,
          unit_id: equipData.unitId,
          name: equipData.name,
          type: equipData.type,
          specifications: equipData.specifications || {},
          status: equipData.status || 'active',
          purchase_price: equipData.purchasePrice || 0,
          purchase_date: equipData.purchaseDate,
          depreciation_rate: equipData.depreciationRate || 0,
          current_value: equipData.currentValue || 0,
        })
        .select()
        .single();

      if (error) throw error;

      const newEquipment: Equipment = {
        id: data.id,
        name: data.name,
        type: data.type,
        unitId: data.unit_id,
        specifications: data.specifications,
        status: data.status,
        purchasePrice: data.purchase_price,
        purchaseDate: data.purchase_date,
        depreciationRate: data.depreciation_rate,
        currentValue: data.current_value,
      };
      setEquipment([newEquipment, ...equipment]);
    } catch (err) {
      console.error('Error adding equipment:', err);
    }
  };

  const updateEquipment = async (id: string, updates: Partial<Equipment>) => {
    if (isDemoMode) {
      setEquipment(equipment.map(eq => 
        eq.id === id ? { ...eq, ...updates } : eq
      ));
      return;
    }

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.specifications !== undefined) dbUpdates.specifications = updates.specifications;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.purchasePrice !== undefined) dbUpdates.purchase_price = updates.purchasePrice;
      if (updates.purchaseDate !== undefined) dbUpdates.purchase_date = updates.purchaseDate;
      if (updates.depreciationRate !== undefined) dbUpdates.depreciation_rate = updates.depreciationRate;
      if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;

      const { error } = await (supabase as any)
        .from('unit_equipment')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setEquipment(equipment.map(eq => 
        eq.id === id ? { ...eq, ...updates } : eq
      ));
    } catch (err) {
      console.error('Error updating equipment:', err);
    }
  };

  const getUnitCycles = (unitId: string) => {
    return cycles.filter(cy => cy.unitId === unitId);
  };

  const addCycle = (cycleData: Omit<ProductionCycle, 'id'>) => {
    const newCycle: ProductionCycle = {
      ...cycleData,
      id: `CY${Date.now()}`
    };
    setCycles([...cycles, newCycle]);
  };

  const updateCycle = (id: string, updates: Partial<ProductionCycle>) => {
    setCycles(cycles.map(cy => 
      cy.id === id ? { ...cy, ...updates } : cy
    ));
  };

  const getUnitFinancialData = (unitId: string): UnitFinancialData | null => {
    const unit = units.find(u => u.id === unitId);
    return unit?.financialData || null;
  };

  const getGlobalFinancialData = (): UnitFinancialData => {
    const allFinancialData = units.map(unit => unit.financialData).filter(Boolean) as UnitFinancialData[];
    
    const totalRevenue = allFinancialData.reduce((sum, data) => sum + data.revenue, 0);
    const totalExpenses = allFinancialData.reduce((sum, data) => sum + data.expenses, 0);
    const totalProfit = totalRevenue - totalExpenses;

    // Aggregate monthly data
    const monthlyData = ['Jan', 'Fév', 'Mar'].map(month => {
      const monthRevenue = allFinancialData.reduce((sum, data) => {
        const monthData = data.monthlyData.find(m => m.month === month);
        return sum + (monthData?.revenue || 0);
      }, 0);
      
      const monthExpenses = allFinancialData.reduce((sum, data) => {
        const monthData = data.monthlyData.find(m => m.month === month);
        return sum + (monthData?.expenses || 0);
      }, 0);

      return {
        month,
        revenue: monthRevenue,
        expenses: monthExpenses,
        profit: monthRevenue - monthExpenses
      };
    });

    return {
      unitId: 'GLOBAL',
      revenue: totalRevenue,
      expenses: totalExpenses,
      profit: totalProfit,
      monthlyData
    };
  };

  const addTransaction = async (transactionData: Omit<Transaction, 'id'>) => {
    if (isDemoMode) {
      const newTransaction: Transaction = {
        ...transactionData,
        id: Date.now().toString(),
        currency: transactionData.currency || currency
      };
      setTransactions([...transactions, newTransaction]);
      return newTransaction.id;
    }

    if (!user?.id) return null;

    try {
      const { data, error } = await (supabase as any)
        .from('accounting_transactions')
        .insert({
          user_id: user.id,
          date: transactionData.date,
          type: transactionData.type,
          category: transactionData.category,
          description: transactionData.description,
          amount: transactionData.amount,
          currency: transactionData.currency || currency,
          payment_method: transactionData.paymentMethod,
          reference: transactionData.reference,
          supplier: transactionData.supplier,
          client: transactionData.client,
          status: transactionData.status || 'pending',
          unit_id: transactionData.unitId,
          unit_name: transactionData.unitName,
          purchase_id: transactionData.purchaseId,
        })
        .select()
        .single();

      if (error) throw error;

      const newTransaction: Transaction = {
        id: data.id,
        date: data.date,
        type: data.type,
        category: data.category,
        description: data.description,
        amount: data.amount,
        currency: data.currency,
        paymentMethod: data.payment_method,
        reference: data.reference,
        supplier: data.supplier,
        client: data.client,
        status: data.status,
        unitId: data.unit_id,
        unitName: data.unit_name,
        purchaseId: data.purchase_id,
      };
      setTransactions([newTransaction, ...transactions]);
      return data.id;
    } catch (err) {
      console.error('Error adding transaction:', err);
      return null;
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    if (isDemoMode) {
      setTransactions(transactions.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
      return;
    }

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.type !== undefined) dbUpdates.type = updates.type;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
      if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
      if (updates.supplier !== undefined) dbUpdates.supplier = updates.supplier;
      if (updates.client !== undefined) dbUpdates.client = updates.client;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await (supabase as any)
        .from('accounting_transactions')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setTransactions(transactions.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
    } catch (err) {
      console.error('Error updating transaction:', err);
    }
  };

  const deleteTransaction = async (id: string) => {
    if (isDemoMode) {
      setTransactions(transactions.filter(t => t.id !== id));
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('accounting_transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTransactions(transactions.filter(t => t.id !== id));
    } catch (err) {
      console.error('Error deleting transaction:', err);
    }
  };

  const getUnitTransactions = (unitId: string) => {
    return transactions.filter(t => t.unitId === unitId);
  };

  const addPurchase = async (purchaseData: Omit<Purchase, 'id'>) => {
    if (isDemoMode) {
      const newPurchase: Purchase = {
        ...purchaseData,
        id: Date.now().toString(),
        currency: purchaseData.currency || currency
      };
      setPurchases([...purchases, newPurchase]);

      if (newPurchase.status === 'received') {
        addTransaction({
          date: newPurchase.date,
          type: 'expense',
          category: newPurchase.category,
          description: newPurchase.description,
          amount: newPurchase.amount,
          currency: newPurchase.currency,
          paymentMethod: newPurchase.paymentMethod,
          supplier: newPurchase.supplier,
          status: 'confirmed',
          unitId: newPurchase.unitId,
          unitName: newPurchase.unitName,
          purchaseId: newPurchase.id,
          reference: newPurchase.reference
        });
      }
      return;
    }

    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('purchases')
        .insert({
          user_id: user.id,
          date: purchaseData.date,
          category: purchaseData.category,
          subcategory: purchaseData.subcategory,
          description: purchaseData.description,
          supplier: purchaseData.supplier,
          amount: purchaseData.amount,
          currency: purchaseData.currency || currency,
          quantity: purchaseData.quantity,
          unit: purchaseData.unit,
          payment_method: purchaseData.paymentMethod,
          reference: purchaseData.reference,
          unit_id: purchaseData.unitId,
          unit_name: purchaseData.unitName,
          status: purchaseData.status || 'pending',
          delivery_date: purchaseData.deliveryDate,
          notes: purchaseData.notes,
        })
        .select()
        .single();

      if (error) throw error;

      const newPurchase: Purchase = {
        id: data.id,
        date: data.date,
        category: data.category,
        subcategory: data.subcategory,
        description: data.description,
        supplier: data.supplier,
        amount: data.amount,
        currency: data.currency,
        quantity: data.quantity,
        unit: data.unit,
        paymentMethod: data.payment_method,
        reference: data.reference,
        unitId: data.unit_id,
        unitName: data.unit_name,
        status: data.status,
        deliveryDate: data.delivery_date,
        notes: data.notes,
      };
      setPurchases([newPurchase, ...purchases]);

      // Create corresponding transaction if purchase is received
      if (newPurchase.status === 'received') {
        await addTransaction({
          date: newPurchase.date,
          type: 'expense',
          category: newPurchase.category,
          description: newPurchase.description,
          amount: newPurchase.amount,
          currency: newPurchase.currency,
          paymentMethod: newPurchase.paymentMethod,
          supplier: newPurchase.supplier,
          status: 'confirmed',
          unitId: newPurchase.unitId,
          unitName: newPurchase.unitName,
          purchaseId: newPurchase.id,
          reference: newPurchase.reference
        });
      }
    } catch (err) {
      console.error('Error adding purchase:', err);
    }
  };

  const updatePurchase = async (id: string, updates: Partial<Purchase>) => {
    const purchase = purchases.find(p => p.id === id);
    if (!purchase) return;

    if (isDemoMode) {
      const updatedPurchase = { ...purchase, ...updates };
      setPurchases(purchases.map(p => 
        p.id === id ? updatedPurchase : p
      ));

      // Check if status changed to 'received' and no transaction exists
      if (updates.status === 'received' && purchase.status !== 'received') {
        const correspondingTransaction = transactions.find(t => t.purchaseId === id);
        if (correspondingTransaction) {
          updateTransaction(correspondingTransaction.id, {
            status: 'confirmed',
            amount: updates.amount ?? purchase.amount
          });
        } else {
          // Create new expense transaction
          addTransaction({
            date: updatedPurchase.date,
            type: 'expense',
            category: updatedPurchase.category,
            description: updatedPurchase.description,
            amount: updatedPurchase.amount,
            currency: updatedPurchase.currency,
            paymentMethod: updatedPurchase.paymentMethod,
            supplier: updatedPurchase.supplier,
            status: 'confirmed',
            unitId: updatedPurchase.unitId,
            unitName: updatedPurchase.unitName,
            purchaseId: updatedPurchase.id,
            reference: updatedPurchase.reference
          });
        }
      }
      return;
    }

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.date !== undefined) dbUpdates.date = updates.date;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.subcategory !== undefined) dbUpdates.subcategory = updates.subcategory;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.supplier !== undefined) dbUpdates.supplier = updates.supplier;
      if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
      if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
      if (updates.paymentMethod !== undefined) dbUpdates.payment_method = updates.paymentMethod;
      if (updates.reference !== undefined) dbUpdates.reference = updates.reference;
      if (updates.status !== undefined) dbUpdates.status = updates.status;
      if (updates.deliveryDate !== undefined) dbUpdates.delivery_date = updates.deliveryDate;
      if (updates.notes !== undefined) dbUpdates.notes = updates.notes;

      const { error } = await (supabase as any)
        .from('purchases')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      const updatedPurchase = { ...purchase, ...updates };
      setPurchases(purchases.map(p => 
        p.id === id ? updatedPurchase : p
      ));

      // Check if status changed to 'received'
      if (updates.status === 'received' && purchase.status !== 'received') {
        const correspondingTransaction = transactions.find(t => t.purchaseId === id);
        if (correspondingTransaction) {
          // Update existing transaction
          await updateTransaction(correspondingTransaction.id, {
            status: 'confirmed',
            amount: updates.amount ?? purchase.amount
          });
        } else {
          // Create new expense transaction
          await addTransaction({
            date: updatedPurchase.date,
            type: 'expense',
            category: updatedPurchase.category,
            description: updatedPurchase.description,
            amount: updatedPurchase.amount,
            currency: updatedPurchase.currency,
            paymentMethod: updatedPurchase.paymentMethod,
            supplier: updatedPurchase.supplier,
            status: 'confirmed',
            unitId: updatedPurchase.unitId,
            unitName: updatedPurchase.unitName,
            purchaseId: updatedPurchase.id,
            reference: updatedPurchase.reference
          });
        }
      }
    } catch (err) {
      console.error('Error updating purchase:', err);
      throw err;
    }
  };

  const deletePurchase = async (id: string) => {
    if (isDemoMode) {
      setPurchases(purchases.filter(p => p.id !== id));
      const correspondingTransaction = transactions.find(t => t.purchaseId === id);
      if (correspondingTransaction) {
        deleteTransaction(correspondingTransaction.id);
      }
      return;
    }

    try {
      // Delete corresponding transaction first
      const correspondingTransaction = transactions.find(t => t.purchaseId === id);
      if (correspondingTransaction) {
        await deleteTransaction(correspondingTransaction.id);
      }

      const { error } = await (supabase as any)
        .from('purchases')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPurchases(purchases.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting purchase:', err);
    }
  };

  const getUnitPurchases = (unitId: string) => {
    return purchases.filter(p => p.unitId === unitId);
  };

  const addDepreciableAsset = async (assetData: Omit<DepreciableAsset, 'id'>) => {
    if (isDemoMode) {
      const newAsset: DepreciableAsset = {
        ...assetData,
        id: Date.now().toString(),
        currency: assetData.currency || (currency === 'XOF' ? 'XOF' : currency)
      };
      setDepreciableAssets([...depreciableAssets, newAsset]);
      return;
    }

    if (!user?.id) return;

    try {
      const { data, error } = await (supabase as any)
        .from('depreciable_assets')
        .insert({
          user_id: user.id,
          name: assetData.name,
          category: assetData.category,
          purchase_price: assetData.purchasePrice,
          currency: assetData.currency || currency,
          purchase_date: assetData.purchaseDate,
          depreciation_method: assetData.depreciationMethod || 'linear',
          useful_life: assetData.usefulLife || 5,
          current_value: assetData.currentValue || assetData.purchasePrice,
          accumulated_depreciation: assetData.accumulatedDepreciation || 0,
          unit_id: assetData.unitId,
          status: assetData.status || 'active',
        })
        .select()
        .single();

      if (error) throw error;

      const newAsset: DepreciableAsset = {
        id: data.id,
        name: data.name,
        category: data.category,
        purchasePrice: data.purchase_price,
        currency: data.currency,
        purchaseDate: data.purchase_date,
        depreciationMethod: data.depreciation_method,
        usefulLife: data.useful_life,
        currentValue: data.current_value,
        accumulatedDepreciation: data.accumulated_depreciation,
        unitId: data.unit_id,
        status: data.status,
      };
      setDepreciableAssets([newAsset, ...depreciableAssets]);
    } catch (err) {
      console.error('Error adding depreciable asset:', err);
    }
  };

  const updateDepreciableAsset = async (id: string, updates: Partial<DepreciableAsset>) => {
    if (isDemoMode) {
      setDepreciableAssets(depreciableAssets.map(asset => 
        asset.id === id ? { ...asset, ...updates } : asset
      ));
      return;
    }

    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.purchasePrice !== undefined) dbUpdates.purchase_price = updates.purchasePrice;
      if (updates.currency !== undefined) dbUpdates.currency = updates.currency;
      if (updates.purchaseDate !== undefined) dbUpdates.purchase_date = updates.purchaseDate;
      if (updates.depreciationMethod !== undefined) dbUpdates.depreciation_method = updates.depreciationMethod;
      if (updates.usefulLife !== undefined) dbUpdates.useful_life = updates.usefulLife;
      if (updates.currentValue !== undefined) dbUpdates.current_value = updates.currentValue;
      if (updates.accumulatedDepreciation !== undefined) dbUpdates.accumulated_depreciation = updates.accumulatedDepreciation;
      if (updates.status !== undefined) dbUpdates.status = updates.status;

      const { error } = await (supabase as any)
        .from('depreciable_assets')
        .update(dbUpdates)
        .eq('id', id);

      if (error) throw error;

      setDepreciableAssets(depreciableAssets.map(asset => 
        asset.id === id ? { ...asset, ...updates } : asset
      ));
    } catch (err) {
      console.error('Error updating depreciable asset:', err);
    }
  };

  const deleteDepreciableAsset = async (id: string) => {
    if (isDemoMode) {
      setDepreciableAssets(depreciableAssets.filter(asset => asset.id !== id));
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('depreciable_assets')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setDepreciableAssets(depreciableAssets.filter(asset => asset.id !== id));
    } catch (err) {
      console.error('Error deleting depreciable asset:', err);
    }
  };

  const getUnitDepreciableAssets = (unitId: string) => {
    return depreciableAssets.filter(asset => asset.unitId === unitId);
  };

  const calculateDepreciation = (assetId: string): number => {
    const asset = depreciableAssets.find(a => a.id === assetId);
    if (!asset) return 0;

    const purchaseDate = new Date(asset.purchaseDate);
    const currentDate = new Date();
    const yearsElapsed = (currentDate.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);

    if (asset.depreciationMethod === 'linear') {
      const annualDepreciation = asset.purchasePrice / asset.usefulLife;
      return Math.min(annualDepreciation * yearsElapsed, asset.purchasePrice);
    }

    return 0;
  };

  return (
    <ProductionUnitsContext.Provider value={{
      units,
      infrastructures,
      transactions,
      purchases,
      depreciableAssets,
      currency,
      formatCurrency,
      activeUnit,
      setActiveUnit,
      setCurrency,
      setInfrastructures,
      addUnit,
      updateUnit,
      deleteUnit,
      getUnitInfrastructures,
      addInfrastructure,
      updateInfrastructure,
      deleteInfrastructure,
      getUnitEquipment,
      addEquipment,
      updateEquipment,
      getUnitCycles,
      addCycle,
      updateCycle,
      getUnitFinancialData,
      getGlobalFinancialData,
      addTransaction,
      updateTransaction,
      deleteTransaction,
      getUnitTransactions,
      addPurchase,
      updatePurchase,
      deletePurchase,
      getUnitPurchases,
      addDepreciableAsset,
      updateDepreciableAsset,
      deleteDepreciableAsset,
      getUnitDepreciableAssets,
      calculateDepreciation,
      convertCurrency
    }}>
      {children}
    </ProductionUnitsContext.Provider>
  );
};
