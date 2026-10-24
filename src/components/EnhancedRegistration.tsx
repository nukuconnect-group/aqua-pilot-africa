import { SUPABASE_URL } from '@/integrations/supabase/env';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, EyeOff, Fish, Loader2, User as UserIcon, Mail, Phone, MapPin, Building2, KeyRound, Factory, Radio, ChevronsUpDown, Check, MailCheck, ShieldAlert, Egg, Store, Scissors, Snowflake, Leaf, Wheat, ChevronLeft, ChevronRight, Sparkles, Star, Rocket, Crown, Handshake, Layers } from 'lucide-react';
import { SIGNUP_UNIT_OPTIONS } from '@/lib/signupUnits';

const UNIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  grossissement: Fish, ecloserie: Egg, fabrication_aliment: Wheat, commercialisation: Store,
  transformation: Scissors, conservation: Snowflake, algoculture: Leaf,
};
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import OfflineAuthNotice, { OFFLINE_AUTH_MESSAGE } from '@/components/auth/OfflineAuthNotice';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { useSettings } from '@/contexts/SettingsContext';
import aquapiloteLogo from '@/assets/aquapilote-logo.png';
import registerBgAsset from '@/assets/aquapilote-register-bg-v2.png.asset.json';
import loginBgAsset from '@/assets/aquapilote-login-bg-v2.png.asset.json';
import fishColumnsMobile from '@/assets/fish-columns-mobile.jpg';
import { ALL_COUNTRIES } from '@/lib/allCountries';

const STEPS = [
  { title: 'Compte', icon: UserIcon, heading: 'Vos informations', desc: 'Identité, contact et mot de passe sécurisé.' },
  { title: 'Exploitation', icon: Building2, heading: 'Votre exploitation', desc: 'Nom, adresse et taille de votre ferme.' },
  { title: 'Unités', icon: Layers, heading: 'Vos unités de production', desc: 'Choisissez ce que vous voulez gérer : seuls ces espaces seront affichés.' },
  { title: 'Abonnement', icon: Crown, heading: 'Votre abonnement', desc: 'Commencez gratuitement pendant 1 mois, puis choisissez l’offre adaptée.' },
];

const SIGNUP_PLANS = [
  { id: 'trial_discovery', name: 'Essai gratuit — 1 mois', desc: 'Accès complet pendant 30 jours, sans paiement.', price: '0 F CFA', period: '30 jours', icon: Sparkles, badge: 'Pour commencer', features: ['Tous les modules de vos unités', 'Aucune carte bancaire', 'Changement d’offre à tout moment'] },
  { id: 'annual_basic', name: 'Semi-exploitation', desc: 'Petites et moyennes exploitations.', price: '60 000 F CFA', period: '/ an', icon: Star, features: ['Modules principaux', 'Rapports PDF et Excel', 'Support prioritaire'] },
  { id: 'annual_pro', name: 'Semi-industriel', desc: 'Production organisée à échelle moyenne.', price: '120 000 F CFA', period: '/ an', icon: Rocket, features: ['Tout Semi-exploitation', 'Multi-unités et équipe', 'Analyse IA des maladies'] },
  { id: 'annual_enterprise', name: 'Industriel', desc: 'Grandes productions intensives.', price: 'Sur devis', period: '', icon: Crown, features: ['Tous les modules', 'Formation sur site', 'Interlocuteur dédié'] },
  { id: 'custom', name: 'Sur mesure', desc: 'Besoins spécifiques : contactez-nous.', price: 'Nous contacter', period: '', icon: Handshake, features: ['Modules et intégrations adaptés', 'Accompagnement personnalisé'] },
];

interface EnhancedRegistrationProps {
  onClose: () => void;
  onSwitchToLogin: () => void;
  selectedPlan?: string | null;
}

