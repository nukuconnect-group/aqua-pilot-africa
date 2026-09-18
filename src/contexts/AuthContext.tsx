import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { initializeDemoData, clearDemoData } from '@/lib/demoData';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'operator' | 'user';
  avatar?: string;
  prenom?: string;
  nom?: string;
  entreprise?: string;
  capaciteProduction?: string;
  lastLogin?: string;
  subscriptionPlan?: string;
  isSuspended?: boolean;
  suspensionReason?: string;
  suspendedAt?: string;
  country?: string;
  countryCode?: string;
  isTeamMember?: boolean;
  teamMemberOwnerId?: string;
  notifications: {
    email: boolean;
    desktop: boolean;
    sms: boolean;
  };
}

interface MFAChallenge {
  factorId: string;
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; requiresMFA?: boolean; factorId?: string; pendingActivation?: boolean }>;
  completeMFALogin: (code: string) => Promise<boolean>;
  completeMFALoginWithRecoveryCode: (code: string) => Promise<boolean>;
  cancelMFALogin: () => void;
  mfaChallenge: MFAChallenge | null;
  logout: () => void;
  register: (name: string, email: string, password: string, subscriptionPlan?: string, extra?: {
    exploitation_type?: string;
    needs_sensors?: boolean;
    company_name?: string;
    company_address?: string;
    phone?: string;
    country?: string;
    country_code?: string;
    production_units?: string[];
  }) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<boolean>;
  isLoading: boolean;
  hasSeenOnboarding: boolean;
  completeOnboarding: () => void;
  isAuthenticated: boolean;
  updateNotificationSettings: (notifications: User['notifications']) => void;
  selectedSubscriptionPlan: string | null;
  setSelectedSubscriptionPlan: (plan: string | null) => void;
  hasSelectedPlan: boolean;
  completeSubscriptionSelection: () => void;
  isDemoMode: boolean;
  enterDemoMode: () => void;
  exitDemoMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Valeur de repli : évite qu'un composant monté hors du fournisseur
