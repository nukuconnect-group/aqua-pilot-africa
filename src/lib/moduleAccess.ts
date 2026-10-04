export interface AppModulePermission {
  id: string;
  label: string;
  description: string;
  tabIds: string[];
}

export const APP_MODULE_PERMISSIONS: AppModulePermission[] = [
  { id: 'dashboard', label: 'Tableau de bord', description: 'Vue principale unifiée', tabIds: ['dashboard'] },
  { id: 'performance-alerts', label: 'Alertes performance', description: 'Alertes, seuils et suivi critique', tabIds: ['performance-alerts'] },
  { id: 'iot', label: 'IoT', description: 'Capteurs et paramètres en direct', tabIds: ['iot-control'] },
  { id: 'environment', label: 'Environnement', description: 'Météo et paramètres environnementaux', tabIds: ['weather'] },
  { id: 'units', label: 'Unités', description: 'Gestion des unités de production', tabIds: ['units'] },
  { id: 'infrastructure', label: 'Infrastructures', description: 'Bassins, équipements et installations', tabIds: ['infrastructures'] },
  { id: 'livestock', label: 'Cheptel / lots', description: 'Lots, biomasse et pêche', tabIds: ['livestock'] },
  { id: 'feeding', label: 'Alimentation', description: 'Nourrissage, fiches, stock et alertes aliment', tabIds: ['feeding'] },
  { id: 'aquafeed', label: 'AquaFeed AI', description: 'Calcul intelligent de la ration alimentaire', tabIds: ['aquafeed'] },
  { id: 'health', label: 'Prophylaxie', description: 'Prévention et interventions sanitaires', tabIds: ['health', 'prophylaxis'] },
  { id: 'aquahealth', label: 'AquaHealth AI', description: 'Diagnostic intelligent et recommandations sanitaires', tabIds: ['aquahealth'] },
  { id: 'production', label: 'Production', description: 'Cycles, transformation et objectifs', tabIds: ['production', 'transformation'] },
  { id: 'accounting', label: 'Comptabilité', description: 'Transactions et suivi comptable', tabIds: ['accounting'] },
  { id: 'purchases', label: 'Achats', description: 'Achats et dépenses fournisseurs', tabIds: ['purchases'] },
  { id: 'sales', label: 'Ventes', description: 'Ventes, reçus et factures', tabIds: ['sales'] },
  { id: 'suppliers', label: 'Fournisseurs', description: 'Carnet fournisseurs et commandes', tabIds: ['suppliers'] },
  { id: 'hr', label: 'Ressources humaines', description: 'Employés, salaires et paie', tabIds: ['hr'] },
  { id: 'planning', label: 'Planification', description: 'Tâches et calendrier opérationnel', tabIds: ['planning'] },
  { id: 'reports', label: 'Rapports', description: 'Rapports et exports', tabIds: ['reports'] },
  { id: 'analytics', label: 'Analyses', description: 'Analyses et indicateurs avancés', tabIds: ['analytics'] },
  { id: 'library', label: 'Bibliothèque Premium', description: 'Documents, vidéos et formations Premium', tabIds: ['library'] },
  { id: 'business-intelligence', label: 'Intelligence & Analyse', description: 'Tableau de bord BI et prévisions IA', tabIds: ['business-intelligence'] },
  { id: 'aqua-assistant', label: 'AquaAssistant', description: 'Assistant IA et recommandations', tabIds: ['aqua-assistant'] },
  { id: 'support', label: 'Support', description: 'Assistance et tickets', tabIds: ['support'] },
  { id: 'offline', label: 'Mode hors ligne', description: 'Synchronisation et cache local', tabIds: ['offline'] },
  { id: 'settings', label: 'Paramètres', description: 'Paramètres de l’application et entreprise', tabIds: ['settings'] },
  { id: 'team', label: 'Équipe', description: 'Membres, rôles et permissions', tabIds: ['team'] },
  { id: 'admin', label: 'Administration', description: 'Administration globale', tabIds: ['admin'] },
];

export const tabToModuleId = (tabId: string): string => {
  const module = APP_MODULE_PERMISSIONS.find((item) => item.tabIds.includes(tabId));
  return module?.id ?? tabId;
};

export const moduleParamToTabId = (value: string | null | undefined): string => {
  if (!value) return 'dashboard';
  if (value === 'prophylaxis') return 'health';
  if (value === 'aquahealth') return 'aquahealth';
  const direct = APP_MODULE_PERMISSIONS.find((item) => item.tabIds.includes(value));
  if (direct) return direct.tabIds[0];
  const byModule = APP_MODULE_PERMISSIONS.find((item) => item.id === value);
  return byModule?.tabIds[0] ?? value;
};

export const hasAssignedModule = (
  tabOrModuleId: string,
  hasAccessToModule: (moduleId: string) => boolean,
): boolean => ALWAYS_OPEN_MODULES.includes(tabToModuleId(tabOrModuleId)) || hasAccessToModule(tabToModuleId(tabOrModuleId));

/** Modules accessibles à tous les utilisateurs, quel que soit l'abonnement ou le rôle d'équipe. */
export const ALWAYS_OPEN_MODULES = ['business-intelligence'];

export const sanitizeModulePermissions = (permissions: Record<string, boolean> = {}) =>
  APP_MODULE_PERMISSIONS.reduce<Record<string, boolean>>((acc, module) => {
    acc[module.id] = Boolean(permissions[module.id]);
    return acc;
  }, {});