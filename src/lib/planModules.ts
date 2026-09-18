/**
 * Système centralisé « Abonnement → Modules → Rôle → Permissions → Accès ».
 *
 * - Le catalogue des modules est stable (identifiants techniques).
 * - Les plans et les modules inclus sont configurables par l'administrateur.
 * - Persistance : tables Supabase `plans` / `plan_modules` / `plan_module_audit`.
 *   Si ces tables n'existent pas encore, un repli local (localStorage) permet
 *   au système de fonctionner sans bloquer l'application.
 */
import { supabase } from '@/integrations/supabase/appClient';
import { APP_MODULE_PERMISSIONS } from '@/lib/moduleAccess';

export type ModuleAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export const MODULE_ACTIONS: { id: ModuleAction; label: string }[] = [
  { id: 'view', label: 'Voir' },
  { id: 'create', label: 'Créer' },
  { id: 'edit', label: 'Modifier' },
  { id: 'delete', label: 'Supprimer' },
  { id: 'export', label: 'Exporter' },
];

export type ModulePermissionSet = Record<ModuleAction, boolean>;

export const FULL_PERMISSIONS: ModulePermissionSet = {
  view: true,
  create: true,
  edit: true,
  delete: true,
  export: true,
};

export const NO_PERMISSIONS: ModulePermissionSet = {
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
};

export interface AppModuleDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  isPremium: boolean;
  isCore: boolean;
  sortOrder: number;
  tabIds: string[];
}

const MODULE_META: Record<string, { category: string; premium?: boolean; core?: boolean }> = {
  dashboard: { category: 'Pilotage', core: true },
  'performance-alerts': { category: 'Pilotage' },
  iot: { category: 'Technique', premium: true },
  environment: { category: 'Technique' },
  units: { category: 'Exploitation' },
  infrastructure: { category: 'Exploitation' },
  livestock: { category: 'Exploitation' },
  feeding: { category: 'Exploitation' },
  aquafeed: { category: 'Intelligence', premium: true },
  health: { category: 'Exploitation' },
  production: { category: 'Exploitation' },
  accounting: { category: 'Gestion' },
  purchases: { category: 'Gestion' },
  sales: { category: 'Gestion' },
  suppliers: { category: 'Gestion' },
  hr: { category: 'Gestion', premium: true },
  planning: { category: 'Pilotage' },
  reports: { category: 'Pilotage' },
  analytics: { category: 'Intelligence', premium: true },
  library: { category: 'Intelligence', premium: true },
  'aqua-assistant': { category: 'Intelligence', premium: true },
  support: { category: 'Système', core: true },
  offline: { category: 'Système' },
  settings: { category: 'Système', core: true },
  team: { category: 'Système' },
  admin: { category: 'Système', core: true },
};

export const MODULE_CATALOG: AppModuleDefinition[] = APP_MODULE_PERMISSIONS.map((module, index) => {
  const meta = MODULE_META[module.id] || { category: 'Autre' };
  return {
    key: module.id,
    name: module.label,
    description: module.description,
    category: meta.category,
    isPremium: Boolean(meta.premium),
    isCore: Boolean(meta.core),
    sortOrder: index,
    tabIds: module.tabIds,
  };
});

export const getModuleDefinition = (key: string) =>
  MODULE_CATALOG.find((module) => module.key === key);

/** Modules toujours accessibles quel que soit l'abonnement. */
export const CORE_MODULE_KEYS = MODULE_CATALOG.filter((m) => m.isCore).map((m) => m.key);

export interface PlanRolePermissions {
  [role: string]: Record<string, ModulePermissionSet>;
}

export interface PlanConfig {
  key: string;
  name: string;
  description: string;
  price: number;
  billingPeriod: 'monthly' | 'yearly' | 'trial' | 'free';
  isActive: boolean;
  sortOrder: number;
  /** Identifiants des modules inclus dans le plan. */
  modules: string[];
  /** Permissions fines par rôle utilisateur (optionnel). */
  rolePermissions: PlanRolePermissions;
}

export const MANAGED_ROLES = ['manager', 'operator', 'user'] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  manager: 'Responsable',
  operator: 'Opérateur',
  user: 'Utilisateur',
};