// (portail, boundary, rendu transitoire) ne fasse planter toute l'application.
const FALLBACK_AUTH: AuthContextType = {
  user: null,
  login: async () => ({ success: false }),
  completeMFALogin: async () => false,
  completeMFALoginWithRecoveryCode: async () => false,
  cancelMFALogin: () => {},
  mfaChallenge: null,
  logout: () => {},
  register: async () => ({ success: false, error: 'Service indisponible' }),
  resetPassword: async () => false,
  isLoading: false,
  hasSeenOnboarding: false,
  completeOnboarding: () => {},
  isAuthenticated: false,
  updateNotificationSettings: () => {},
  selectedSubscriptionPlan: null,
  setSelectedSubscriptionPlan: () => {},
  hasSelectedPlan: false,
  completeSubscriptionSelection: () => {},
  isDemoMode: false,
  enterDemoMode: () => {},
  exitDemoMode: () => {},
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn('useAuth utilisé hors AuthProvider : valeur de repli appliquée.');
    }
    return FALLBACK_AUTH;
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isE2EDemoMode = import.meta.env.DEV && new URLSearchParams(window.location.search).get('e2eDemo') === '1';
  const createDemoUser = (): User => ({
    id: 'demo-user',
    name: 'Utilisateur Démo',
    email: 'demo@aquapilot.com',
    role: 'user',
    notifications: {
      email: true,
      desktop: true,
      sms: false
    }
  });

  const [user, setUser] = useState<User | null>(() => isE2EDemoMode ? createDemoUser() : null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(!isE2EDemoMode);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    // Initialiser depuis localStorage
    return localStorage.getItem('aqua_pilot_onboarding') === 'true';
  });
  const [selectedSubscriptionPlan, setSelectedSubscriptionPlan] = useState<string | null>(null);
  const [hasSelectedPlan, setHasSelectedPlan] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(isE2EDemoMode);
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallenge | null>(null);

  // Fetch user profile and roles from Supabase
  const fetchUserData = async (supabaseUser: SupabaseUser) => {
    try {
      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .maybeSingle();

      if (profileError) {
        if (import.meta.env.DEV) console.error('Error fetching profile:', profileError);
      }

      // Get roles
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', supabaseUser.id);

      if (rolesError) {
        if (import.meta.env.DEV) console.error('Error fetching roles:', rolesError);
      }

      // Check if user is a team member (by user_id - more secure than email)
      let isTeamMember = false;
      let teamMemberOwnerId: string | undefined;
      
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('owner_id, status')
        .eq('user_id', supabaseUser.id)
        .eq('status', 'active')
        .maybeSingle();
      
      if (teamMember) {
        isTeamMember = true;
        teamMemberOwnerId = teamMember.owner_id;
      }

      const role = userRoles && userRoles.length > 0 ? userRoles[0].role : 'user';

      const userData: User = {
        id: supabaseUser.id,
        name: profile?.full_name || supabaseUser.email || '',
        email: supabaseUser.email || '',
        role: role as 'admin' | 'manager' | 'operator' | 'user',
        avatar: profile?.avatar_url || undefined,
        lastLogin: new Date().toISOString(),
        isSuspended: profile?.is_suspended || false,
        suspensionReason: profile?.suspension_reason || undefined,
        suspendedAt: profile?.suspended_at || undefined,
        country: profile?.country || undefined,
        countryCode: profile?.country_code || undefined,
        isTeamMember,
        teamMemberOwnerId,
        notifications: {
          email: true,
          desktop: true,
          sms: false
        }
      };

      setUser(userData);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Error fetching user data:', error);
    }
  };

  // Set up auth state listener with improved session persistence (OPTIMIZED - no "verification de session" delay)
  useEffect(() => {
    let mounted = true;
    let refreshInterval: ReturnType<typeof setInterval> | null = null;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        // Immediate update for session (no console log to reduce noise)
        setSession(session);
        
        if (session?.user) {
          // Utiliser setTimeout pour éviter les deadlocks - IMMEDIATE
          setTimeout(async () => {
            if (mounted) {
              await fetchUserData(session.user);
              setIsLoading(false);
            }
          }, 0);
        } else if (!isDemoMode) {
          setUser(null);
          setIsLoading(false);
        }

        // Gérer les événements spécifiques
        if (event === 'SIGNED_OUT' && !isDemoMode) {
          setUser(null);
          setSession(null);
          setIsDemoMode(false);
        }
      }
    );

    // THEN check for existing session - FAST PATH with timeout
    const initializeSession = async () => {
      try {
        // Fast timeout for session check - don't block UI
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session check timeout')), 3000)
        );

        let sessionResult;
        try {
          sessionResult = await Promise.race([sessionPromise, timeoutPromise]) as { data: { session: Session | null }, error: any };
        } catch {
          // Timeout - continue without session, let auth listener handle it
          if (mounted) setIsLoading(false);
          return;
        }

        const { data: { session }, error } = sessionResult;
        
        if (error || !mounted) {
          if (mounted) setIsLoading(false);
          return;
        }
        
        setSession(session);
        
        if (session?.user) {
          await fetchUserData(session.user);
        }
        
        setIsLoading(false);
      } catch (error) {
        if (mounted) setIsLoading(false);
      }
    };

    initializeSession();

    // Rafraîchir la session périodiquement (toutes les 15 minutes - less aggressive)
    refreshInterval = setInterval(async () => {
      if (session?.user && navigator.onLine) {
        try {
          await supabase.auth.refreshSession();
        } catch {
          // Silent error - don't spam console
        }
      }
    }, 15 * 60 * 1000);

    // Set up realtime subscription for profile updates
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    
    // Attendre que la session soit chargée avant de s'abonner
    const setupRealtimeSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id && mounted) {
        profileChannel = supabase
          .channel(`profile-changes-${Math.random().toString(36).slice(2)}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${session.user.id}`
            },
            (payload) => {
              if (session?.user && mounted) {
                setTimeout(() => {
                  fetchUserData(session.user);
                }, 0);
              }
            }
          )
          .subscribe();
      }
    };
    
    setupRealtimeSubscription();

    // Écouter les événements de visibilité pour restaurer la session
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && session?.user) {
        // Vérifier et rafraîchir la session quand l'app revient au premier plan
        try {
          const { data: { session: currentSession }, error } = await supabase.auth.getSession();
          if (error || !currentSession) {
            console.log('Session lost, user needs to re-authenticate');
          }
        } catch (err) {
          console.error('Error checking session on visibility change:', err);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (profileChannel) {
        supabase.removeChannel(profileChannel);
      }
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const completeOnboarding = () => {
    setHasSeenOnboarding(true);
    localStorage.setItem('aqua_pilot_onboarding', 'true');
  };

  const completeSubscriptionSelection = () => {
    setHasSelectedPlan(true);
  };

  const updateNotificationSettings = (notifications: User['notifications']) => {
    if (user) {
      const updatedUser = { ...user, notifications };
      setUser(updatedUser);
    }
  };

  const login = async (email: string, password: string): Promise<{ success: boolean; requiresMFA?: boolean; factorId?: string; pendingActivation?: boolean }> => {
    setIsLoading(true);
    
    // Validation basique
    if (!email || !password) {
      setIsLoading(false);
      return { success: false };
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setIsLoading(false);
      return { success: false };
    }
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (import.meta.env.DEV) console.error('Login error:', error.message);
        setIsLoading(false);
        return { success: false };
      }

      if (data.user && data.session) {
        // Check if MFA is required
        const { data: factorsData } = await supabase.auth.mfa.listFactors();
        
        if (factorsData && factorsData.totp.length > 0) {
          const verifiedFactors = factorsData.totp.filter(f => f.status === 'verified');
          
          if (verifiedFactors.length > 0) {
            // MFA is required - store challenge info and return
            const factorId = verifiedFactors[0].id;
            setMfaChallenge({
              factorId,
              email: email.trim().toLowerCase(),
              password
            });
            setIsLoading(false);
            return { success: false, requiresMFA: true, factorId };
          }
        }

        // Les comptes sont activés automatiquement à l'inscription.
        // (Aucun blocage d'activation manuelle par un administrateur.)

        // No MFA required - complete login
        clearDemoData();
        setIsDemoMode(false);
        await fetchUserData(data.user);
        
        localStorage.setItem('aqua_pilot_splash', 'true');
        localStorage.setItem('privacy_accepted', 'true');
        localStorage.setItem('onboarding_complete', 'true');
        
        setIsLoading(false);
        return { success: true };
      }
      
      setIsLoading(false);
      return { success: false };
    } catch (error) {
      if (import.meta.env.DEV) console.error('Login error:', error);
      setIsLoading(false);
      return { success: false };
    }
  };

  const completeMFALogin = async (code: string): Promise<boolean> => {
    if (!mfaChallenge) return false;
    
    setIsLoading(true);
    
    try {
      // Create MFA challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaChallenge.factorId
      });

      if (challengeError) {
        throw challengeError;
      }

      // Verify the code
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaChallenge.factorId,
        challengeId: challengeData.id,
        code
      });

      if (verifyError) {
        throw verifyError;
      }

      // MFA verified - complete login
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        clearDemoData();
        setIsDemoMode(false);
        await fetchUserData(user);
        
        localStorage.setItem('aqua_pilot_splash', 'true');
        localStorage.setItem('privacy_accepted', 'true');
        localStorage.setItem('onboarding_complete', 'true');
        
        setMfaChallenge(null);
        setIsLoading(false);
        return true;
      }
      
      setIsLoading(false);
      return false;
    } catch (error) {
      if (import.meta.env.DEV) console.error('MFA verification error:', error);
      setIsLoading(false);
      return false;
    }
  };

  // Complete MFA login using recovery code
  const completeMFALoginWithRecoveryCode = async (recoveryCode: string): Promise<boolean> => {
    if (!mfaChallenge) return false;
    
    setIsLoading(true);
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not found');
      }

      // Hash the recovery code
      const encoder = new TextEncoder();
      const data = encoder.encode(recoveryCode.toUpperCase());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const codeHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Find unused code with matching hash
      const { data: codes, error: fetchError } = await supabase
        .from('mfa_recovery_codes')
        .select('id')
        .eq('user_id', user.id)
        .eq('code_hash', codeHash)
        .eq('is_used', false)
        .limit(1);

      if (fetchError) {
        throw fetchError;
      }

      if (!codes || codes.length === 0) {
        setIsLoading(false);
        return false;
      }

      // Mark the code as used
      const { error: updateError } = await supabase
        .from('mfa_recovery_codes')
        .update({ 
          is_used: true,
          used_at: new Date().toISOString()
        })
        .eq('id', codes[0].id);

      if (updateError) {
        throw updateError;
      }

      // Recovery code verified - complete login
      clearDemoData();
      setIsDemoMode(false);
      await fetchUserData(user);
      
      localStorage.setItem('aqua_pilot_splash', 'true');
      localStorage.setItem('privacy_accepted', 'true');
      localStorage.setItem('onboarding_complete', 'true');
      
      setMfaChallenge(null);
      setIsLoading(false);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Recovery code verification error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const cancelMFALogin = () => {
    setMfaChallenge(null);
    // Sign out the partial session
    supabase.auth.signOut();
  };

  const register = async (name: string, email: string, password: string, subscriptionPlan: string = 'trial', extra?: {
    exploitation_type?: string;
    needs_sensors?: boolean;
    company_name?: string;
    company_address?: string;
    phone?: string;
    country?: string;
    country_code?: string;
    production_units?: string[];
  }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    // Validation basique
    if (!name || !email || !password) {
      setIsLoading(false);
      return { success: false, error: 'Tous les champs sont requis' };
    }

    // Validation nom
    if (name.trim().length < 2) {
      setIsLoading(false);
      return { success: false, error: 'Le nom doit contenir au moins 2 caractères' };
    }

    // Validation format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setIsLoading(false);
      return { success: false, error: 'Format d\'email invalide' };
    }

    // Validation longueur mot de passe
    if (password.length < 8) {
      setIsLoading(false);
      return { success: false, error: 'Le mot de passe doit contenir au moins 8 caractères' };
    }

    // Validation complexité mot de passe
    if (!/[A-Z]/.test(password)) {
      setIsLoading(false);
      return { success: false, error: 'Le mot de passe doit contenir au moins une majuscule' };
    }
    if (!/[a-z]/.test(password)) {
      setIsLoading(false);
      return { success: false, error: 'Le mot de passe doit contenir au moins une minuscule' };
    }
    if (!/[0-9]/.test(password)) {
      setIsLoading(false);
      return { success: false, error: 'Le mot de passe doit contenir au moins un chiffre' };
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      setIsLoading(false);
      return { success: false, error: 'Le mot de passe doit contenir au moins un caractère spécial' };
    }
    
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      
      // Inscription directe sans vérification préalable de l'email
      // Supabase gère déjà la vérification des emails en double
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: name.trim(),
            subscription_plan: subscriptionPlan,
            exploitation_type: extra?.exploitation_type,
            needs_sensors: extra?.needs_sensors ?? false,
            company_name: extra?.company_name,
            company_address: extra?.company_address,
            phone: extra?.phone,
            country: extra?.country,
            country_code: extra?.country_code,
            production_units: extra?.production_units ?? []
          }
        }
      });

      if (error) {
        setIsLoading(false);
        
        // Gestion des erreurs spécifiques de Supabase
        if (error.message.includes('User already registered')) {
          return { success: false, error: 'Cet email est déjà utilisé. Essayez de vous connecter.' };
        }
        
        if (error.message.includes('already registered') || error.message.includes('already exists')) {
          return { success: false, error: 'Cet email est déjà associé à un compte existant.' };
        }

        if (error.message.includes('rate limit')) {
          return { success: false, error: 'Trop de tentatives. Veuillez attendre quelques instants.' };
        }

        if (
          error.message.toLowerCase().includes('confirmation email') ||
          error.message.toLowerCase().includes('sending email') ||
          (error as any)?.code === 'unexpected_failure'
        ) {
          return {
            success: false,
            error:
              "L'email de confirmation n'a pas pu être envoyé (configuration SMTP). Contactez le support : support@aquapilote.com",
          };
        }

        if (error.message.includes('invalid')) {
          return { success: false, error: 'Les informations fournies sont invalides.' };
        }
        
        // Message générique pour les autres erreurs
        return { success: false, error: 'Impossible de créer le compte. Vérifiez vos informations et réessayez.' };
      }

      if (data.user) {
        // Detect country automatically and update profile
        try {
          console.log('Detecting country for new user:', data.user.id);
          const { data: countryData, error: countryError } = await supabase.functions.invoke('detect-country', {
            body: {
              user_id: data.user.id,
              update_profile: true
            }
          });
          
          if (countryError) {
            console.error('Country detection error:', countryError);
          } else if (countryData?.country) {
            console.log('Country detected:', countryData.country, countryData.countryCode);
          } else {
            console.log('No country detected from IP');
          }
        } catch (countryDetectionError) {
          console.error('Country detection failed:', countryDetectionError);
        }
        
        setIsLoading(false);
        return { success: true };
      }
      
      setIsLoading(false);
      return { success: false, error: 'Une erreur est survenue lors de l\'inscription' };
    } catch (error: any) {
      setIsLoading(false);
      
      // Gestion de l'erreur LockManager spécifique
      if (error?.message?.includes('LockManager')) {
        return { success: false, error: 'Erreur de connexion. Veuillez rafraîchir la page et réessayer.' };
      }
      
      return { success: false, error: 'Une erreur technique est survenue. Veuillez réessayer dans quelques instants.' };
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        if (import.meta.env.DEV) console.error('Reset password error:', error);
        setIsLoading(false);
        return false;
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Reset password error:', error);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    // Ne pas effacer l'onboarding au logout - l'utilisateur l'a déjà vu
    setIsDemoMode(false);
  };

  const enterDemoMode = () => {
    setIsDemoMode(true);
    setIsLoading(false);
    // Marquer l'onboarding comme vu en mode démo
    localStorage.setItem('aqua_pilot_onboarding', 'true');
    setHasSeenOnboarding(true);
    // Initialiser les données fictives
    initializeDemoData();
    
    setUser(createDemoUser());
  };

  const exitDemoMode = () => {
    setIsDemoMode(false);
    setUser(null);
    // Effacer les données fictives
    clearDemoData();
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      completeMFALogin,
      completeMFALoginWithRecoveryCode,
      cancelMFALogin,
      mfaChallenge,
      logout,
      register,
      resetPassword,
      isLoading,
      hasSeenOnboarding,
      completeOnboarding,
      isAuthenticated: !!user,
      updateNotificationSettings,
      selectedSubscriptionPlan,
      setSelectedSubscriptionPlan,
      hasSelectedPlan,
      completeSubscriptionSelection,
      isDemoMode,
      enterDemoMode,
      exitDemoMode
    }}>
      {children}
    </AuthContext.Provider>
  );
};