// React core imports
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { translations, type SupportedLanguage } from '@/i18n';
import {
  defaultCurrencyForLanguage,
  formatMoney,
  setCurrency as setGlobalCurrency,
} from '@/lib/currency';

export interface CompanyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  registrationNumber: string;
  taxId: string;
  stampUrl: string;
  signatureUrl: string;
  hideStampOnDocuments?: boolean;
  cifNif: string;
  rccm: string;
  website: string;
  legalRepresentative: string;
}

interface SettingsContextType {
  theme: 'light' | 'dark' | 'auto';
  language: SupportedLanguage;
  currency: 'EUR' | 'USD' | 'XOF' | 'MAD';
  timezone: string;
  country: string;
  offlineMode: boolean;
  showOfflineIndicator: boolean;
  companyInfo: CompanyInfo;
  setTheme: (theme: 'light' | 'dark' | 'auto') => void;
  setLanguage: (language: SupportedLanguage) => void;
  setCurrency: (currency: 'EUR' | 'USD' | 'XOF' | 'MAD') => void;
  setTimezone: (timezone: string) => void;
  setCountry: (country: string) => void;
  setOfflineMode: (enabled: boolean) => void;
  setShowOfflineIndicator: (show: boolean) => void;
  setCompanyInfo: (info: Partial<CompanyInfo>) => void;
  t: (key: string) => string;
  formatCurrency: (amount: number) => string;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const defaultCompanyInfo: CompanyInfo = {
  name: '',
  address: '',
  phone: '',
  email: '',
  logoUrl: '',
  registrationNumber: '',
  taxId: '',
  stampUrl: '',
  signatureUrl: '',
  hideStampOnDocuments: false,
  cifNif: '',
  rccm: '',
  website: '',
  legalRepresentative: '',
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('light');
  const [language, setLanguage] = useState<SupportedLanguage>('fr');
  const [currency, setCurrency] = useState<'EUR' | 'USD' | 'XOF' | 'MAD'>('XOF');
  const [timezone, setTimezoneState] = useState<string>('');
  const [country, setCountryState] = useState<string>('');
  const [offlineMode, setOfflineModeState] = useState<boolean>(true);
  const [showOfflineIndicator, setShowOfflineIndicatorState] = useState<boolean>(false);
  const [companyInfo, setCompanyInfoState] = useState<CompanyInfo>(defaultCompanyInfo);
  const [companyInfoUserId, setCompanyInfoUserId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Détecter automatiquement le fuseau horaire et le pays
  useEffect(() => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezoneState(detectedTimezone);
    
    const timezoneToCountry: { [key: string]: string } = {
      'Europe/Paris': 'France',
      'Europe/London': 'United Kingdom',
      'America/New_York': 'United States',
      'Africa/Abidjan': 'Côte d\'Ivoire',
      'Africa/Casablanca': 'Maroc',
      'Africa/Dakar': 'Sénégal',
      'Africa/Lagos': 'Nigeria',
      'Asia/Dubai': 'UAE',
      'Asia/Tokyo': 'Japan'
    };
    
    const detectedCountry = timezoneToCountry[detectedTimezone] || detectedTimezone.split('/')[1]?.replace(/_/g, ' ') || 'Unknown';
    setCountryState(detectedCountry);
  }, []);

  // Initialisation sûre après le montage du composant
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('app-theme') as 'light' | 'dark' | 'auto';
      const savedLanguage = localStorage.getItem('app-language') as SupportedLanguage;
      const savedCurrency = localStorage.getItem('app-currency') as 'EUR' | 'USD' | 'XOF' | 'MAD';
      const savedOfflineMode = localStorage.getItem('app-offline-mode');
      const savedShowOfflineIndicator = localStorage.getItem('app-show-offline-indicator');
      
      if (savedTheme) setTheme(savedTheme);
      
      // Détection automatique de la langue du navigateur si aucune langue sauvegardée
      if (savedLanguage && ['fr', 'en', 'es', 'pt', 'ar', 'ewe', 'kabye', 'adja', 'wolof', 'bambara'].includes(savedLanguage)) {
        setLanguage(savedLanguage);
      } else {
        const browserLanguage = navigator.language.toLowerCase();
        let detectedLanguage: SupportedLanguage = 'en';
        if (browserLanguage.startsWith('fr')) detectedLanguage = 'fr';
        else if (browserLanguage.startsWith('es')) detectedLanguage = 'es';
        else if (browserLanguage.startsWith('pt')) detectedLanguage = 'pt';
        else if (browserLanguage.startsWith('ar')) detectedLanguage = 'ar';
        setLanguage(detectedLanguage);
        localStorage.setItem('app-language', detectedLanguage);
      }
      
      // Devise : choix utilisateur prioritaire, sinon valeur conseillée selon la langue.
      const activeLanguage = (localStorage.getItem('app-language') as SupportedLanguage) || 'fr';
      const resolvedCurrency = savedCurrency && ['EUR', 'USD', 'XOF', 'MAD'].includes(savedCurrency)
        ? savedCurrency
        : defaultCurrencyForLanguage(activeLanguage);
      setCurrency(resolvedCurrency);
      setGlobalCurrency(resolvedCurrency);
      
      if (savedOfflineMode !== null) setOfflineModeState(savedOfflineMode === 'true');
      if (savedShowOfflineIndicator !== null) setShowOfflineIndicatorState(savedShowOfflineIndicator === 'true');
      
      // Charger les informations de l'entreprise (isolées par utilisateur)
      supabase.auth
        .getSession()
        .then(async ({ data }) => {
          const uid = data.session?.user?.id ?? null;
          setCompanyInfoUserId(uid);

          const scopedKey = uid ? `app-company-info:${uid}` : 'app-company-info';
          const savedCompanyInfo = localStorage.getItem(scopedKey) || localStorage.getItem('app-company-info');
          if (savedCompanyInfo) {
            try {
              setCompanyInfoState({ ...defaultCompanyInfo, ...JSON.parse(savedCompanyInfo) });
            } catch {
              console.error('Error parsing company info');
            }
          }

          // Load authoritative company info from Supabase profile
          if (uid) {
            try {
              const { data: profile } = await supabase
                .from('profiles')
                .select('company_name, company_address, company_phone, company_email, company_logo_url, company_registration_number, company_tax_id, company_stamp_url, company_signature_url, company_cif_nif, company_rccm, company_website, company_legal_representative')
                .eq('id', uid)
                .maybeSingle();
              if (profile) {
                const remote: CompanyInfo = {
                  ...defaultCompanyInfo,
                  name: profile.company_name || '',
                  address: profile.company_address || '',
                  phone: profile.company_phone || '',
                  email: profile.company_email || '',
                  logoUrl: profile.company_logo_url || '',
                  registrationNumber: profile.company_registration_number || '',
                  taxId: profile.company_tax_id || '',
                  stampUrl: (profile as any).company_stamp_url || '',
                  signatureUrl: (profile as any).company_signature_url || '',
                  cifNif: (profile as any).company_cif_nif || '',
                  rccm: (profile as any).company_rccm || '',
                  website: (profile as any).company_website || '',
                  legalRepresentative: (profile as any).company_legal_representative || '',
                };
                // Merge, remote takes priority for non-empty fields
                setCompanyInfoState(prev => {
                  const merged: CompanyInfo = { ...prev };
                  (Object.keys(remote) as (keyof CompanyInfo)[]).forEach(k => {
                    const v = remote[k];
                    if (v !== '' && v !== null && v !== undefined) (merged as any)[k] = v;
                  });
                  try { localStorage.setItem(scopedKey, JSON.stringify(merged)); } catch {}
                  return merged;
                });
              }
            } catch (e) {
              console.warn('Could not load company info from profile:', e);
            }
          }
        })
        .catch(() => {
          const savedCompanyInfo = localStorage.getItem('app-company-info');
          if (savedCompanyInfo) {
            try {
              setCompanyInfoState({ ...defaultCompanyInfo, ...JSON.parse(savedCompanyInfo) });
            } catch {
              console.error('Error parsing company info');
            }
          }
        });
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Appliquer le thème au document
  useEffect(() => {
    if (!isInitialized) return;

    const root = document.documentElement;
    
    const applyTheme = (themeToApply: 'light' | 'dark') => {
      if (themeToApply === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      
      const handler = (e: MediaQueryListEvent | MediaQueryList) => {
        const matches = 'matches' in e ? e.matches : (e as MediaQueryList).matches;
        applyTheme(matches ? 'dark' : 'light');
      };
      
      try {
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', handler);
          return () => mediaQuery.removeEventListener('change', handler);
        } else if ((mediaQuery as any).addListener) {
          (mediaQuery as any).addListener(handler);
          return () => (mediaQuery as any).removeListener(handler);
        }
      } catch (e) {
        console.warn('Impossible d\'écouter les changements de thème système:', e);
      }
    } else {
      applyTheme(theme);
    }
  }, [theme, isInitialized]);

  const handleSetTheme = (newTheme: 'light' | 'dark' | 'auto') => {
    try {
      localStorage.setItem('app-theme', newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
    setTheme(newTheme);
  };

  const handleSetLanguage = (newLanguage: SupportedLanguage) => {
    try {
      localStorage.setItem('app-language', newLanguage);
    } catch (error) {
      console.error('Error saving language:', error);
    }
    setLanguage(newLanguage);
  };

  const handleSetCurrency = (newCurrency: 'EUR' | 'USD' | 'XOF' | 'MAD') => {
    setGlobalCurrency(newCurrency);
    setCurrency(newCurrency);
  };

  const handleSetOfflineMode = (enabled: boolean) => {
    try {
      localStorage.setItem('app-offline-mode', String(enabled));
    } catch (error) {
      console.error('Error saving offline mode:', error);
    }
    setOfflineModeState(enabled);
  };

  const handleSetShowOfflineIndicator = (show: boolean) => {
    try {
      localStorage.setItem('app-show-offline-indicator', String(show));
    } catch (error) {
      console.error('Error saving show offline indicator:', error);
    }
    setShowOfflineIndicatorState(show);
  };

  const handleSetTimezone = (tz: string) => {
    setTimezoneState(tz);
  };

  const handleSetCountry = (c: string) => {
    setCountryState(c);
  };

  const handleSetCompanyInfo = (info: Partial<CompanyInfo>) => {
    const newInfo = { ...companyInfo, ...info };
    try {
      const scopedKey = companyInfoUserId ? `app-company-info:${companyInfoUserId}` : 'app-company-info';
      localStorage.setItem(scopedKey, JSON.stringify(newInfo));
    } catch (error) {
      console.error('Error saving company info:', error);
    }
    setCompanyInfoState(newInfo);

    // Persist text fields to Supabase profile (async, non-blocking)
    if (companyInfoUserId) {
      const dbPatch: Record<string, any> = {};
      if ('name' in info) dbPatch.company_name = info.name || null;
      if ('address' in info) dbPatch.company_address = info.address || null;
      if ('phone' in info) dbPatch.company_phone = info.phone || null;
      if ('email' in info) dbPatch.company_email = info.email || null;
      if ('logoUrl' in info) dbPatch.company_logo_url = info.logoUrl || null;
      if ('registrationNumber' in info) dbPatch.company_registration_number = info.registrationNumber || null;
      if ('taxId' in info) dbPatch.company_tax_id = info.taxId || null;
      if ('stampUrl' in info) dbPatch.company_stamp_url = info.stampUrl || null;
      if ('signatureUrl' in info) dbPatch.company_signature_url = info.signatureUrl || null;
      if ('cifNif' in info) dbPatch.company_cif_nif = info.cifNif || null;
      if ('rccm' in info) dbPatch.company_rccm = info.rccm || null;
      if ('website' in info) dbPatch.company_website = info.website || null;
      if ('legalRepresentative' in info) dbPatch.company_legal_representative = info.legalRepresentative || null;
      if (Object.keys(dbPatch).length > 0) {
        supabase
          .from('profiles')
          .update(dbPatch as any)
          .eq('id', companyInfoUserId)
          .then(({ error }) => {
            if (error) console.warn('Company info profile persist failed:', error.message);
          });
      }
    }
  };

  const t = (key: string): string => {
    const value = translations[language]?.[key] || translations['fr']?.[key] || translations['en']?.[key];
    if (value) return value;
    // Clé absente : on affiche un libellé lisible (la couche de traduction runtime le traduira).
    if (/^[a-z0-9_.-]+$/i.test(key)) {
      const label = key.replace(/[_.-]+/g, ' ').trim();
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    return key;
  };

  const formatCurrency = (amount: number): string => formatMoney(amount, currency);

  // Afficher un loader pendant l'initialisation
  if (!isInitialized) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Arial, sans-serif'
      }}>
        Loading settings...
      </div>
    );
  }

  return (
    <SettingsContext.Provider
      value={{
        theme,
        language,
        currency,
        timezone,
        country,
        offlineMode,
        showOfflineIndicator,
        companyInfo,
        setTheme: handleSetTheme,
        setLanguage: handleSetLanguage,
        setCurrency: handleSetCurrency,
        setTimezone: handleSetTimezone,
        setCountry: handleSetCountry,
        setOfflineMode: handleSetOfflineMode,
        setShowOfflineIndicator: handleSetShowOfflineIndicator,
        setCompanyInfo: handleSetCompanyInfo,
        t,
        formatCurrency,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