// Country list with codes, phone prefixes, flags, and typical names
const countryOptions = [
  { code: 'TG', name: 'Togo', phonePrefix: '+228', flag: '🇹🇬', sampleFirstNames: ['Kodjo', 'Kofi', 'Ama', 'Akouvi', 'Yao', 'Essi'], sampleLastNames: ['Agbeko', 'Mensah', 'Amouzou', 'Kpodo', 'Assogba', 'Attiogbe'] },
  { code: 'BJ', name: 'Bénin', phonePrefix: '+229', flag: '🇧🇯', sampleFirstNames: ['Codjo', 'Fréjus', 'Elvire', 'Grâce', 'Boris', 'Sènami'], sampleLastNames: ['Houngbedji', 'Ahouandjinou', 'Dossou', 'Agossou', 'Houénou', 'Gnimavo'] },
  { code: 'CI', name: 'Côte d\'Ivoire', phonePrefix: '+225', flag: '🇨🇮', sampleFirstNames: ['Kouadio', 'Yao', 'Aya', 'Aminata', 'Seydou', 'Fatou'], sampleLastNames: ['Koné', 'Ouattara', 'Touré', 'Koffi', 'Bamba', 'Coulibaly'] },
  { code: 'SN', name: 'Sénégal', phonePrefix: '+221', flag: '🇸🇳', sampleFirstNames: ['Moussa', 'Fatou', 'Ibrahima', 'Aminata', 'Ousmane', 'Aïssatou'], sampleLastNames: ['Diop', 'Ndiaye', 'Fall', 'Sow', 'Ba', 'Diallo'] },
  { code: 'ML', name: 'Mali', phonePrefix: '+223', flag: '🇲🇱', sampleFirstNames: ['Amadou', 'Fatoumata', 'Moussa', 'Mariam', 'Oumar', 'Kadiatou'], sampleLastNames: ['Traoré', 'Coulibaly', 'Diarra', 'Keita', 'Sissoko', 'Sangaré'] },
  { code: 'BF', name: 'Burkina Faso', phonePrefix: '+226', flag: '🇧🇫', sampleFirstNames: ['Adama', 'Fatimata', 'Issouf', 'Mariam', 'Hamidou', 'Salamata'], sampleLastNames: ['Ouédraogo', 'Sawadogo', 'Compaoré', 'Kaboré', 'Zoungrana', 'Tall'] },
  { code: 'NE', name: 'Niger', phonePrefix: '+227', flag: '🇳🇪', sampleFirstNames: ['Abdou', 'Halima', 'Hamidou', 'Mariama', 'Souley', 'Fati'], sampleLastNames: ['Abdou', 'Mahamane', 'Adamou', 'Ibrahim', 'Moussa', 'Boubacar'] },
  { code: 'GN', name: 'Guinée', phonePrefix: '+224', flag: '🇬🇳', sampleFirstNames: ['Mamadou', 'Fatoumata', 'Alpha', 'Mariama', 'Ibrahima', 'Kadiatou'], sampleLastNames: ['Diallo', 'Barry', 'Bah', 'Camara', 'Soumah', 'Sylla'] },
  { code: 'CM', name: 'Cameroun', phonePrefix: '+237', flag: '🇨🇲', sampleFirstNames: ['Jean', 'Marie', 'Paul', 'Cécile', 'Emmanuel', 'Nadège'], sampleLastNames: ['Nkomo', 'Mbarga', 'Fotso', 'Tchoumi', 'Ngono', 'Kamga'] },
  { code: 'GA', name: 'Gabon', phonePrefix: '+241', flag: '🇬🇦', sampleFirstNames: ['Jean-Pierre', 'Marie-Claire', 'Patrick', 'Sylvie', 'Christian', 'Nadine'], sampleLastNames: ['Moussavou', 'Ndong', 'Obiang', 'Nze', 'Mba', 'Ella'] },
  { code: 'CG', name: 'Congo', phonePrefix: '+242', flag: '🇨🇬', sampleFirstNames: ['Serge', 'Nadine', 'Cédric', 'Grâce', 'Parfait', 'Charlène'], sampleLastNames: ['Mbemba', 'Mouanda', 'Ngoie', 'Mabiala', 'Malonga', 'Banzouzi'] },
  { code: 'CD', name: 'RD Congo', phonePrefix: '+243', flag: '🇨🇩', sampleFirstNames: ['Patrick', 'Grâce', 'Christian', 'Nadine', 'Jonathan', 'Esther'], sampleLastNames: ['Kabongo', 'Mbuyi', 'Tshimanga', 'Kalala', 'Mutombo', 'Kasongo'] },
  { code: 'TD', name: 'Tchad', phonePrefix: '+235', flag: '🇹🇩', sampleFirstNames: ['Moussa', 'Fatimé', 'Abdoulaye', 'Hawa', 'Mahamat', 'Amina'], sampleLastNames: ['Mahamat', 'Adam', 'Hassan', 'Ali', 'Oumar', 'Djibrine'] },
  { code: 'CF', name: 'Centrafrique', phonePrefix: '+236', flag: '🇨🇫', sampleFirstNames: ['Jean', 'Marie', 'Pierre', 'Cécile', 'Paul', 'Brigitte'], sampleLastNames: ['Ngoupandé', 'Yakité', 'Ziguélé', 'Goumba', 'Bria', 'Ndoutingaï'] },
  { code: 'MG', name: 'Madagascar', phonePrefix: '+261', flag: '🇲🇬', sampleFirstNames: ['Hery', 'Nirina', 'Andry', 'Voahirana', 'Tojo', 'Mialy'], sampleLastNames: ['Rakoto', 'Andria', 'Ratsimba', 'Rasolofo', 'Raveloson', 'Randriana'] },
  { code: 'MU', name: 'Maurice', phonePrefix: '+230', flag: '🇲🇺', sampleFirstNames: ['Rajesh', 'Priya', 'Kevin', 'Marie', 'Vikram', 'Anita'], sampleLastNames: ['Doorgakant', 'Ramsaran', 'Jeetoo', 'Doobur', 'Doorgakant', 'Doorgakant'] },
  { code: 'MA', name: 'Maroc', phonePrefix: '+212', flag: '🇲🇦', sampleFirstNames: ['Mohammed', 'Fatima', 'Ahmed', 'Khadija', 'Youssef', 'Zineb'], sampleLastNames: ['Alaoui', 'Bennani', 'Tazi', 'El Fassi', 'Cherkaoui', 'Berrada'] },
  { code: 'DZ', name: 'Algérie', phonePrefix: '+213', flag: '🇩🇿', sampleFirstNames: ['Mohammed', 'Fatima', 'Ahmed', 'Amina', 'Karim', 'Nadia'], sampleLastNames: ['Boudiaf', 'Benali', 'Khelifi', 'Hamidi', 'Djamel', 'Larbi'] },
  { code: 'TN', name: 'Tunisie', phonePrefix: '+216', flag: '🇹🇳', sampleFirstNames: ['Mohamed', 'Fatma', 'Ahmed', 'Amira', 'Youssef', 'Ines'], sampleLastNames: ['Ben Ali', 'Trabelsi', 'Bouazizi', 'Jebali', 'Mabrouk', 'Gharbi'] },
  { code: 'EG', name: 'Égypte', phonePrefix: '+20', flag: '🇪🇬', sampleFirstNames: ['Mohamed', 'Fatma', 'Ahmed', 'Nour', 'Omar', 'Sara'], sampleLastNames: ['Hassan', 'Ibrahim', 'Ali', 'Mohamed', 'Mahmoud', 'Abdel'] },
  { code: 'FR', name: 'France', phonePrefix: '+33', flag: '🇫🇷', sampleFirstNames: ['Jean', 'Marie', 'Pierre', 'Sophie', 'Thomas', 'Camille'], sampleLastNames: ['Martin', 'Durand', 'Bernard', 'Dubois', 'Moreau', 'Laurent'] },
  { code: 'BE', name: 'Belgique', phonePrefix: '+32', flag: '🇧🇪', sampleFirstNames: ['Jean', 'Marie', 'Luc', 'Anne', 'Thomas', 'Emma'], sampleLastNames: ['Janssens', 'Peeters', 'Maes', 'Jacobs', 'Mertens', 'Willems'] },
  { code: 'CH', name: 'Suisse', phonePrefix: '+41', flag: '🇨🇭', sampleFirstNames: ['Marc', 'Marie', 'Pierre', 'Anna', 'Thomas', 'Laura'], sampleLastNames: ['Müller', 'Favre', 'Rochat', 'Bianchi', 'Brunner', 'Keller'] },
  { code: 'CA', name: 'Canada', phonePrefix: '+1', flag: '🇨🇦', sampleFirstNames: ['Jean', 'Marie', 'Pierre', 'Sophie', 'Marc', 'Isabelle'], sampleLastNames: ['Tremblay', 'Gagnon', 'Roy', 'Côté', 'Bouchard', 'Gauthier'] },
  { code: 'OTHER', name: 'Autre pays', phonePrefix: '', flag: '🌍', sampleFirstNames: [], sampleLastNames: [] }
];

