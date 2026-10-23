import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentSubscription } from '@/hooks/useCurrentSubscription';
import { useTeamMemberAccess } from '@/hooks/useTeamMemberAccess';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import {
  FULL_PERMISSIONS,
  MODULE_CATALOG,
  NO_PERMISSIONS,
  PLAN_UPDATED_EVENT,
  type ModuleAction,
  type ModulePermissionSet,
  type PlanConfig,
  computeModuleAccess,
  enforceUnitTypeRestrictions,
  loadPlanConfigs,
  loadUnitModuleRules,
  loadUserModuleOverrides,
  resolvePlanKey,
  type UnitModuleRules,
  type UserModuleOverrides,
} from '@/lib/planModules';
import { tabToModuleId, ALWAYS_OPEN_MODULES } from '@/lib/moduleAccess';

interface ModuleAccessValue {
  isLoading: boolean;
  plans: PlanConfig[];
  currentPlan: PlanConfig | null;
  source: 'remote' | 'local';
  allowedModules: string[];
  /** Vérifie l'accès par identifiant de module OU identifiant d'onglet. */
  hasModuleAccess: (moduleOrTabId: string) => boolean;
  hasModulePermission: (moduleOrTabId: string, action: ModuleAction) => boolean;
  getPermissions: (moduleOrTabId: string) => ModulePermissionSet;
  refresh: () => Promise<void>;
}

const ModuleAccessContext = createContext<ModuleAccessValue | undefined>(undefined);

export const ModuleAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isDemoMode } = useAuth();
  const { subscription, loading: subLoading, reload } = useCurrentSubscription();
  const { isTeamMember, hasAccessToModule, isLoading: teamLoading } = useTeamMemberAccess();
  const { activeUnit } = useProductionUnits();

  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [source, setSource] = useState<'remote' | 'local'>('local');
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [userOverrides, setUserOverrides] = useState<UserModuleOverrides>({});
  const [unitRules, setUnitRules] = useState<UnitModuleRules | undefined>();

  const load = useCallback(async () => {
    setLoadingPlans(true);
    const [result, rules, overrides] = await Promise.all([
      loadPlanConfigs(),
      loadUnitModuleRules(),
      user?.id ? loadUserModuleOverrides(user.id) : Promise.resolve({}),
    ]);
    setPlans(result.plans);
    setSource(result.source);
    setUnitRules(rules);
    setUserOverrides(overrides);
    setLoadingPlans(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Invalidation immédiate après une modification administrateur.
  useEffect(() => {
    const onUpdate = () => {
      load();
      reload();
    };
    window.addEventListener(PLAN_UPDATED_EVENT, onUpdate);
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'aqua-plan-modules-version') onUpdate();
    };
    window.addEventListener('storage', onStorage);
    const interval = window.setInterval(load, 120000);
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, onUpdate);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(interval);
    };
  }, [load, reload]);

  const currentPlan = useMemo(() => {
    if (!subscription) return plans.find((plan) => plan.key === 'free') || null;
    const key = resolvePlanKey(subscription.plan);
    return plans.find((plan) => plan.key === key) || plans.find((plan) => plan.key === 'free') || null;
  }, [plans, subscription]);

  const isUnrestricted = !user || isDemoMode || user.role === 'admin';

  const { allowed, permissions } = useMemo(() => {
    if (isUnrestricted) {
      const all = activeUnit?.type
        ? enforceUnitTypeRestrictions(
            activeUnit.type,
            (unitRules || undefined)?.[activeUnit.type] || MODULE_CATALOG.map((m) => m.key),
          )
        : new Set(MODULE_CATALOG.map((m) => m.key));
      const perms: Record<string, ModulePermissionSet> = {};
      all.forEach((key) => { perms[key] = FULL_PERMISSIONS; });
      return { allowed: all, permissions: perms };
    }
    return computeModuleAccess(currentPlan, user?.role || 'user', {
      userOverrides,
      activeUnitType: activeUnit?.type || null,
      unitRules,
    });
  }, [activeUnit?.type, currentPlan, isUnrestricted, unitRules, user?.role, userOverrides]);

  const hasModuleAccess = useCallback(
    (moduleOrTabId: string) => {
      const moduleId = tabToModuleId(moduleOrTabId);
      if (moduleId === 'admin') return user?.role === 'admin';
      if (ALWAYS_OPEN_MODULES.includes(moduleId)) return true;
      // Ventes et Stock sont disponibles dans toutes les unités (seul le rôle d'équipe peut les restreindre).
      if (moduleId === 'sales' || moduleOrTabId === 'stock') return !isTeamMember || hasAccessToModule(moduleId);
       if (isUnrestricted) return allowed.has(moduleId);
      if (!allowed.has(moduleId)) return false;
      // Le rôle d'équipe restreint en plus l'abonnement.
      if (isTeamMember && !hasAccessToModule(moduleId)) return false;
      return true;
    },
     [allowed, hasAccessToModule, isTeamMember, isUnrestricted, user?.role],
  );

  const getPermissions = useCallback(
    (moduleOrTabId: string): ModulePermissionSet => {
      const moduleId = tabToModuleId(moduleOrTabId);
      if (moduleId === 'aqua-assistant') return FULL_PERMISSIONS;
      if (isUnrestricted) return allowed.has(moduleId) ? FULL_PERMISSIONS : NO_PERMISSIONS;
      if (!hasModuleAccess(moduleId)) return NO_PERMISSIONS;
      return permissions[moduleId] || FULL_PERMISSIONS;
    },
    [allowed, hasModuleAccess, isUnrestricted, permissions],
  );

  const value: ModuleAccessValue = {
    isLoading: loadingPlans || subLoading || teamLoading,
    plans,
    currentPlan,
    source,
    allowedModules: Array.from(allowed),
    hasModuleAccess,
    hasModulePermission: (moduleOrTabId, action) => getPermissions(moduleOrTabId)[action],
    getPermissions,
    refresh: load,
  };

  return <ModuleAccessContext.Provider value={value}>{children}</ModuleAccessContext.Provider>;
};

export const useModuleAccess = (): ModuleAccessValue => {
  const context = useContext(ModuleAccessContext);
  if (!context) {
    // Repli sûr : ne jamais faire planter un composant monté hors provider.
    return {
      isLoading: false,
      plans: [],
      currentPlan: null,
      source: 'local',
      allowedModules: MODULE_CATALOG.map((m) => m.key),
      hasModuleAccess: () => true,
      hasModulePermission: () => true,
      getPermissions: () => FULL_PERMISSIONS,
      refresh: async () => {},
    };
  }
  return context;
};

export default ModuleAccessProvider;
