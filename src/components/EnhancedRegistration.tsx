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
import { Eye, EyeOff, Fish, Loader2, User as UserIcon, Mail, Phone, MapPin, Building2, KeyRound, Factory, Radio, ChevronsUpDown, Check, MailCheck, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { useSettings } from '@/contexts/SettingsContext';
import aquapiloteLogo from '@/assets/aquapilote-logo.png';
import registerBgAsset from '@/assets/aquapilote-register-bg-v2.png.asset.json';
import loginBgAsset from '@/assets/aquapilote-login-bg-v2.png.asset.json';
import fishColumnsMobile from '@/assets/fish-columns-mobile.jpg';
import { ALL_COUNTRIES } from '@/lib/allCountries';

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
  const [chosenPlan, setChosenPlan] = useState<string>(selectedPlan || 'standard');
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


  const getFormErrors = (): string[] => {
    const errors: string[] = [];
    if (formData.lastName.trim().length < 2) errors.push('Saisissez votre nom (2 caractères minimum).');
    if (formData.firstName.trim().length < 2) errors.push('Saisissez votre prénom (2 caractères minimum).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) errors.push('Saisissez une adresse e-mail valide.');
    if (formData.phone.trim().length < 4) errors.push('Saisissez votre numéro de téléphone.');
    if (!formData.countryCode) errors.push('Sélectionnez votre pays.');
    if (formData.companyName.trim().length < 2) errors.push('Saisissez le nom de votre ferme.');
    if (formData.location.trim().length < 2) errors.push("Saisissez l'adresse de votre ferme.");
    if (formData.password.length < 8) errors.push('Le mot de passe doit contenir au moins 8 caractères.');
    if (!/[A-Z]/.test(formData.password)) errors.push('Le mot de passe doit contenir une majuscule.');
    if (!/[a-z]/.test(formData.password)) errors.push('Le mot de passe doit contenir une minuscule.');
    if (!/[0-9]/.test(formData.password)) errors.push('Le mot de passe doit contenir un chiffre.');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(formData.password)) errors.push('Le mot de passe doit contenir un caractère spécial.');
    if (formData.password !== formData.confirmPassword) errors.push('Les deux mots de passe ne correspondent pas.');
    if (formData.productionUnits.length === 0) errors.push("Sélectionnez au moins un type d'élevage.");
    if (!formData.exploitationType) errors.push("Sélectionnez un type d'exploitation.");
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
          <div className="bg-white rounded-2xl shadow-lg md:shadow-xl border border-slate-200/70 overflow-hidden">
            <div className="p-6 sm:p-8">
              {/* Logo / titre */}
              <div className="text-center mb-6">
                <img
                  src={aquapiloteLogo}
                  alt="AquaPilote"
                  className="mx-auto h-20 w-auto object-contain mb-2"
                />
                <DialogTitle className="text-2xl font-semibold text-slate-800">
                  Créer votre compte
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Formulaire d'inscription AquaPilote
                </DialogDescription>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-3">
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
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

                {/* Type d'élevage */}
                <div className="pt-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Fish className="w-4 h-4 text-blue-500" />
                    Type d'élevage <span className="text-pink-500">*</span>
                  </Label>
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                     {breedingTypes.map(type => {
                       const active = formData.productionUnits.includes(type);
                       return (
                         <label
                           key={type}
                           className={`flex items-center gap-3 text-sm rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${active ? 'border-blue-500 bg-blue-50 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                         >
                           <Checkbox
                             checked={active}
                             onCheckedChange={(checked) => toggleBreedingType(type, checked === true)}
                            className="h-5 w-5 shrink-0 aspect-square rounded-[4px] border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                           />
                           <span className="font-medium">{type}</span>
                         </label>
                       );
                     })}
                   </div>
                </div>

                {/* Type d'exploitation */}
                <div className="pt-2">
                  <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Factory className="w-4 h-4 text-blue-500" />
                    Type d'exploitation <span className="text-pink-500">*</span>
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
                          className={`text-left rounded-xl border p-3 transition-all ${active ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                          <div className="text-sm font-semibold text-slate-800">{opt.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Besoin de capteurs IoT */}
                <div className="pt-2">
                   <label className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${formData.needsSensors ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'}`}>
                     <Checkbox
                       checked={formData.needsSensors}
                       onCheckedChange={(checked) => handleInputChange('needsSensors', checked === true)}
                       className="h-5 w-5 shrink-0 aspect-square rounded-[4px] border-2 border-slate-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                     />
                    <div className="flex items-start gap-2 flex-1">
                      <Radio className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-semibold text-slate-800">J'ai besoin de capteurs IoT</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Cochez si vous souhaitez équiper votre ferme de capteurs (température, pH, oxygène…). Notre équipe pourra vous accompagner.</div>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Choix de l'abonnement — 1er mois offert */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-800">Choisissez votre abonnement</p>
                  <p className="text-[11px] text-slate-500">Le premier mois est offert en mode essai, sans paiement. Vous pourrez changer d'offre à tout moment.</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ id: 'standard', label: 'Standard' }, { id: 'premium', label: 'Premium' }, { id: 'enterprise', label: 'Entreprise' }].map((p) => (
                      <button type="button" key={p.id} onClick={() => setChosenPlan(p.id)}
                        className={`rounded-xl border-2 p-2 text-center text-sm font-semibold transition-colors ${chosenPlan === p.id ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'}`}>
                        {p.label}
                        <span className="block text-[10px] font-normal text-green-700">1 mois gratuit</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bouton Valider */}
                {formErrors.length > 0 && (
                  <div role="alert" aria-live="assertive" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    <p className="font-semibold">Inscription impossible</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {formErrors.map((message) => <li key={message}>{message}</li>)}
                    </ul>
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-full mt-4 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
                  style={{ background: 'linear-gradient(90deg, #a78bfa 0%, #60a5fa 50%, #22d3ee 100%)' }}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Création…</>
                  ) : 'Valider'}
                </Button>

                {/* Demo + lien connexion */}
                <div className="flex flex-col items-center gap-2 pt-2">
                  <button type="button" onClick={onSwitchToLogin}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    J'ai déjà un compte
                  </button>
                  <button type="button" onClick={handleDemoMode}
                    className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                    <Fish className="w-3 h-3" /> Essayer la démo
                  </button>
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
            <MailCheck className="w-5 h-5 text-blue-600" />
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
  <div className="relative flex items-center rounded-full border border-slate-200 bg-white shadow-sm hover:border-slate-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-0.5 pointer-events-none">
      {icon}
      {required && <span className="text-pink-500 text-xs leading-none">*</span>}
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
            className="w-full flex items-center justify-between pl-7 pr-4 h-11 rounded-full bg-transparent text-left text-sm text-slate-700 focus:outline-none"
          >
            <span className={selected ? '' : 'text-slate-400'}>
              {selected
                ? `${selected.flag} ${selected.name}`
                : detecting
                  ? 'Détection…'
                  : 'Sélectionnez le pays de résidence'}
            </span>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 shrink-0" />
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
                    <span className="text-xs text-slate-400">{c.phonePrefix}</span>
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