const getPhonePrefix = (countryCode: string): string => {
  const country = countryOptions.find(c => c.code === countryCode);
  if (country?.phonePrefix) return country.phonePrefix;
  const world = ALL_COUNTRIES.find(c => c.code === countryCode);
  return world?.phonePrefix || '';
};

const getCountryFlag = (countryCode: string): string => {
  const country = countryOptions.find(c => c.code === countryCode);
  return country?.flag || '🌍';
};

const getCountryInfo = (countryCode: string) => {
  return countryOptions.find(c => c.code === countryCode);
};

const getNameSuggestions = (countryCode: string) => {
  const country = countryOptions.find(c => c.code === countryCode);
  if (!country) return { firstNames: [], lastNames: [] };
  return { firstNames: country.sampleFirstNames || [], lastNames: country.sampleLastNames || [] };
};

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  sector: string;
  country: string;
  countryCode: string;
  location: string;
  phone: string;
  employeeCount: string;
  productionUnits: string[];
  hasProcessing: boolean;
  hasMarketing: boolean;
  hasAlgaeCulture: boolean;
  otherActivities: string;
  exploitationType: '' | 'moyenne' | 'semi_industriel' | 'industriel';
  needsSensors: boolean;
}

const EnhancedRegistration: React.FC<EnhancedRegistrationProps> = ({
  onClose,
  onSwitchToLogin,
  selectedPlan = null
}) => {
  const [chosenPlan, setChosenPlan] = useState<string>(selectedPlan || 'trial_discovery');
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);
  const [showConfirmEmailDialog, setShowConfirmEmailDialog] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: '',
    sector: '',
    country: '',
    countryCode: '',
    location: '',
    phone: '',
    employeeCount: '',
    productionUnits: [],
    hasProcessing: false,
    hasMarketing: false,
    hasAlgaeCulture: false,
    otherActivities: '',
    exploitationType: '',
    needsSensors: false
  });

  // Detect location on mount
  useEffect(() => {
    const detectLocation = async () => {
      setIsDetectingLocation(true);
      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/detect-country`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.country && data.countryCode) {
            const matchedCountry = countryOptions.find(
              c => c.code === data.countryCode || c.name.toLowerCase() === data.country.toLowerCase()
            );
            const detectedCountryCode = matchedCountry?.code || data.countryCode;
            const phonePrefix = getPhonePrefix(detectedCountryCode);
            
            setFormData(prev => ({
              ...prev,
              country: matchedCountry?.name || data.country,
              countryCode: detectedCountryCode,
              location: data.city && data.region 
                ? `${data.city}, ${data.region}` 
                : data.city || data.region || '',
              phone: phonePrefix ? `${phonePrefix} ` : prev.phone
            }));
            setLocationDetected(true);
          }
        }
      } catch (error) {
        console.error('Error detecting location:', error);
      } finally {
        setIsDetectingLocation(false);
      }
    };
    detectLocation();
  }, []);

  const { register, isLoading, enterDemoMode } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { formatCurrency, t } = useSettings();

  const handleDemoMode = () => {
    enterDemoMode();
    navigate('/dashboard');
  };

  const productionUnitOptions = [
    t('hatchery') || 'Écloserie', 
    t('grow_out') || 'Grossissement', 
    t('pre_grow_out') || 'Pré-grossissement', 
    t('nursery') || 'Nurserie', 
    t('reproduction') || 'Reproduction', 
    t('preventive_quarantine') || 'Quarantaine',
    t('shrimp_culture') || 'Crevette culture'
  ];
  
  const sectorOptions = [
    t('freshwater_aquaculture') || 'Pisciculture d\'eau douce', 
    t('marine_aquaculture') || 'Aquaculture marine', 
    t('shellfish') || 'Conchyliculture', 
    t('algaculture') || 'Algaculture', 
    t('aquaponics') || 'Aquaponie', 
    t('other') || 'Autre'
  ];

  const handleInputChange = (field: keyof FormData, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFormErrors([]);
  };
  
  const handleCountryChange = (countryCode: string) => {
    const selectedCountry =
      countryOptions.find(c => c.code === countryCode) ||
      ALL_COUNTRIES.find(c => c.code === countryCode);
    const phonePrefix = getPhonePrefix(countryCode);
    
    setFormData(prev => {
      const currentPhone = prev.phone.trim();
      const hasOnlyPrefix =
        countryOptions.some(c => c.phonePrefix && currentPhone === c.phonePrefix) ||
        ALL_COUNTRIES.some(c => c.phonePrefix && currentPhone === c.phonePrefix);
      const isEmpty = !currentPhone;
      
      return {
        ...prev,
        countryCode,
        country: selectedCountry?.name || '',
        phone: (isEmpty || hasOnlyPrefix) && phonePrefix ? `${phonePrefix} ` : prev.phone
      };
    });
  };

  const handleProductionUnitChange = (unit: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, productionUnits: [...prev.productionUnits, unit] }));
    } else {
      setFormData(prev => ({ ...prev, productionUnits: prev.productionUnits.filter(u => u !== unit) }));
    }
  };


  const getFormErrors = (upTo = 4): string[] => {
    const errors: string[] = [];
    const step1: string[] = []; const step2: string[] = []; const step3: string[] = [];
    if (formData.lastName.trim().length < 2) step1.push('Saisissez votre nom (2 caractères minimum).');
    if (formData.firstName.trim().length < 2) step1.push('Saisissez votre prénom (2 caractères minimum).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) step1.push('Saisissez une adresse e-mail valide.');
    if (formData.phone.trim().length < 4) step1.push('Saisissez votre numéro de téléphone.');
    if (!formData.countryCode) step1.push('Sélectionnez votre pays.');
    if (formData.companyName.trim().length < 2) step2.push('Saisissez le nom de votre ferme.');
    if (formData.location.trim().length < 2) step2.push("Saisissez l'adresse de votre ferme.");
    if (formData.password.length < 8) step1.push('Le mot de passe doit contenir au moins 8 caractères.');
    if (!/[A-Z]/.test(formData.password)) step1.push('Le mot de passe doit contenir une majuscule.');
    if (!/[a-z]/.test(formData.password)) step1.push('Le mot de passe doit contenir une minuscule.');
    if (!/[0-9]/.test(formData.password)) step1.push('Le mot de passe doit contenir un chiffre.');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)) step1.push('Le mot de passe doit contenir un caractère spécial.');
    if (formData.password !== formData.confirmPassword) step1.push('Les deux mots de passe ne correspondent pas.');
    if (formData.productionUnits.length === 0) step3.push('Choisissez au moins une unité à gérer.');
    if (!formData.exploitationType) step2.push("Sélectionnez un type d'exploitation.");
    errors.push(...step1); if (upTo >= 2) errors.push(...step2); if (upTo >= 3) errors.push(...step3);
    return errors;
  };

  const goNext = () => {
    const errs = getFormErrors(currentStep);
    if (errs.length) { setFormErrors(errs); return; }
    setFormErrors([]); setCurrentStep((s) => Math.min(4, s + 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({ title: 'Connexion Internet requise', description: OFFLINE_AUTH_MESSAGE, variant: 'destructive' });
      return;
    }
    const validationErrors = getFormErrors();
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      toast({
        title: 'Champs incomplets',
        description: validationErrors[0],
        variant: 'destructive',
      });
      return;
    }
    setFormErrors([]);
    try {
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      const result = await register(
        fullName,
        formData.email.trim().toLowerCase(),
        formData.password,
        chosenPlan || 'trial',
        {
          exploitation_type: formData.exploitationType || undefined,
          needs_sensors: formData.needsSensors,
          company_name: formData.companyName.trim() || undefined,
          company_address: formData.location.trim() || undefined,
          phone: formData.phone.trim() || undefined,
          country: formData.country || undefined,
          country_code: formData.countryCode || undefined,
          production_units: formData.productionUnits,
        }
      );
      if (result.success) {
        setConfirmedEmail(formData.email.trim().toLowerCase());
        setShowConfirmEmailDialog(true);
      } else {
        setFormErrors([result.error || 'Une erreur est survenue pendant la création du compte.']);
        toast({ title: '❌ Erreur d\'inscription', description: result.error || 'Une erreur est survenue', variant: 'destructive' });
      }
    } catch (error) {
      setFormErrors(["Une erreur technique empêche actuellement la création du compte."]);
      toast({ title: '❌ Erreur', description: 'Une erreur technique est survenue.', variant: 'destructive' });
    }
  };

  const nameSuggestions = getNameSuggestions(formData.countryCode);

  // 6 types d'élevage demandés
  const breedingTypes = [
    'Écloserie',
    'Algoculture',
    'Aquaculture marine',
    'Pisciculture',
    'Commercialisation / Conservation',
    'Aquaculture d\'eau douce',
    'Crevette culture',
  ];

  const toggleBreedingType = (value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      productionUnits: checked
        ? [...prev.productionUnits, value]
        : prev.productionUnits.filter(v => v !== value),
    }));
  };

  return (
    <>
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent hideClose className="!max-w-none w-screen h-screen p-0 overflow-hidden border-0 flex items-stretch justify-center md:justify-end bg-transparent md:bg-slate-50">
        {/* Image à gauche (desktop) */}
        <div
          className="hidden md:block fixed inset-y-0 left-0 w-1/2 z-0"
          style={{
            backgroundImage: `url(${registerBgAsset.url})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'brightness(0.75)',
          }}
        />
        <div className="hidden md:block fixed inset-y-0 left-0 w-1/2 bg-gradient-to-br from-slate-900/70 via-blue-900/50 to-cyan-900/60 z-[1]" />
        <div className="hidden md:block fixed inset-y-0 left-0 w-1/2 z-[2] pointer-events-none">
          <div className="absolute bottom-16 left-[8%] right-[8%] text-white/95">
            <h2 className="text-3xl xl:text-4xl font-bold tracking-tight">Rejoignez AquaPilote</h2>
            <p className="mt-2 text-sm xl:text-base text-white/80 max-w-md">Créez votre compte et pilotez votre ferme d'aquaculture en toute simplicité.</p>
          </div>
        </div>
        {/* Fond mobile — bandeau image poissons en haut (identique à la page Connexion) */}
        <div className="md:hidden fixed inset-0 z-0 bg-slate-50 dark:bg-slate-950" aria-hidden="true" />
        <div
          className="md:hidden fixed inset-x-0 top-0 h-28 z-0"
          style={{
            backgroundImage: `url(${fishColumnsMobile})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          aria-hidden="true"
        />
        <div className="md:hidden fixed inset-x-0 top-0 h-28 bg-gradient-to-b from-slate-900/40 to-slate-50 dark:to-slate-950 z-[1]" aria-hidden="true" />

        <div className="relative z-10 w-full md:w-1/2 flex items-start justify-center px-4 pt-24 pb-6 md:pt-8 md:pb-8 md:px-10 overflow-y-auto md:bg-slate-50">
         <div className="w-full max-w-xl md:mt-0">
          <div className="bg-card rounded-2xl shadow-lg md:shadow-xl border border-border overflow-hidden">
            <div className="p-6 sm:p-8">
              {/* Logo / titre */}
              <div className="text-center mb-6">
                <img
                  src={aquapiloteLogo}
                  alt="AquaPilote"
                  className="mx-auto h-20 w-auto object-contain mb-2"
                />
                <DialogTitle className="text-2xl font-semibold text-foreground">
                  Créer votre compte
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Formulaire d'inscription AquaPilote
                </DialogDescription>
              </div>

              {/* Étapes */}
              <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Étapes de l'inscription">
                {STEPS.map((s, i) => {
                  const n = i + 1; const done = currentStep > n; const active = currentStep === n; const Icon = s.icon;
                  return (
                    <li key={s.title} className="flex flex-col items-center gap-1.5 text-center">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${done ? 'border-primary bg-primary text-primary-foreground' : active ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                        {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      </span>
                      <span className={`text-[11px] font-medium leading-tight ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{s.title}</span>
                    </li>
                  );
                })}
              </ol>
              <div className="mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">Étape {currentStep} sur 4</p>
                <h3 className="text-lg font-semibold text-foreground">{STEPS[currentStep - 1].heading}</h3>
                <p className="text-sm text-muted-foreground">{STEPS[currentStep - 1].desc}</p>
              </div>

              <form onSubmit={currentStep === 4 ? handleSubmit : (e) => { e.preventDefault(); goNext(); }} noValidate className="space-y-3">
                <OfflineAuthNotice />
                {currentStep === 1 && <>
                {/* Nom + Prénom */}
                <div className="grid grid-cols-2 gap-3">
                  <FieldWithIcon icon={<UserIcon className="w-4 h-4" />} required>
                    <Input
                      placeholder="Nom"
                      value={formData.lastName}
                      onChange={e => handleInputChange('lastName', e.target.value)}
                      required
                      className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                    />
                  </FieldWithIcon>
                  <FieldWithIcon icon={<UserIcon className="w-4 h-4" />} required>
                    <Input
                      placeholder="Prénom(s)"
                      value={formData.firstName}
                      onChange={e => handleInputChange('firstName', e.target.value)}
                      required
                      className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                    />
                  </FieldWithIcon>
                </div>

                {/* Email */}
                <FieldWithIcon icon={<Mail className="w-4 h-4" />} required>
                  <Input
                    type="email" placeholder="Email"
                    value={formData.email}
                    onChange={e => handleInputChange('email', e.target.value)}
                    required
                    className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                  />
                </FieldWithIcon>

                {/* Téléphone */}
                <FieldWithIcon icon={<Phone className="w-4 h-4" />} required>
                  <Input
                    type="tel" placeholder="Numéro de téléphone"
                    value={formData.phone}
                    onChange={e => handleInputChange('phone', e.target.value)}
                    required
                    className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                  />
                </FieldWithIcon>

                {/* Pays */}
                <CountryCombobox
                  value={formData.countryCode}
                  onChange={handleCountryChange}
                  detecting={isDetectingLocation}
                />
                {/* Mot de passe */}
                <FieldWithIcon icon={<KeyRound className="w-4 h-4" />} required>
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mot de passe (min. 8 caractères)"
                    value={formData.password}
                    onChange={e => handleInputChange('password', e.target.value)}
                    required minLength={8}
                    className="border-0 shadow-none pl-7 pr-9 h-11 rounded-full bg-transparent focus-visible:ring-0"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </FieldWithIcon>

                {/* Confirmation */}
                <FieldWithIcon icon={<KeyRound className="w-4 h-4" />} required>
                  <Input
                    type="password" placeholder="Confirmer le mot de passe"
                    value={formData.confirmPassword}
                    onChange={e => handleInputChange('confirmPassword', e.target.value)}
                    required minLength={8}
                    className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                  />
                </FieldWithIcon>
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-xs text-destructive pl-2">Les mots de passe ne correspondent pas</p>
                )}
                </>}
                {currentStep === 2 && <>
                {/* Nom de la ferme */}
                <FieldWithIcon icon={<Building2 className="w-4 h-4" />} required>
                  <Input
                    placeholder="Nom de la ferme"
                    value={formData.companyName}
                    onChange={e => handleInputChange('companyName', e.target.value)}
                    required
                    className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                  />
                </FieldWithIcon>

                {/* Adresse de la ferme */}
                <FieldWithIcon icon={<MapPin className="w-4 h-4" />} required>
                  <Input
                    placeholder="Adresse de la ferme"
                    value={formData.location}
                    onChange={e => handleInputChange('location', e.target.value)}
                    required
                    className="border-0 shadow-none pl-7 h-11 rounded-full bg-transparent focus-visible:ring-0"
                  />
                </FieldWithIcon>
                {/* Type d'exploitation */}
                <div className="pt-2">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Factory className="w-4 h-4 text-primary" />
                    Type d'exploitation <span className="text-destructive">*</span>
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    {[
                      { v: 'moyenne', label: 'Moyenne exploitation', desc: 'Ferme familiale ou artisanale' },
                      { v: 'semi_industriel', label: 'Semi-industriel', desc: 'Production organisée à échelle moyenne' },
                      { v: 'industriel', label: 'Industriel', desc: 'Grande production intensive' },
                    ].map(opt => {
                      const active = formData.exploitationType === opt.v;
                      return (
                        <button
                          key={opt.v}
                          type="button"
                          onClick={() => handleInputChange('exploitationType', opt.v)}
                          className={`text-left rounded-xl border p-3 transition-all ${active ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border hover:border-primary/50 bg-card'}`}
                        >
                          <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Besoin de capteurs IoT */}
                <div className="pt-2">
                   <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${formData.needsSensors ? 'border-primary bg-primary/10' : 'border-border bg-card hover:border-blue-300 hover:bg-primary/5'}`}>
                     <Checkbox
                       checked={formData.needsSensors}
                       onCheckedChange={(checked) => handleInputChange('needsSensors', checked === true)}
                       className="h-5 w-5 shrink-0 aspect-square rounded-[4px] border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                     />
                    <div className="flex items-start gap-2 flex-1">
                      <Radio className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-foreground">J'ai besoin de capteurs IoT</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Cochez si vous souhaitez équiper votre ferme de capteurs (température, pH, oxygène…). Notre équipe pourra vous accompagner.</div>
                      </div>
                    </div>
                  </label>
                </div>
                </>}
                {currentStep === 3 && <>
                {/* Unités à gérer */}
                <div className="pt-2">
                  <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Fish className="w-4 h-4 text-primary" />
                    Que voulez-vous gérer ? <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">Choisissez une ou plusieurs unités. Chacune aura ses propres modules.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                    {SIGNUP_UNIT_OPTIONS.map(opt => {
                      const active = formData.productionUnits.includes(opt.type);
                      const Icon = UNIT_ICONS[opt.type] ?? Fish;
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleBreedingType(opt.type, !active)}
                          className={`relative text-left rounded-xl border p-3 transition-all ${active ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border hover:border-primary/50 bg-card'}`}
                        >
                          {active && <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />}
                          <Icon className={`w-6 h-6 mb-2 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                          <p className="text-xs text-muted-foreground">{opt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
                </>}
                {currentStep === 4 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {SIGNUP_PLANS.map((p) => {
                      const active = chosenPlan === p.id; const Icon = p.icon;
                      return (
                        <button key={p.id} type="button" aria-pressed={active} onClick={() => setChosenPlan(p.id)}
                          className={`relative flex flex-col rounded-xl border-2 p-4 text-left transition-all ${active ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-card hover:border-primary/50'} ${p.id === 'trial_discovery' ? 'sm:col-span-2' : ''}`}>
                          {p.badge && <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">{p.badge}</span>}
                          <div className="flex items-start justify-between gap-2">
                            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{active && <Check className="h-3 w-3" />}</span>
                          </div>
                          <p className="mt-3 font-semibold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.desc}</p>
                          <p className="mt-2 text-lg font-bold text-foreground">{p.price}<span className="ml-1 text-xs font-normal text-muted-foreground">{p.period}</span></p>
                          <ul className="mt-2 space-y-1">
                            {p.features.map((f) => <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground"><Check className="mt-0.5 h-3 w-3 shrink-0 text-primary" />{f}</li>)}
                          </ul>
                        </button>
                      );
                    })}
                    <p className="sm:col-span-2 text-xs text-muted-foreground">Chaque compte démarre par 1 mois d’essai gratuit, sans paiement. L’offre choisie est enregistrée et pourra être activée à la fin de l’essai. Pour « Sur mesure », notre équipe vous recontacte.</p>
                  </div>
                )}

                {formErrors.length > 0 && (
                  <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <ul className="list-disc space-y-1 pl-5">{formErrors.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}

                <div className="flex gap-2 pt-3">
                  {currentStep > 1 && (
                    <Button type="button" variant="outline" className="h-12 flex-1 rounded-full" onClick={() => { setFormErrors([]); setCurrentStep((s) => s - 1); }}>
                      <ChevronLeft className="mr-1 h-4 w-4" /> Retour
                    </Button>
                  )}
                  <Button type="submit" disabled={isLoading} className="h-12 flex-[2] rounded-full font-semibold">
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Création…</>
                      : currentStep < 4 ? <>Continuer <ChevronRight className="ml-1 h-4 w-4" /></> : 'Créer mon compte'}
                  </Button>
                </div>

                <div className="flex flex-col items-center gap-2 pt-2">
                  <button type="button" onClick={onSwitchToLogin} className="text-sm font-medium text-primary hover:underline">J'ai déjà un compte</button>
                </div>
              </form>

            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={showConfirmEmailDialog} onOpenChange={() => { /* bloquant */ }}>
      <DialogContent hideClose className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MailCheck className="w-5 h-5 text-primary" />
            Confirmez votre adresse e-mail
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-600 pt-2 space-y-3">
            <span className="block">
              Un e-mail de confirmation a été envoyé à
              <span className="font-semibold text-slate-900"> {confirmedEmail}</span>.
            </span>
            <span className="block">
              👉 Ouvrez votre boîte de réception (et vérifiez les <strong>spams</strong>),
              puis cliquez sur le lien pour <strong>confirmer votre adresse e-mail</strong>.
            </span>
            <span className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-800">
              <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Après confirmation de votre e-mail, un <strong>administrateur</strong>
                {' '}vérifiera puis <strong>activera votre compte</strong> avant votre
                première connexion.
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            className="w-full"
            onClick={() => { setShowConfirmEmailDialog(false); onSwitchToLogin(); }}
          >
            J'ai compris
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
};

// Composant champ avec icône à gauche dans un input arrondi
const FieldWithIcon: React.FC<{ icon: React.ReactNode; required?: boolean; children: React.ReactNode }> = ({ icon, required, children }) => (
  <div className="relative flex items-center rounded-full border border-border bg-card shadow-sm hover:border-primary/50 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center gap-0.5 pointer-events-none">
      {icon}
      {required && <span className="text-destructive text-xs leading-none">*</span>}
    </div>
    <div className="w-full pl-7">
      {children}
    </div>
  </div>
);

// Searchable country combobox — full ISO list with search fallback when
// auto-detection fails or returns an unexpected country.
const CountryCombobox: React.FC<{
  value: string;
  onChange: (code: string) => void;
  detecting?: boolean;
}> = ({ value, onChange, detecting }) => {
  const [open, setOpen] = useState(false);
  const selected = ALL_COUNTRIES.find(c => c.code === value);
  return (
    <FieldWithIcon icon={<MapPin className="w-4 h-4" />} required>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between pl-7 pr-4 h-11 rounded-full bg-transparent text-left text-sm text-foreground focus:outline-none"
          >
            <span className={selected ? '' : 'text-muted-foreground'}>
              {selected
                ? `${selected.flag} ${selected.name}`
                : detecting
                  ? 'Détection…'
                  : 'Sélectionnez le pays de résidence'}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] z-[2000]" align="start">
          <Command>
            <CommandInput placeholder="Rechercher un pays…" />
            <CommandList>
              <CommandEmpty>Aucun pays trouvé.</CommandEmpty>
              <CommandGroup>
                {ALL_COUNTRIES.map(c => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.code}`}
                    onSelect={() => {
                      onChange(c.code);
                      setOpen(false);
                    }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === c.code ? 'opacity-100' : 'opacity-0'}`} />
                    <span className="mr-2">{c.flag}</span>
                    <span className="flex-1">{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.phonePrefix}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </FieldWithIcon>
  );
};

export default EnhancedRegistration;
