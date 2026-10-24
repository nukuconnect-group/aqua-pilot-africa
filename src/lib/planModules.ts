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
import type { ProductionUnitType } from '@/contexts/ProductionUnitsContext';

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
  applicableUnitTypes?: ProductionUnitType[];
}

const ALL_OPERATIONAL_UNIT_TYPES: ProductionUnitType[] = ['ecloserie', 'grossissement', 'transformation', 'conservation', 'fabrication_aliment', 'algoculture', 'commercialisation'];
export const UNIT_TYPE_LABELS: Record<ProductionUnitType, string> = {
  ecloserie: 'Écloserie',
  grossissement: 'Grossissement / élevage',
  transformation: 'Transformation',
  conservation: 'Conservation',
  fabrication_aliment: "Fabrication d’aliments",
  algoculture: 'Algoculture',
  commercialisation: 'Commercialisation',
};

const MODULE_META: Record<string, { category: string; premium?: boolean; core?: boolean; unitTypes?: ProductionUnitType[] }> = {
  dashboard: { category: 'Pilotage', core: true },
  'performance-alerts': { category: 'Pilotage' },
  iot: { category: 'Technique', premium: true },
  environment: { category: 'Technique' },
  units: { category: 'Exploitation' },
  infrastructure: { category: 'Exploitation', unitTypes: ['ecloserie', 'grossissement', 'transformation', 'conservation', 'fabrication_aliment', 'algoculture', 'commercialisation'] },
  livestock: { category: 'Exploitation', unitTypes: ['ecloserie', 'grossissement', 'algoculture'] },
  feeding: { category: 'Exploitation', unitTypes: ['ecloserie', 'grossissement', 'fabrication_aliment', 'algoculture'] },
  aquafeed: { category: 'Intelligence', premium: true, unitTypes: ['fabrication_aliment'] },
  health: { category: 'Exploitation', unitTypes: ['ecloserie', 'grossissement', 'fabrication_aliment', 'algoculture'] },
  aquahealth: { category: 'Intelligence', premium: true, unitTypes: ['ecloserie', 'grossissement', 'algoculture'] },
  production: { category: 'Exploitation', unitTypes: ['ecloserie', 'grossissement', 'transformation', 'conservation', 'fabrication_aliment', 'algoculture'] },
  accounting: { category: 'Gestion' },
  purchases: { category: 'Gestion', unitTypes: ALL_OPERATIONAL_UNIT_TYPES },
  // Toutes les unités vendent, avec écritures en comptabilité et trésorerie.
  sales: { category: 'Gestion', unitTypes: ALL_OPERATIONAL_UNIT_TYPES },
  suppliers: { category: 'Gestion', unitTypes: ALL_OPERATIONAL_UNIT_TYPES },
  hr: { category: 'Gestion', premium: true },
  planning: { category: 'Pilotage' },
  reports: { category: 'Pilotage' },
  analytics: { category: 'Intelligence', premium: true },
  library: { category: 'Intelligence', premium: true },
  'business-intelligence': { category: 'Intelligence', core: true },
  'aqua-assistant': { category: 'Intelligence', core: true },
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
    applicableUnitTypes: meta.unitTypes,
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
    ['units', 'infrastructure', 'livestock', 'feeding', 'health', 'aquahealth', 'production', 'sales', 'purchases', 'crm', 'accounting', 'planning', 'reports'],
    1,
  ),
  makePlan(
    'professional',
    'Plan Professionnel',
    'Gestion complète + intelligence',
    0,
    'yearly',
    [
      'units', 'infrastructure', 'livestock', 'feeding', 'health', 'aquahealth', 'production',
      'sales', 'purchases', 'suppliers', 'crm', 'accounting', 'planning', 'reports',
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
const LOCAL_USER_OVERRIDES_KEY = 'aqua-user-module-overrides-v1';
const LOCAL_UNIT_RULES_KEY = 'aqua-unit-module-rules-v1';

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
    const existing = byKey.get(plan.key);
    if (!existing) {
      byKey.set(plan.key, plan);
      return;
    }
    // Les modules ajoutés après coup (ex. CRM) doivent apparaître même si
    // une ancienne configuration du plan était déjà enregistrée en local.
    const mergedModules = Array.from(new Set([...existing.modules, ...plan.modules]));
    byKey.set(plan.key, { ...existing, modules: mergedModules });
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

export type UserModuleOverrides = Record<string, boolean>;
export type UnitModuleRules = Record<ProductionUnitType, string[]>;

export const DEFAULT_UNIT_MODULE_RULES: UnitModuleRules = (Object.keys(UNIT_TYPE_LABELS) as ProductionUnitType[]).reduce(
  (rules, type) => {
    rules[type] = MODULE_CATALOG
      .filter((module) => !module.applicableUnitTypes || module.applicableUnitTypes.includes(type))
      .map((module) => module.key);
    return rules;
  },
  {} as UnitModuleRules,
);

/** Restrictions métier impératives, non réactivables par une configuration distante obsolète. */
const UNIT_TYPE_DENIED_MODULES: Partial<Record<ProductionUnitType, string[]>> = {
  fabrication_aliment: ['livestock'],
  algoculture: ['aquafeed'],
  commercialisation: ['feeding', 'aquafeed', 'livestock', 'health', 'aquahealth'],
};

export const enforceUnitTypeRestrictions = (type: ProductionUnitType, modules: Iterable<string>) => {
  const denied = new Set(UNIT_TYPE_DENIED_MODULES[type] || []);
  return new Set(Array.from(modules).filter((key) => !denied.has(key)));
};

const localOverrides = (): Record<string, UserModuleOverrides> => {
  try { return JSON.parse(localStorage.getItem(LOCAL_USER_OVERRIDES_KEY) || '{}'); } catch { return {}; }
};

export const loadUserModuleOverrides = async (userId: string): Promise<UserModuleOverrides> => {
  if (!userId) return {};
  try {
    const { data, error } = await (supabase as any).from('user_module_overrides').select('module_key, allowed').eq('user_id', userId);
    if (error) throw error;
    return Object.fromEntries(((data || []) as any[]).map((row) => [row.module_key, Boolean(row.allowed)]));
  } catch {
    return localOverrides()[userId] || {};
  }
};

export const saveUserModuleOverrides = async (
  userId: string,
  overrides: UserModuleOverrides,
  adminEmail: string,
): Promise<'remote' | 'local'> => {
  const rows = Object.entries(overrides).map(([module_key, allowed]) => ({ user_id: userId, module_key, allowed }));
  try {
    const client = supabase as any;
    const { error: deleteError } = await client.from('user_module_overrides').delete().eq('user_id', userId);
    if (deleteError) throw deleteError;
    if (rows.length) {
      const { error } = await client.from('user_module_overrides').insert(rows);
      if (error) throw error;
    }
    await client.from('plan_module_audit').insert({
      admin_email: adminEmail,
      plan_key: `user:${userId}`,
      module_key: '*',
      action: 'user_overrides',
      before_value: null,
      after_value: JSON.stringify(overrides),
    });
    notifyUpdate();
    return 'remote';
  } catch {
    const all = localOverrides();
    all[userId] = overrides;
    try { localStorage.setItem(LOCAL_USER_OVERRIDES_KEY, JSON.stringify(all)); } catch { /* quota */ }
    notifyUpdate();
    return 'local';
  }
};

export const resetUserModuleOverrides = async (userId: string): Promise<void> => {
  try { await (supabase as any).from('user_module_overrides').delete().eq('user_id', userId); } catch { /* fallback below */ }
  const all = localOverrides();
  delete all[userId];
  try { localStorage.setItem(LOCAL_USER_OVERRIDES_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  notifyUpdate();
};

export const loadUnitModuleRules = async (): Promise<UnitModuleRules> => {
  try {
    const { data, error } = await (supabase as any).from('unit_type_module_rules').select('unit_type, module_key, enabled');
    if (error || !data?.length) throw error || new Error('empty');
    const rules = structuredClone(DEFAULT_UNIT_MODULE_RULES);
    (data as any[]).forEach((row) => {
      const type = row.unit_type as ProductionUnitType;
      if (!(type in rules)) return;
      rules[type] = row.enabled
        ? Array.from(new Set([...rules[type], row.module_key]))
        : rules[type].filter((key) => key !== row.module_key);
    });
    return rules;
  } catch {
    try { return { ...DEFAULT_UNIT_MODULE_RULES, ...JSON.parse(localStorage.getItem(LOCAL_UNIT_RULES_KEY) || '{}') }; }
    catch { return structuredClone(DEFAULT_UNIT_MODULE_RULES); }
  }
};

export const saveUnitModuleRules = async (rules: UnitModuleRules): Promise<'remote' | 'local'> => {
  const rows = Object.entries(rules).flatMap(([unit_type, modules]) =>
    MODULE_CATALOG.map((module) => ({ unit_type, module_key: module.key, enabled: modules.includes(module.key) })),
  );
  try {
    const { error } = await (supabase as any).from('unit_type_module_rules').upsert(rows, { onConflict: 'unit_type,module_key' });
    if (error) throw error;
    notifyUpdate();
    return 'remote';
  } catch {
    try { localStorage.setItem(LOCAL_UNIT_RULES_KEY, JSON.stringify(rules)); } catch { /* quota */ }
    notifyUpdate();
    return 'local';
  }
};

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
  options: {
    userOverrides?: UserModuleOverrides;
    activeUnitType?: ProductionUnitType | null;
    unitRules?: UnitModuleRules;
  } = {},
): { allowed: Set<string>; permissions: Record<string, ModulePermissionSet> } => {
  const allowed = new Set<string>(CORE_MODULE_KEYS);
  const permissions: Record<string, ModulePermissionSet> = {};

  if (!plan) {
    CORE_MODULE_KEYS.forEach((key) => { permissions[key] = FULL_PERMISSIONS; });
    return { allowed, permissions };
  }

  plan.modules.forEach((key) => allowed.add(key));

  if (options.activeUnitType) {
    const compatible = enforceUnitTypeRestrictions(
      options.activeUnitType,
      (options.unitRules || DEFAULT_UNIT_MODULE_RULES)[options.activeUnitType],
    );
    Array.from(allowed).forEach((key) => {
      if (!CORE_MODULE_KEYS.includes(key) && !compatible.has(key)) allowed.delete(key);
    });
  }

  Object.entries(options.userOverrides || {}).forEach(([key, enabled]) => {
    if (!enabled && !CORE_MODULE_KEYS.includes(key)) allowed.delete(key);
  });

  allowed.forEach((key) => {
    if (key === 'aqua-assistant' || role === 'admin' || role === 'owner') {
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