const baseModules = (keys: string[]) => Array.from(new Set([...CORE_MODULE_KEYS, ...keys]));

const defaultRolePermissions = (modules: string[]): PlanRolePermissions => {
  const build = (allow: Partial<ModulePermissionSet>) =>
    modules.reduce<Record<string, ModulePermissionSet>>((acc, key) => {
      acc[key] = { ...FULL_PERMISSIONS, ...allow };
      return acc;
    }, {});
  return {
    manager: build({}),
    operator: build({ delete: false }),
    user: build({ create: false, edit: false, delete: false }),
  };
};

const makePlan = (
  key: string,
  name: string,
  description: string,
  price: number,
  billingPeriod: PlanConfig['billingPeriod'],
  modules: string[],
  sortOrder: number,
): PlanConfig => {
  const list = baseModules(modules);
  return {
    key,
    name,
    description,
    price,
    billingPeriod,
    isActive: true,
    sortOrder,
    modules: list,
    rolePermissions: defaultRolePermissions(list),
  };
};

export const DEFAULT_PLANS: PlanConfig[] = [
  makePlan('free', 'Plan Gratuit', 'Découverte limitée', 0, 'free', ['units', 'infrastructure', 'livestock', 'feeding', 'reports'], 0),
  makePlan(
    'standard',
    'Plan Standard',
    'Exploitation et gestion de base',
    0,
    'yearly',
    ['units', 'infrastructure', 'livestock', 'feeding', 'health', 'production', 'sales', 'purchases', 'planning', 'reports'],
    1,
  ),
  makePlan(
    'professional',
    'Plan Professionnel',
    'Gestion complète + intelligence',
    0,
    'yearly',
    [
      'units', 'infrastructure', 'livestock', 'feeding', 'health', 'production',
      'sales', 'purchases', 'suppliers', 'accounting', 'planning', 'reports',
      'analytics', 'aquafeed', 'performance-alerts', 'environment', 'team', 'offline',
    ],
    2,
  ),
  makePlan(
    'enterprise',
    'Plan Entreprise',
    'Tous les modules AquaPilote',
    0,
    'yearly',
    MODULE_CATALOG.map((m) => m.key),
    3,
  ),
];

/** Correspondance entre les plans historiques de `subscriptions` et les plans configurables. */
export const LEGACY_PLAN_ALIASES: Record<string, string> = {
  trial_discovery: 'professional',
  trial: 'professional',
  annual_basic: 'standard',
  annual_pro: 'professional',
  annual_enterprise: 'enterprise',
  monthly: 'standard',
  annual: 'professional',
  premium: 'professional',
  standard: 'standard',
  free: 'free',
};

export const resolvePlanKey = (rawPlan: string | null | undefined): string => {
  if (!rawPlan) return 'free';
  if (LEGACY_PLAN_ALIASES[rawPlan]) return LEGACY_PLAN_ALIASES[rawPlan];
  return rawPlan;
};

export interface AuditEntry {
  id: string;
  created_at: string;
  admin_email: string;
  plan_key: string;
  module_key: string;
  action: string;
  before_value: string | null;
  after_value: string | null;
}

const LOCAL_PLANS_KEY = 'aqua-plan-configs-v1';
const LOCAL_AUDIT_KEY = 'aqua-plan-audit-v1';

const missingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|Could not find the table/i.test(error.message || ''));

const readLocalPlans = (): PlanConfig[] | null => {
  try {
    const raw = localStorage.getItem(LOCAL_PLANS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? (parsed as PlanConfig[]) : null;
  } catch {
    return null;
  }
};

const writeLocalPlans = (plans: PlanConfig[]) => {
  try {
    localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(plans));
  } catch {
    /* quota */
  }
};

export interface PlansLoadResult {
  plans: PlanConfig[];
  source: 'remote' | 'local';
}

const mergeWithDefaults = (plans: PlanConfig[]): PlanConfig[] => {
  const byKey = new Map(plans.map((plan) => [plan.key, plan]));
  DEFAULT_PLANS.forEach((plan) => {
    if (!byKey.has(plan.key)) byKey.set(plan.key, plan);
  });
  return Array.from(byKey.values()).sort((a, b) => a.sortOrder - b.sortOrder);
};

