import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings, User, Bell, Palette, Shield, Database, Download, Upload, Save, Eye, EyeOff, 
  Smartphone, Mail, Lock, Globe, Moon, Sun, HelpCircle, Trash2, RefreshCw, 
  FileText, Zap, Volume2, VolumeX, Clock, MapPin, CreditCard, Link2, LogOut,
  AlertTriangle, Check, X, Vibrate, Languages, Monitor, Accessibility, Wifi, WifiOff,
  HardDrive, CheckCircle, Building2, Image, Loader2,
  Printer as PrinterIcon,
} from 'lucide-react';
import PeripheralsSettings from '@/components/settings/PeripheralsSettings';
import { useSettings } from '@/contexts/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import { supabase } from '@/integrations/supabase/appClient';
import BackupManagement from '@/components/BackupManagement';
import MFASettings from '@/components/auth/MFASettings';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// Types pour les paramètres
interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderOptimized: boolean;
}

interface PrivacySettings {
  shareUsageData: boolean;
  showOnlineStatus: boolean;
  allowAnalytics: boolean;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  alerts: boolean;
  sound: boolean;
  vibration: boolean;
  criticalOnly: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
}

const SettingsManagement = () => {
  const { 
    theme, language, currency, offlineMode, showOfflineIndicator, timezone, country,
    companyInfo, setCompanyInfo,
    setTheme, setLanguage, setCurrency, setOfflineMode, setShowOfflineIndicator, setTimezone, setCountry, t 
  } = useSettings();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { isTeamMember } = useTeamMemberAccess();
  const companyLocked = isTeamMember;
  
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showClearCacheDialog, setShowClearCacheDialog] = useState(false);
  const [showClearDataDialog, setShowClearDataDialog] = useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isForcingUpdate, setIsForcingUpdate] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ used: 0, quota: 0 });
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingStamp, setIsUploadingStamp] = useState(false);
  const stampInputRef = React.useRef<HTMLInputElement>(null);
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  const signatureInputRef = React.useRef<HTMLInputElement>(null);
  
  // Charger les paramètres depuis localStorage
  const [notifications, setNotifications] = useState<NotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('app-notifications');
      return saved ? JSON.parse(saved) : {
        email: true,
        push: false,
        sms: true,
        alerts: true,
        sound: true,
        vibration: true,
        criticalOnly: false,
        quietHoursEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00'
      };
    } catch {
      return {
        email: true, push: false, sms: true, alerts: true, sound: true,
        vibration: true, criticalOnly: false, quietHoursEnabled: false,
        quietHoursStart: '22:00', quietHoursEnd: '07:00'
      };
    }
  });
  
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem('app-accessibility');
      return saved ? JSON.parse(saved) : {
        reducedMotion: false,
        highContrast: false,
        largeText: false,
        screenReaderOptimized: false
      };
    } catch {
      return { reducedMotion: false, highContrast: false, largeText: false, screenReaderOptimized: false };
    }
  });
  
  const [privacy, setPrivacy] = useState<PrivacySettings>(() => {
    try {
      const saved = localStorage.getItem('app-privacy');
      return saved ? JSON.parse(saved) : {
        shareUsageData: false,
        showOnlineStatus: true,
        allowAnalytics: false
      };
    } catch {
      return { shareUsageData: false, showOnlineStatus: true, allowAnalytics: false };
    }
  });
  
  const [userProfile, setUserProfile] = useState({
    nom: '',
    email: '',
    telephone: '',
    entreprise: '',
    adresse: '',
    bio: ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Sauvegarder les notifications dans localStorage
  useEffect(() => {
    localStorage.setItem('app-notifications', JSON.stringify(notifications));
  }, [notifications]);

  // Sauvegarder et appliquer les paramètres d'accessibilité
  useEffect(() => {
    localStorage.setItem('app-accessibility', JSON.stringify(accessibility));
    
    // Appliquer les classes CSS
    const html = document.documentElement;
    
    if (accessibility.reducedMotion) {
      html.classList.add('reduce-motion');
    } else {
      html.classList.remove('reduce-motion');
    }
    
    if (accessibility.highContrast) {
      html.classList.add('high-contrast');
    } else {
      html.classList.remove('high-contrast');
    }
    
    if (accessibility.largeText) {
      html.classList.add('large-text');
    } else {
      html.classList.remove('large-text');
    }
    
    if (accessibility.screenReaderOptimized) {
      html.setAttribute('aria-live', 'polite');
    } else {
      html.removeAttribute('aria-live');
    }
  }, [accessibility]);

  // Sauvegarder les paramètres de confidentialité
  useEffect(() => {
    localStorage.setItem('app-privacy', JSON.stringify(privacy));
  }, [privacy]);

  // Calculer l'utilisation du stockage
  useEffect(() => {
    const calculateStorage = async () => {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        try {
          const estimate = await navigator.storage.estimate();
          setStorageInfo({
            used: estimate.usage || 0,
            quota: estimate.quota || 0
          });
        } catch (e) {
          console.log('Storage API not available');
        }
      }
    };
    calculateStorage();
  }, []);

  // Charger les données du vrai utilisateur connecté
  useEffect(() => {
    if (user) {
      setUserProfile({
        nom: user.name || '',
        email: user.email || '',
        telephone: '',
        entreprise: user.entreprise || '',
        adresse: '',
        bio: ''
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: userProfile.nom,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      
      toast({
        title: language === 'fr' ? 'Profil mis à jour' : 'Profile updated',
        description: language === 'fr' ? 'Vos informations ont été sauvegardées' : 'Your information has been saved'
      });
    } catch (error) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible de sauvegarder le profil' : 'Could not save profile',
        variant: 'destructive'
      });
    }
  };

  // Upload du logo entreprise
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Veuillez sélectionner une image' : 'Please select an image file',
        variant: 'destructive'
      });
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: language === 'fr' ? 'Fichier trop volumineux' : 'File too large',
        description: language === 'fr' ? 'La taille maximale est de 2 Mo' : 'Maximum size is 2 MB',
        variant: 'destructive'
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      // Supprimer l'ancien logo s'il existe
      if (companyInfo.logoUrl) {
        const oldPath = companyInfo.logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('company-logos').remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload du nouveau logo
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath);

      // Mettre à jour le contexte
      setCompanyInfo({ logoUrl: publicUrl });

      // Sauvegarder dans le profil utilisateur
      await supabase
        .from('profiles')
        .update({ company_logo_url: publicUrl })
        .eq('id', user.id);

      toast({
        title: language === 'fr' ? 'Logo téléchargé' : 'Logo uploaded',
        description: language === 'fr' ? 'Votre logo a été mis à jour' : 'Your logo has been updated'
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible de télécharger le logo' : 'Could not upload logo',
        variant: 'destructive'
      });
    } finally {
      setIsUploadingLogo(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  // Supprimer le logo
  const handleRemoveLogo = async () => {
    if (!user || !companyInfo.logoUrl) return;

    setIsUploadingLogo(true);
    try {
      // Extraire le path du logo
      const urlParts = companyInfo.logoUrl.split('/company-logos/');
      if (urlParts.length > 1) {
        await supabase.storage.from('company-logos').remove([urlParts[1]]);
      }

      // Mettre à jour le contexte
      setCompanyInfo({ logoUrl: '' });

      // Sauvegarder dans le profil utilisateur
      await supabase
        .from('profiles')
        .update({ company_logo_url: null })
        .eq('id', user.id);

      toast({
        title: language === 'fr' ? 'Logo supprimé' : 'Logo removed',
        description: language === 'fr' ? 'Votre logo a été supprimé' : 'Your logo has been removed'
      });
    } catch (error) {
      console.error('Error removing logo:', error);
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible de supprimer le logo' : 'Could not remove logo',
        variant: 'destructive'
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Upload générique d'une image entreprise (cachet / signature)
  const handleCompanyAssetUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'stamp' | 'signature',
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: language === 'fr' ? 'Erreur' : 'Error', description: language === 'fr' ? 'Veuillez sélectionner une image' : 'Please select an image', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: language === 'fr' ? 'Fichier trop volumineux' : 'File too large', description: language === 'fr' ? 'Max 2 Mo' : 'Max 2 MB', variant: 'destructive' });
      return;
    }
    const setLoading = kind === 'stamp' ? setIsUploadingStamp : setIsUploadingSignature;
    const inputRef = kind === 'stamp' ? stampInputRef : signatureInputRef;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${kind}-${Date.now()}.${ext}`;
      // Bucket privé : seul le propriétaire (path = userId) peut lire/écrire ses cachets et signatures.
      const filePath = `${user.id}/${kind}s/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from('company-documents')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      // URL signée longue durée (1 an) pour affichage dans les documents.
      const { data: signed, error: signErr } = await supabase.storage
        .from('company-documents')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);
      if (signErr || !signed) throw signErr || new Error('Signed URL error');
      setCompanyInfo(kind === 'stamp' ? { stampUrl: signed.signedUrl } : { signatureUrl: signed.signedUrl });
      toast({ title: language === 'fr' ? 'Image téléchargée' : 'Image uploaded' });
    } catch (e) {
      console.error(e);
      toast({ title: language === 'fr' ? 'Erreur' : 'Error', description: language === 'fr' ? 'Échec du téléchargement' : 'Upload failed', variant: 'destructive' });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemoveCompanyAsset = async (kind: 'stamp' | 'signature') => {
    const url = kind === 'stamp' ? companyInfo.stampUrl : companyInfo.signatureUrl;
    if (!url) return;
    try {
      // Support legacy public URL + nouveau bucket privé.
      const parts = url.split('/company-documents/');
      if (parts.length > 1) {
        // path peut contenir des query params (signed URL) — on coupe au premier ?
        const path = parts[1].split('?')[0];
        await supabase.storage.from('company-documents').remove([path]);
      } else {
        const legacy = url.split('/company-logos/');
        if (legacy.length > 1) {
          const path = legacy[1].split('?')[0];
          await supabase.storage.from('company-logos').remove([path]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setCompanyInfo(kind === 'stamp' ? { stampUrl: '' } : { signatureUrl: '' });
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Le mot de passe doit contenir au moins 6 caractères' : 'Password must be at least 6 characters',
        variant: 'destructive'
      });
      return;
    }
    
    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      toast({
        title: language === 'fr' ? 'Mot de passe modifié' : 'Password changed',
        description: language === 'fr' ? 'Votre mot de passe a été mis à jour' : 'Your password has been updated'
      });
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      // Vider le cache du service worker
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Vider le sessionStorage
      sessionStorage.clear();
      
      toast({
        title: language === 'fr' ? 'Cache vidé' : 'Cache cleared',
        description: language === 'fr' ? 'Le cache de l\'application a été vidé' : 'Application cache has been cleared'
      });
      
      // Rafraîchir les infos de stockage
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageInfo({
          used: estimate.usage || 0,
          quota: estimate.quota || 0
        });
      }
    } catch (error) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible de vider le cache' : 'Could not clear cache',
        variant: 'destructive'
      });
    } finally {
      setIsClearingCache(false);
      setShowClearCacheDialog(false);
    }
  };

  const handleForceUpdate = async () => {
    setIsForcingUpdate(true);
    try {
      // 1) Demande au Service Worker de vider les caches
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_CACHE' });

        // 2) Forcer la recherche d'une nouvelle version du SW
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.update().catch(() => undefined)));

        // 3) Si une nouvelle version est en attente, l'activer immédiatement
        regs.forEach((r) => r.waiting?.postMessage({ type: 'SKIP_WAITING' }));

        // 4) Attendre un éventuel controllerchange (max 2s), puis recharger
        await new Promise<void>((resolve) => {
          let done = false;
          const timeout = setTimeout(() => {
            if (done) return;
            done = true;
            resolve();
          }, 2000);

          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              if (done) return;
              done = true;
              clearTimeout(timeout);
              resolve();
            },
            { once: true }
          );
        });
      }

      toast({
        title: language === 'fr' ? 'Mise à jour forcée' : 'Update forced',
        description: language === 'fr'
          ? 'L\'application va se recharger avec la dernière version.'
          : 'The app will reload with the latest version.'
      });
    } catch (error) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr'
          ? 'Impossible de forcer la mise à jour. Essayez de rafraîchir la page.'
          : 'Could not force update. Try refreshing the page.',
        variant: 'destructive'
      });
    } finally {
      setIsForcingUpdate(false);
      window.location.reload();
    }
  };

  const handleClearLocalData = async () => {
    setIsClearingCache(true);
    try {
      // Sauvegarder les paramètres essentiels
      const savedTheme = localStorage.getItem('app-theme');
      const savedLanguage = localStorage.getItem('app-language');
      const savedCurrency = localStorage.getItem('app-currency');
      
      // Vider localStorage
      localStorage.clear();
      
      // Restaurer les paramètres essentiels
      if (savedTheme) localStorage.setItem('app-theme', savedTheme);
      if (savedLanguage) localStorage.setItem('app-language', savedLanguage);
      if (savedCurrency) localStorage.setItem('app-currency', savedCurrency);
      
      // Vider IndexedDB
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases?.() || [];
        for (const db of databases) {
          if (db.name && !db.name.includes('supabase')) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }
      
      toast({
        title: language === 'fr' ? 'Données locales effacées' : 'Local data cleared',
        description: language === 'fr' ? 'Les données locales ont été supprimées (paramètres conservés)' : 'Local data has been deleted (settings preserved)'
      });
      
      // Rafraîchir les infos de stockage
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        setStorageInfo({
          used: estimate.usage || 0,
          quota: estimate.quota || 0
        });
      }
    } catch (error) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible d\'effacer les données' : 'Could not clear data',
        variant: 'destructive'
      });
    } finally {
      setIsClearingCache(false);
      setShowClearDataDialog(false);
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    
    toast({
      title: language === 'fr' ? 'Export en cours' : 'Export in progress',
      description: language === 'fr' ? 'Vos données sont en cours de préparation...' : 'Your data is being prepared...'
    });

    try {
      const tables = [
        'production_units', 'unit_infrastructures', 'unit_equipment',
        'purchases', 'accounting_transactions', 'feed_stocks',
        'livestock_batches', 'production_cycles', 'health_records',
        'feeding_records', 'feeding_plans'
      ];

      const exportData: Record<string, any> = {
        exportDate: new Date().toISOString(),
        userId: user.id,
        email: user.email,
      };

      for (const table of tables) {
        const { data } = await supabase.from(table as any).select('*');
        exportData[table] = data || [];
      }

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `aquapilot-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: language === 'fr' ? 'Export réussi' : 'Export successful',
        description: language === 'fr' ? 'Vos données ont été téléchargées' : 'Your data has been downloaded'
      });
    } catch (error) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' ? 'Impossible d\'exporter les données' : 'Could not export data',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountDialog(true);
  };

  const confirmDeleteAccount = async () => {
    toast({
      title: language === 'fr' ? 'Suppression de compte' : 'Account deletion',
      description: language === 'fr' ? 'Contactez le support pour supprimer votre compte: support@aquapilot.app' : 'Contact support to delete your account: support@aquapilot.app',
      variant: 'destructive'
    });
    setShowDeleteAccountDialog(false);
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const timezones = [
    { value: 'Africa/Lome', label: 'Africa/Lomé (UTC+0)' },
    { value: 'Africa/Abidjan', label: 'Africa/Abidjan (UTC+0)' },
    { value: 'Africa/Dakar', label: 'Africa/Dakar (UTC+0)' },
    { value: 'Africa/Lagos', label: 'Africa/Lagos (UTC+1)' },
    { value: 'Africa/Casablanca', label: 'Africa/Casablanca (UTC+1)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
    { value: 'UTC', label: 'UTC (UTC+0)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5)' }
  ];

  const countries = [
    { value: 'TG', label: '🇹🇬 Togo' },
    { value: 'CI', label: '🇨🇮 Côte d\'Ivoire' },
    { value: 'SN', label: '🇸🇳 Sénégal' },
    { value: 'BJ', label: '🇧🇯 Bénin' },
    { value: 'GH', label: '🇬🇭 Ghana' },
    { value: 'NG', label: '🇳🇬 Nigeria' },
    { value: 'CM', label: '🇨🇲 Cameroun' },
    { value: 'MA', label: '🇲🇦 Maroc' },
    { value: 'FR', label: '🇫🇷 France' },
    { value: 'US', label: '🇺🇸 États-Unis' }
  ];

  return (
    <div className="space-y-4 sm:space-y-6 w-full">
      {/* En-tête */}
      <div className="border rounded-xl bg-card p-4 sm:p-6">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold truncate">{t('settings')}</h2>
            <p className="text-muted-foreground text-xs sm:text-sm md:text-base">
              {language === 'fr' ? 'Configuration et préférences du système' : 'System configuration and preferences'}
            </p>
          </div>
          <Settings className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-muted-foreground shrink-0" />
        </div>
      </div>

      {/* Tabs responsives */}
      <Tabs defaultValue="profile" className="space-y-4 w-full">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <TabsList className="inline-flex min-w-max h-auto flex-wrap gap-1 bg-muted p-1.5 rounded-lg md:grid md:grid-cols-5 lg:grid-cols-9 md:min-w-full">
            <TabsTrigger value="profile" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <User className="w-4 h-4 mr-1" />
              Profil
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Bell className="w-4 h-4 mr-1" />
              Notifs
            </TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Palette className="w-4 h-4 mr-1" />
              Thème
            </TabsTrigger>
            <TabsTrigger value="security" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Shield className="w-4 h-4 mr-1" />
              Sécu
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Accessibility className="w-4 h-4 mr-1" />
              A11y
            </TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Lock className="w-4 h-4 mr-1" />
              Privé
            </TabsTrigger>
            <TabsTrigger value="system" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Database className="w-4 h-4 mr-1" />
              Système
            </TabsTrigger>
            <TabsTrigger value="backup" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Download className="w-4 h-4 mr-1" />
              Backup
            </TabsTrigger>
            <TabsTrigger value="company" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <Building2 className="w-4 h-4 mr-1" />
              Entreprise
            </TabsTrigger>
            <TabsTrigger value="devices" className="text-xs px-2.5 py-2 data-[state=active]:bg-background whitespace-nowrap">
              <PrinterIcon className="w-4 h-4 mr-1" />
              Périphériques
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="devices"><PeripheralsSettings /></TabsContent>

        {/* Onglet Entreprise */}
        <TabsContent value="company" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Building2 className="w-5 h-5 text-aqua-600" />
                {t('company_info')}
              </CardTitle>
              <CardDescription className="text-sm">
                {t('company_info_desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              {/* Section Logo */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{language === 'fr' ? "Logo de l'entreprise" : 'Company logo'}</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                    {companyInfo.logoUrl ? (
                      <img
                        src={companyInfo.logoUrl}
                        alt={language === 'fr' ? "Logo de l'entreprise" : 'Company logo'}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <Image className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="space-y-2 w-full">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={isUploadingLogo || companyLocked}
                        className="w-full sm:w-auto"
                      >
                        {isUploadingLogo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {language === 'fr' ? 'Envoi...' : 'Uploading...'}
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            {language === 'fr' ? 'Télécharger un logo' : 'Upload logo'}
                          </>
                        )}
                      </Button>
                      {companyInfo.logoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRemoveLogo}
                          disabled={isUploadingLogo || companyLocked}
                          className="w-full sm:w-auto text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {language === 'fr' ? 'Supprimer' : 'Remove'}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'fr' ? 'Format: JPG, PNG, WebP. Max 2 Mo' : 'Format: JPG, PNG, WebP. Max 2 MB'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section Cachet (tampon) */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{language === 'fr' ? "Cachet de l'entreprise" : 'Company stamp'}</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                    {companyInfo.stampUrl ? (
                      <img src={companyInfo.stampUrl} alt="Cachet" className="w-full h-full object-contain p-2" loading="lazy" />
                    ) : (
                      <Image className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="space-y-2 w-full">
                    <input ref={stampInputRef} type="file" accept="image/*" onChange={(e) => handleCompanyAssetUpload(e, 'stamp')} className="hidden" />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" size="sm" onClick={() => stampInputRef.current?.click()} disabled={isUploadingStamp || companyLocked} className="w-full sm:w-auto">
                        {isUploadingStamp ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'fr' ? 'Envoi...' : 'Uploading...'}</>) : (<><Upload className="w-4 h-4 mr-2" />{language === 'fr' ? 'Téléverser le cachet' : 'Upload stamp'}</>)}
                      </Button>
                      {companyInfo.stampUrl && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveCompanyAsset('stamp')} disabled={companyLocked} className="w-full sm:w-auto text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />{language === 'fr' ? 'Supprimer' : 'Remove'}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'fr' ? 'PNG transparent recommandé. Apparaît sur factures et reçus. Max 2 Mo.' : 'Transparent PNG recommended. Shown on invoices and receipts. Max 2 MB.'}
                    </p>
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        id="hide-stamp-toggle"
                        type="checkbox"
                        className="h-4 w-4 rounded border-input"
                        checked={!!companyInfo.hideStampOnDocuments}
                        onChange={(e) => setCompanyInfo({ hideStampOnDocuments: e.target.checked })}
                      />
                      <Label htmlFor="hide-stamp-toggle" className="text-xs font-normal text-muted-foreground cursor-pointer">
                        {language === 'fr'
                          ? "Masquer le cachet sur les reçus et factures"
                          : 'Hide stamp on receipts and invoices'}
                      </Label>
                    </div>
                    {companyLocked && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Géré par l'administrateur de l'entreprise.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Section Signature */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">{language === 'fr' ? 'Signature manuscrite' : 'Handwritten signature'}</Label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="w-24 h-24 border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center bg-muted/50 overflow-hidden shrink-0">
                    {companyInfo.signatureUrl ? (
                      <img src={companyInfo.signatureUrl} alt="Signature" className="w-full h-full object-contain p-2" loading="lazy" />
                    ) : (
                      <Image className="w-8 h-8 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="space-y-2 w-full">
                    <input ref={signatureInputRef} type="file" accept="image/*" onChange={(e) => handleCompanyAssetUpload(e, 'signature')} className="hidden" />
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button variant="outline" size="sm" onClick={() => signatureInputRef.current?.click()} disabled={isUploadingSignature || companyLocked} className="w-full sm:w-auto">
                        {isUploadingSignature ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{language === 'fr' ? 'Envoi...' : 'Uploading...'}</>) : (<><Upload className="w-4 h-4 mr-2" />{language === 'fr' ? 'Téléverser la signature' : 'Upload signature'}</>)}
                      </Button>
                      {companyInfo.signatureUrl && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveCompanyAsset('signature')} disabled={companyLocked} className="w-full sm:w-auto text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />{language === 'fr' ? 'Supprimer' : 'Remove'}
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {language === 'fr' ? 'Image PNG/JPG. Sera ajoutée sur factures et reçus. Max 2 Mo.' : 'PNG/JPG image. Added to invoices and receipts. Max 2 MB.'}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">{t('company_info_name')}</Label>
                  <Input 
                    value={companyInfo.name}
                    onChange={e => setCompanyInfo({ name: e.target.value })}
                    placeholder={language === 'fr' ? "Nom de votre entreprise" : "Your company name"}
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm">{t('company_info_email')}</Label>
                  <Input 
                    type="email"
                    value={companyInfo.email}
                    onChange={e => setCompanyInfo({ email: e.target.value })}
                    placeholder="contact@entreprise.com"
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm">{t('company_info_phone')}</Label>
                  <Input 
                    value={companyInfo.phone}
                    onChange={e => setCompanyInfo({ phone: e.target.value })}
                    placeholder="+228 XX XX XX XX"
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm">{t('company_info_registration')}</Label>
                  <Input 
                    value={companyInfo.registrationNumber}
                    onChange={e => setCompanyInfo({ registrationNumber: e.target.value })}
                    placeholder="RCCM / Numéro"
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">{t('company_info_address')}</Label>
                <Textarea 
                  value={companyInfo.address}
                  onChange={e => setCompanyInfo({ address: e.target.value })}
                  placeholder={language === 'fr' ? "Adresse complète de l'entreprise" : "Complete company address"}
                  rows={2}
                  className="mt-1.5"
                  disabled={companyLocked}
                />
              </div>
              <div>
                <Label className="text-sm">{t('company_info_tax')}</Label>
                <Input 
                  value={companyInfo.taxId}
                  onChange={e => setCompanyInfo({ taxId: e.target.value })}
                  placeholder={language === 'fr' ? "Numéro fiscal / NIF" : "Tax ID / VAT number"}
                  className="mt-1.5"
                  disabled={companyLocked}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">CIF / NIF</Label>
                  <Input
                    value={companyInfo.cifNif}
                    onChange={e => setCompanyInfo({ cifNif: e.target.value })}
                    placeholder="CIF / NIF"
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm">RCCM</Label>
                  <Input
                    value={companyInfo.rccm}
                    onChange={e => setCompanyInfo({ rccm: e.target.value })}
                    placeholder="Registre du commerce"
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm">{language === 'fr' ? 'Site web' : 'Website'}</Label>
                  <Input
                    value={companyInfo.website}
                    onChange={e => setCompanyInfo({ website: e.target.value })}
                    placeholder="https://..."
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
                <div>
                  <Label className="text-sm">{language === 'fr' ? 'Responsable légal' : 'Legal representative'}</Label>
                  <Input
                    value={companyInfo.legalRepresentative}
                    onChange={e => setCompanyInfo({ legalRepresentative: e.target.value })}
                    placeholder={language === 'fr' ? 'Nom du responsable légal' : 'Legal representative name'}
                    className="mt-1.5"
                    disabled={companyLocked}
                  />
                </div>
              </div>
              {companyLocked && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
                  Les informations de l'entreprise sont définies par l'administrateur principal. Vous pouvez modifier votre nom et votre mot de passe dans la section <strong>Profil</strong>.
                </div>
              )}
              <div className="pt-3">
                <Badge variant="outline" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {language === 'fr' ? 'Ces informations apparaîtront sur vos documents imprimés' : 'This info will appear on printed documents'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profil utilisateur */}
        <TabsContent value="profile" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="w-5 h-5 text-aqua-600" />
                {t('personal_info')}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'fr' ? 'Gérez vos informations personnelles' : 'Manage your personal information'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="w-full">
                  <Label htmlFor="nom" className="text-sm">{t('full_name')}</Label>
                  <Input 
                    id="nom" 
                    value={userProfile.nom} 
                    onChange={e => setUserProfile({...userProfile, nom: e.target.value})}
                    className="mt-1.5"
                  />
                </div>
                <div className="w-full">
                  <Label htmlFor="email" className="text-sm">{t('email')}</Label>
                  <Input 
                    id="email" 
                    type="email"
                    className="mt-1.5 bg-muted"
                    value={userProfile.email}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'fr' ? 'L\'email ne peut pas être modifié' : 'Email cannot be changed'}
                  </p>
                </div>
                <div>
                  <Label htmlFor="telephone" className="text-sm">{t('phone')}</Label>
                  <Input 
                    id="telephone" 
                    value={userProfile.telephone} 
                    onChange={e => setUserProfile({...userProfile, telephone: e.target.value})}
                    placeholder="+228 XX XX XX XX"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="entreprise" className="text-sm">{t('company')}</Label>
                  <Input 
                    id="entreprise" 
                    value={userProfile.entreprise} 
                    onChange={e => setUserProfile({...userProfile, entreprise: e.target.value})}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="adresse" className="text-sm">{t('address')}</Label>
                <Input 
                  id="adresse" 
                  value={userProfile.adresse} 
                  onChange={e => setUserProfile({...userProfile, adresse: e.target.value})}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="bio" className="text-sm">{language === 'fr' ? 'Biographie' : 'Biography'}</Label>
                <Textarea 
                  id="bio" 
                  value={userProfile.bio} 
                  onChange={e => setUserProfile({...userProfile, bio: e.target.value})}
                  placeholder={language === 'fr' ? 'Parlez-nous de vous...' : 'Tell us about yourself...'}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button onClick={handleSaveProfile} className="flex-1 sm:flex-none">
                  <Save className="w-4 h-4 mr-2" />
                  {t('save_changes')}
                </Button>
                <Button variant="destructive" onClick={handleLogout} className="flex-1 sm:flex-none">
                  <LogOut className="w-4 h-4 mr-2" />
                  {language === 'fr' ? 'Déconnexion' : 'Logout'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Bell className="w-5 h-5 text-aqua-600" />
                {t('notification_preferences')}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'fr' ? 'Configurez comment vous souhaitez être notifié' : 'Configure how you want to be notified'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{t('email_notifications')}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('receive_email_alerts')}</p>
                  </div>
                  <Switch 
                    checked={notifications.email} 
                    onCheckedChange={checked => setNotifications({...notifications, email: checked})} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{t('push_notifications')}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('device_notifications')}</p>
                  </div>
                  <Switch 
                    checked={notifications.push} 
                    onCheckedChange={checked => setNotifications({...notifications, push: checked})} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{t('sms_emergency')}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{t('sms_critical_alerts')}</p>
                  </div>
                  <Switch 
                    checked={notifications.sms} 
                    onCheckedChange={checked => setNotifications({...notifications, sms: checked})} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <Label className="text-sm font-medium">{language === 'fr' ? 'Son des notifications' : 'Notification sound'}</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Jouer un son pour les alertes' : 'Play sound for alerts'}</p>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.sound} 
                    onCheckedChange={checked => setNotifications({...notifications, sound: checked})} 
                  />
                </div>
                
                <Separator />
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Vibrate className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <Label className="text-sm font-medium">{language === 'fr' ? 'Vibration' : 'Vibration'}</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Vibrer pour les notifications' : 'Vibrate for notifications'}</p>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.vibration} 
                    onCheckedChange={checked => setNotifications({...notifications, vibration: checked})} 
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <Label className="text-sm font-medium">{language === 'fr' ? 'Alertes critiques uniquement' : 'Critical alerts only'}</Label>
                      <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Ne recevoir que les alertes urgentes' : 'Only receive urgent alerts'}</p>
                    </div>
                  </div>
                  <Switch 
                    checked={notifications.criticalOnly} 
                    onCheckedChange={checked => setNotifications({...notifications, criticalOnly: checked})} 
                  />
                </div>

                <Separator />

                <div className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Moon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div>
                        <Label className="text-sm font-medium">{language === 'fr' ? 'Heures calmes' : 'Quiet hours'}</Label>
                        <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Pas de notifications pendant ces heures' : 'No notifications during these hours'}</p>
                      </div>
                    </div>
                    <Switch 
                      checked={notifications.quietHoursEnabled} 
                      onCheckedChange={checked => setNotifications({...notifications, quietHoursEnabled: checked})} 
                    />
                  </div>
                  {notifications.quietHoursEnabled && (
                    <div className="flex flex-col sm:flex-row gap-3 mt-3">
                      <div className="flex-1">
                        <Label className="text-xs">{language === 'fr' ? 'Début' : 'Start'}</Label>
                        <Input 
                          type="time" 
                          value={notifications.quietHoursStart}
                          onChange={e => setNotifications({...notifications, quietHoursStart: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex-1">
                        <Label className="text-xs">{language === 'fr' ? 'Fin' : 'End'}</Label>
                        <Input 
                          type="time" 
                          value={notifications.quietHoursEnd}
                          onChange={e => setNotifications({...notifications, quietHoursEnd: e.target.value})}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3">
                <Badge variant="outline" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {language === 'fr' ? 'Paramètres sauvegardés automatiquement' : 'Settings saved automatically'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Apparence */}
        <TabsContent value="appearance" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Palette className="w-5 h-5 text-aqua-600" />
                {t('theme_appearance')}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'fr' ? 'Personnalisez l\'apparence de l\'application' : 'Customize the app appearance'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div>
                <Label className="text-sm font-medium mb-3 block">{t('display_mode')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button 
                    className={`p-4 border-2 rounded-lg transition-all ${
                      theme === 'light' ? 'border-aqua-500 bg-aqua-50 shadow-md' : 'border-border hover:border-aqua-300'
                    }`}
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-aqua-600" />
                    <span className="text-sm font-medium block">{t('light')}</span>
                    <span className="text-xs text-muted-foreground">{language === 'fr' ? 'Mode clair' : 'Light mode'}</span>
                  </button>
                  <button 
                    className={`p-4 border-2 rounded-lg transition-all ${
                      theme === 'dark' ? 'border-aqua-500 bg-aqua-50 shadow-md' : 'border-border hover:border-aqua-300'
                    }`}
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-600" />
                    <span className="text-sm font-medium block">{t('dark')}</span>
                    <span className="text-xs text-muted-foreground">{language === 'fr' ? 'Mode sombre' : 'Dark mode'}</span>
                  </button>
                  <button 
                    className={`p-4 border-2 rounded-lg transition-all ${
                      theme === 'auto' ? 'border-aqua-500 bg-aqua-50 shadow-md' : 'border-border hover:border-aqua-300'
                    }`}
                    onClick={() => setTheme('auto')}
                  >
                    <Monitor className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-gray-600" />
                    <span className="text-sm font-medium block">{t('auto')}</span>
                    <span className="text-xs text-muted-foreground">{language === 'fr' ? 'Selon le système' : 'System default'}</span>
                  </button>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Languages className="w-4 h-4" />
                  {t('language')}
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  {t('currency')}
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XOF">F CFA (XOF)</SelectItem>
                    <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                    <SelectItem value="USD">$ Dollar US (USD)</SelectItem>
                    <SelectItem value="MAD">Dirham (MAD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {language === 'fr' ? 'Pays' : 'Country'}
                </Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {language === 'fr' ? 'Fuseau horaire' : 'Timezone'}
                </Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timezones.map(tz => (
                      <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sécurité */}
        <TabsContent value="security" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Shield className="w-5 h-5 text-aqua-600" />
                {language === 'fr' ? 'Sécurité du compte' : 'Account security'}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'fr' ? 'Gérez la sécurité de votre compte' : 'Manage your account security'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Changer le mot de passe' : 'Change password'}</h4>
                
                <div>
                  <Label htmlFor="current-password" className="text-sm">{language === 'fr' ? 'Mot de passe actuel' : 'Current password'}</Label>
                  <div className="relative mt-1.5">
                    <Input 
                      id="current-password" 
                      type={showPassword ? "text" : "password"} 
                      placeholder={language === 'fr' ? 'Entrez votre mot de passe actuel' : 'Enter your current password'}
                      value={passwordData.currentPassword}
                      onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-0 top-0 h-full px-3" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="new-password" className="text-sm">{language === 'fr' ? 'Nouveau mot de passe' : 'New password'}</Label>
                  <div className="relative mt-1.5">
                    <Input 
                      id="new-password" 
                      type={showNewPassword ? "text" : "password"} 
                      placeholder={language === 'fr' ? 'Entrez un nouveau mot de passe' : 'Enter a new password'}
                      value={passwordData.newPassword}
                      onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                    />
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-0 top-0 h-full px-3" 
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === 'fr' ? 'Minimum 6 caractères' : 'Minimum 6 characters'}
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="confirm-password" className="text-sm">{language === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'}</Label>
                  <Input 
                    id="confirm-password" 
                    type="password" 
                    placeholder={language === 'fr' ? 'Confirmez le nouveau mot de passe' : 'Confirm the new password'}
                    value={passwordData.confirmPassword}
                    onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="mt-1.5"
                  />
                </div>
                
                <Button onClick={handleChangePassword} disabled={passwordLoading} className="w-full sm:w-auto">
                  <Lock className="w-4 h-4 mr-2" />
                  {passwordLoading 
                    ? (language === 'fr' ? 'Modification...' : 'Changing...') 
                    : (language === 'fr' ? 'Changer le mot de passe' : 'Change password')}
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Sessions actives' : 'Active sessions'}</h4>
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-green-800 text-sm">{language === 'fr' ? 'Session actuelle' : 'Current session'}</p>
                    <p className="text-xs sm:text-sm text-green-600">{language === 'fr' ? 'Ce navigateur' : 'This browser'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentification à deux facteurs (2FA) */}
          <MFASettings />
        </TabsContent>

        {/* Accessibilité */}
        <TabsContent value="accessibility" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Accessibility className="w-5 h-5 text-aqua-600" />
                {language === 'fr' ? 'Options d\'accessibilité' : 'Accessibility options'}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'fr' ? 'Adaptez l\'application à vos besoins' : 'Adapt the app to your needs'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Réduire les animations' : 'Reduce motion'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Désactiver les animations et transitions' : 'Disable animations and transitions'}</p>
                  </div>
                  <Switch 
                    checked={accessibility.reducedMotion} 
                    onCheckedChange={checked => setAccessibility({...accessibility, reducedMotion: checked})} 
                  />
                </div>
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Contraste élevé' : 'High contrast'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Augmenter le contraste des couleurs' : 'Increase color contrast'}</p>
                  </div>
                  <Switch 
                    checked={accessibility.highContrast} 
                    onCheckedChange={checked => setAccessibility({...accessibility, highContrast: checked})} 
                  />
                </div>
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Texte agrandi' : 'Large text'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Augmenter la taille du texte' : 'Increase text size'}</p>
                  </div>
                  <Switch 
                    checked={accessibility.largeText} 
                    onCheckedChange={checked => setAccessibility({...accessibility, largeText: checked})} 
                  />
                </div>
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Optimisé lecteur d\'écran' : 'Screen reader optimized'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Améliorer la compatibilité avec les lecteurs d\'écran' : 'Improve screen reader compatibility'}</p>
                  </div>
                  <Switch 
                    checked={accessibility.screenReaderOptimized} 
                    onCheckedChange={checked => setAccessibility({...accessibility, screenReaderOptimized: checked})} 
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>💡 {language === 'fr' ? 'Astuce' : 'Tip'}:</strong> {language === 'fr' 
                    ? 'Les paramètres d\'accessibilité sont appliqués immédiatement et sauvegardés automatiquement.'
                    : 'Accessibility settings are applied immediately and saved automatically.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Confidentialité */}
        <TabsContent value="privacy" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Lock className="w-5 h-5 text-aqua-600" />
                {language === 'fr' ? 'Confidentialité des données' : 'Data privacy'}
              </CardTitle>
              <CardDescription className="text-sm">
                {language === 'fr' ? 'Contrôlez comment vos données sont utilisées' : 'Control how your data is used'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Partager les données d\'utilisation' : 'Share usage data'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Nous aider à améliorer l\'application' : 'Help us improve the app'}</p>
                  </div>
                  <Switch 
                    checked={privacy.shareUsageData} 
                    onCheckedChange={checked => setPrivacy({...privacy, shareUsageData: checked})} 
                  />
                </div>
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Afficher mon statut en ligne' : 'Show online status'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Les autres peuvent voir quand vous êtes connecté' : 'Others can see when you are online'}</p>
                  </div>
                  <Switch 
                    checked={privacy.showOnlineStatus} 
                    onCheckedChange={checked => setPrivacy({...privacy, showOnlineStatus: checked})} 
                  />
                </div>
                
                <div className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Autoriser les analytics' : 'Allow analytics'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Collecter des statistiques anonymes' : 'Collect anonymous statistics'}</p>
                  </div>
                  <Switch 
                    checked={privacy.allowAnalytics} 
                    onCheckedChange={checked => setPrivacy({...privacy, allowAnalytics: checked})} 
                  />
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium text-destructive flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  {language === 'fr' ? 'Zone dangereuse' : 'Danger zone'}
                </h4>
                <div className="p-4 border border-muted rounded-lg space-y-3">
                  <div>
                    <p className="font-medium text-sm">{language === 'fr' ? 'Exporter mes données' : 'Export my data'}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Télécharger toutes vos données au format JSON' : 'Download all your data in JSON format'}</p>
                  </div>
                  <Button variant="outline" onClick={handleExportData} className="w-full sm:w-auto">
                    <Download className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Exporter' : 'Export'}
                  </Button>
                </div>
                <div className="p-4 border border-destructive rounded-lg space-y-3 bg-destructive/5">
                  <div>
                    <p className="font-medium text-destructive text-sm">{language === 'fr' ? 'Supprimer mon compte' : 'Delete my account'}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{language === 'fr' ? 'Cette action est irréversible' : 'This action is irreversible'}</p>
                  </div>
                  <Button variant="destructive" onClick={handleDeleteAccount} className="w-full sm:w-auto">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Supprimer le compte' : 'Delete account'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Système */}
        <TabsContent value="system" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Database className="w-5 h-5 text-aqua-600" />
                {language === 'fr' ? 'Configuration système' : 'System configuration'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm">
                  <WifiOff className="w-4 h-4" />
                  {language === 'fr' ? 'Mode hors ligne et stockage local' : 'Offline mode and local storage'}
                </h4>
                
                <div className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Mode hors ligne' : 'Offline mode'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {language === 'fr' ? 'Permet à l\'application de fonctionner sans connexion internet' : 'Allows the app to work without internet'}
                    </p>
                  </div>
                  <Switch 
                    checked={offlineMode} 
                    onCheckedChange={setOfflineMode}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 p-4 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium">{language === 'fr' ? 'Afficher l\'indicateur de synchronisation' : 'Show sync indicator'}</Label>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {language === 'fr' ? 'Affiche le nombre d\'actions en attente de synchronisation' : 'Shows pending sync actions count'}
                    </p>
                  </div>
                  <Switch 
                    checked={showOfflineIndicator} 
                    onCheckedChange={setShowOfflineIndicator}
                  />
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong>💡 {language === 'fr' ? 'Astuce' : 'Tip'}:</strong> {language === 'fr' 
                      ? 'L\'application fonctionne automatiquement hors ligne. Vos données sont sauvegardées localement et synchronisées automatiquement dès que la connexion est rétablie.'
                      : 'The app works automatically offline. Your data is saved locally and synced automatically when connection is restored.'}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Informations système' : 'System information'}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">Version:</span>
                    <span className="font-medium">v2.1.3</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">{language === 'fr' ? 'Dernière MAJ' : 'Last update'}:</span>
                    <span className="font-medium">17 {language === 'fr' ? 'déc' : 'Dec'} 2024</span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">PWA:</span>
                    <span className="font-medium flex items-center gap-1">
                      <Check className="w-4 h-4 text-green-500" />
                      {language === 'fr' ? 'Compatible iOS/Android' : 'iOS/Android compatible'}
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">{language === 'fr' ? 'Stockage' : 'Storage'}:</span>
                    <span className="font-medium">IndexedDB</span>
                  </div>
                  <div className="sm:col-span-2 flex justify-between p-3 bg-muted rounded-lg">
                    <span className="text-muted-foreground">{language === 'fr' ? 'Développeur' : 'Developer'}:</span>
                    <span className="font-medium text-xs sm:text-sm">Startup AFRICA HORIZON AQUATIC</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2 text-sm">
                  <HardDrive className="w-4 h-4" />
                  {language === 'fr' ? 'Stockage utilisé' : 'Storage used'}
                </h4>
                <div className="p-4 border rounded-lg space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === 'fr' ? 'Utilisé' : 'Used'}:</span>
                    <span className="font-medium">{formatBytes(storageInfo.used)}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-aqua-500 h-2 rounded-full transition-all"
                      style={{ width: `${storageInfo.quota > 0 ? (storageInfo.used / storageInfo.quota) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{language === 'fr' ? 'Quota disponible' : 'Available quota'}:</span>
                    <span>{formatBytes(storageInfo.quota)}</span>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <h4 className="font-medium text-sm">{language === 'fr' ? 'Cache et stockage' : 'Cache and storage'}</h4>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button variant="outline" onClick={handleForceUpdate} disabled={isForcingUpdate} className="flex-1 sm:flex-none">
                    <RefreshCw className={`w-4 h-4 mr-2 ${isForcingUpdate ? 'animate-spin' : ''}`} />
                    {language === 'fr' ? 'Forcer la mise à jour' : 'Force update'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowClearCacheDialog(true)} className="flex-1 sm:flex-none">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Vider le cache' : 'Clear cache'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowClearDataDialog(true)} className="flex-1 sm:flex-none">
                    <Trash2 className="w-4 h-4 mr-2" />
                    {language === 'fr' ? 'Effacer les données locales' : 'Clear local data'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sauvegarde */}
        <TabsContent value="backup" className="space-y-4 sm:space-y-6">
          <BackupManagement />
        </TabsContent>
      </Tabs>

      {/* Dialog de confirmation - Vider le cache */}
      <AlertDialog open={showClearCacheDialog} onOpenChange={setShowClearCacheDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'fr' ? 'Vider le cache' : 'Clear cache'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr' 
                ? 'Cette action va supprimer les fichiers mis en cache. L\'application rechargera les ressources depuis le serveur.'
                : 'This will delete cached files. The app will reload resources from the server.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'fr' ? 'Annuler' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearCache} disabled={isClearingCache}>
              {isClearingCache ? (language === 'fr' ? 'En cours...' : 'Processing...') : (language === 'fr' ? 'Vider' : 'Clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation - Effacer les données locales */}
      <AlertDialog open={showClearDataDialog} onOpenChange={setShowClearDataDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{language === 'fr' ? 'Effacer les données locales' : 'Clear local data'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr' 
                ? 'Cette action va supprimer les données stockées localement (sauf vos paramètres). Les données sur le serveur ne seront pas affectées.'
                : 'This will delete locally stored data (except your settings). Server data will not be affected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'fr' ? 'Annuler' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearLocalData} disabled={isClearingCache}>
              {isClearingCache ? (language === 'fr' ? 'En cours...' : 'Processing...') : (language === 'fr' ? 'Effacer' : 'Clear')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmation - Supprimer le compte */}
      <AlertDialog open={showDeleteAccountDialog} onOpenChange={setShowDeleteAccountDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">{language === 'fr' ? 'Supprimer le compte' : 'Delete account'}</AlertDialogTitle>
            <AlertDialogDescription>
              {language === 'fr' 
                ? 'Cette action est irréversible. Toutes vos données seront définitivement supprimées. Pour confirmer, contactez notre support.'
                : 'This action is irreversible. All your data will be permanently deleted. To confirm, please contact our support.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{language === 'fr' ? 'Annuler' : 'Cancel'}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteAccount} className="bg-destructive hover:bg-destructive/90">
              {language === 'fr' ? 'Contacter le support' : 'Contact support'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsManagement;