export const loadPlanConfigs = async (): Promise<PlansLoadResult> => {
  const client = supabase as any;
  try {
    const { data: planRows, error: planError } = await client
      .from('plans')
      .select('*')
      .order('sort_order', { ascending: true });

    if (planError || !planRows) {
      if (!missingTable(planError)) {
        console.warn('[planModules] lecture des plans impossible', planError?.message);
      }
      return { plans: mergeWithDefaults(readLocalPlans() || []), source: 'local' };
    }

    const { data: moduleRows, error: moduleError } = await client.from('plan_modules').select('*');
    if (moduleError) {
      return { plans: mergeWithDefaults(readLocalPlans() || []), source: 'local' };
    }

    const plans: PlanConfig[] = (planRows as any[]).map((row, index) => {
      const rows = (moduleRows as any[]).filter((m) => m.plan_key === row.key);
      const modules = rows.filter((m) => m.enabled).map((m) => m.module_key);
      const rolePermissions: PlanRolePermissions = {};
      rows.forEach((m) => {
        const perms = (m.permissions || {}) as PlanRolePermissions[string];
        Object.entries(perms).forEach(([role, value]) => {
          rolePermissions[role] = rolePermissions[role] || {};
          rolePermissions[role][m.module_key] = { ...NO_PERMISSIONS, ...(value as ModulePermissionSet) };
        });
      });
      return {
        key: row.key,
        name: row.name,
        description: row.description || '',
        price: Number(row.price || 0),
        billingPeriod: (row.billing_period || 'yearly') as PlanConfig['billingPeriod'],
        isActive: row.is_active !== false,
        sortOrder: row.sort_order ?? index,
        modules: Array.from(new Set([...CORE_MODULE_KEYS, ...modules])),
        rolePermissions: Object.keys(rolePermissions).length
          ? rolePermissions
          : defaultRolePermissions(modules),
      };
    });

    if (!plans.length) return { plans: mergeWithDefaults([]), source: 'remote' };
    return { plans: mergeWithDefaults(plans), source: 'remote' };
  } catch (error) {
    console.warn('[planModules] repli local', error);
    return { plans: mergeWithDefaults(readLocalPlans() || []), source: 'local' };
  }
};

export const PLAN_UPDATED_EVENT = 'aqua:plan-modules-updated';

const notifyUpdate = () => {
  try {
    window.dispatchEvent(new CustomEvent(PLAN_UPDATED_EVENT));
    localStorage.setItem('aqua-plan-modules-version', String(Date.now()));
  } catch {
    /* ignore */
  }
};

export const savePlanConfig = async (
  plan: PlanConfig,
  options: { adminEmail: string; previous?: PlanConfig },
): Promise<{ ok: boolean; source: 'remote' | 'local'; error?: string }> => {
  const client = supabase as any;
  const changes = buildAuditChanges(plan, options.previous);

  try {
    const { error: planError } = await client
      .from('plans')
      .upsert(
        {
          key: plan.key,
          name: plan.name,
          description: plan.description,
          price: plan.price,
          billing_period: plan.billingPeriod,
          is_active: plan.isActive,
          sort_order: plan.sortOrder,
        },
        { onConflict: 'key' },
      );

    if (planError) throw planError;

    const rows = MODULE_CATALOG.map((module) => ({
      plan_key: plan.key,
      module_key: module.key,
      enabled: plan.modules.includes(module.key),
      permissions: MANAGED_ROLES.reduce<Record<string, ModulePermissionSet>>((acc, role) => {
        acc[role] = plan.rolePermissions[role]?.[module.key] || NO_PERMISSIONS;
        return acc;
      }, {}),
    }));

    const { error: modulesError } = await client
      .from('plan_modules')
      .upsert(rows, { onConflict: 'plan_key,module_key' });
    if (modulesError) throw modulesError;

    if (changes.length) {
      await client.from('plan_module_audit').insert(
        changes.map((change) => ({
          admin_email: options.adminEmail,
          plan_key: plan.key,
          module_key: change.moduleKey,
          action: change.action,
          before_value: change.before,
          after_value: change.after,
        })),
      );
    }

    notifyUpdate();
    return { ok: true, source: 'remote' };
  } catch (error: any) {
    // Repli local : la configuration reste appliquée sur cet appareil.
    const current = mergeWithDefaults(readLocalPlans() || []);
    const next = current.map((item) => (item.key === plan.key ? plan : item));
    if (!next.some((item) => item.key === plan.key)) next.push(plan);
    writeLocalPlans(next);
    appendLocalAudit(plan.key, changes, options.adminEmail);
    notifyUpdate();
    return { ok: true, source: 'local', error: error?.message };
  }
};

interface AuditChange {
  moduleKey: string;
  action: string;
  before: string | null;
  after: string | null;
}

const buildAuditChanges = (plan: PlanConfig, previous?: PlanConfig): AuditChange[] => {
  if (!previous) return [];
  const changes: AuditChange[] = [];
  MODULE_CATALOG.forEach((module) => {
    const before = previous.modules.includes(module.key);
    const after = plan.modules.includes(module.key);
    if (before !== after) {
      changes.push({
        moduleKey: module.key,
        action: 'module',
        before: before ? 'ACTIVÉ' : 'DÉSACTIVÉ',
        after: after ? 'ACTIVÉ' : 'DÉSACTIVÉ',
      });
    }
    MANAGED_ROLES.forEach((role) => {
      const prevPerm = previous.rolePermissions[role]?.[module.key] || NO_PERMISSIONS;
      const nextPerm = plan.rolePermissions[role]?.[module.key] || NO_PERMISSIONS;
      const diff = MODULE_ACTIONS.filter((action) => prevPerm[action.id] !== nextPerm[action.id]);
      if (diff.length) {
        changes.push({
          moduleKey: module.key,
          action: `permissions:${role}`,
          before: MODULE_ACTIONS.filter((a) => prevPerm[a.id]).map((a) => a.label).join(', ') || 'aucune',
          after: MODULE_ACTIONS.filter((a) => nextPerm[a.id]).map((a) => a.label).join(', ') || 'aucune',
        });
      }
    });
  });
  return changes;
};

const appendLocalAudit = (planKey: string, changes: AuditChange[], adminEmail: string) => {
  if (!changes.length) return;
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_KEY);
    const current: AuditEntry[] = raw ? JSON.parse(raw) : [];
    const entries: AuditEntry[] = changes.map((change, index) => ({
      id: `${Date.now()}-${index}`,
      created_at: new Date().toISOString(),
      admin_email: adminEmail,
      plan_key: planKey,
      module_key: change.moduleKey,
      action: change.action,
      before_value: change.before,
      after_value: change.after,
    }));
    localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify([...entries, ...current].slice(0, 300)));
  } catch {
    /* ignore */
  }
};

export const loadAuditEntries = async (): Promise<AuditEntry[]> => {
  const client = supabase as any;
  try {
    const { data, error } = await client
      .from('plan_module_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data) throw error || new Error('no data');
    return data as AuditEntry[];
  } catch {
    try {
      const raw = localStorage.getItem(LOCAL_AUDIT_KEY);
      return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
    } catch {
      return [];
    }
  }
};

/** Accès final = abonnement + rôle + permissions. */
export const computeModuleAccess = (
  plan: PlanConfig | null,
  role: string,
): { allowed: Set<string>; permissions: Record<string, ModulePermissionSet> } => {
  const allowed = new Set<string>(CORE_MODULE_KEYS);
  const permissions: Record<string, ModulePermissionSet> = {};

  if (!plan) {
    CORE_MODULE_KEYS.forEach((key) => { permissions[key] = FULL_PERMISSIONS; });
    return { allowed, permissions };
  }

  plan.modules.forEach((key) => allowed.add(key));

  allowed.forEach((key) => {
    if (role === 'admin' || role === 'owner') {
      permissions[key] = FULL_PERMISSIONS;
      return;
    }
    const rolePerms = plan.rolePermissions[role]?.[key];
    permissions[key] = rolePerms ? { ...NO_PERMISSIONS, ...rolePerms } : FULL_PERMISSIONS;
  });

  // Un module dont le rôle ne peut même pas « voir » reste masqué.
  Array.from(allowed).forEach((key) => {
    if (CORE_MODULE_KEYS.includes(key)) return;
    if (!permissions[key]?.view) allowed.delete(key);
  });

  return { allowed, permissions };
};
