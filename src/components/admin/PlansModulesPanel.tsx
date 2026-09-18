import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, Layers, ShieldCheck, History, Crown, RefreshCw, Users, Building2, RotateCcw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useModuleAccess } from '@/contexts/ModuleAccessContext';
import {
  MANAGED_ROLES,
  MODULE_ACTIONS,
  MODULE_CATALOG,
  NO_PERMISSIONS,
  ROLE_LABELS,
  type AuditEntry,
  type ModuleAction,
  type PlanConfig,
  type UnitModuleRules,
  type UserModuleOverrides,
  DEFAULT_UNIT_MODULE_RULES,
  UNIT_TYPE_LABELS,
  loadAuditEntries,
  loadUnitModuleRules,
  loadUserModuleOverrides,
  resetUserModuleOverrides,
  savePlanConfig,
  saveUnitModuleRules,
  saveUserModuleOverrides,
} from '@/lib/planModules';
import { supabase } from '@/integrations/supabase/appClient';
import type { ProductionUnitType } from '@/contexts/ProductionUnitsContext';

interface AdminModuleUser { id: string; email: string; fullName: string; role: string; }

const PlansModulesPanel: React.FC<{ users: AdminModuleUser[] }> = ({ users }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { plans, source, refresh, isLoading } = useModuleAccess();

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [draft, setDraft] = useState<PlanConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userOverrides, setUserOverrides] = useState<UserModuleOverrides>({});
  const [selectedUserPlan, setSelectedUserPlan] = useState('free');
  const [selectedUserUnits, setSelectedUserUnits] = useState<ProductionUnitType[]>([]);
  const [unitRules, setUnitRules] = useState<UnitModuleRules>(structuredClone(DEFAULT_UNIT_MODULE_RULES));
  const [savingUser, setSavingUser] = useState(false);
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    if (!plans.length) return;
    const key = selectedKey && plans.some((p) => p.key === selectedKey) ? selectedKey : plans[0].key;
    if (key !== selectedKey) setSelectedKey(key);
    const plan = plans.find((p) => p.key === key) || null;
    setDraft(plan ? JSON.parse(JSON.stringify(plan)) : null);
  }, [plans, selectedKey]);

  useEffect(() => {
    loadAuditEntries().then(setAudit);
    loadUnitModuleRules().then(setUnitRules);
  }, []);

  useEffect(() => {
    if (!selectedUserId) return;
    Promise.all([
      loadUserModuleOverrides(selectedUserId),
      (supabase as any).from('subscriptions').select('plan').eq('user_id', selectedUserId).in('status', ['active', 'trial']).order('end_date', { ascending: false }).limit(1).maybeSingle(),
      (supabase as any).from('production_units').select('type').eq('user_id', selectedUserId),
    ]).then(([overrides, subscriptionResult, unitsResult]) => {
      setUserOverrides(overrides);
      const rawPlan = subscriptionResult.data?.plan || 'free';
      const aliases: Record<string, string> = { trial_discovery: 'professional', annual_basic: 'standard', annual_pro: 'professional', annual_enterprise: 'enterprise', annual: 'professional', monthly: 'standard' };
      setSelectedUserPlan(aliases[rawPlan] || rawPlan);
      setSelectedUserUnits(Array.from(new Set(((unitsResult.data || []) as { type: ProductionUnitType }[]).map((row) => row.type))));
    });
  }, [selectedUserId]);

  const original = useMemo(() => plans.find((p) => p.key === selectedKey) || undefined, [plans, selectedKey]);

  const categories = useMemo(() => {
    const map = new Map<string, typeof MODULE_CATALOG>();
    MODULE_CATALOG.forEach((module) => {
      map.set(module.category, [...(map.get(module.category) || []), module]);
    });
    return Array.from(map.entries());
  }, []);

  const toggleModule = (moduleKey: string, enabled: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      const modules = enabled
        ? Array.from(new Set([...current.modules, moduleKey]))
        : current.modules.filter((key) => key !== moduleKey);
      return { ...current, modules };
    });
  };

  const togglePermission = (role: string, moduleKey: string, action: ModuleAction, value: boolean) => {
    setDraft((current) => {
      if (!current) return current;
      const rolePermissions = { ...current.rolePermissions };
      const moduleMap = { ...(rolePermissions[role] || {}) };
      moduleMap[moduleKey] = { ...NO_PERMISSIONS, ...(moduleMap[moduleKey] || {}), [action]: value };
      rolePermissions[role] = moduleMap;
      return { ...current, rolePermissions };
    });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    const result = await savePlanConfig(draft, {
      adminEmail: user?.email || 'admin',
      previous: original,
    });
    setSaving(false);
    await refresh();
    setAudit(await loadAuditEntries());
    toast({
      title: 'Abonnement mis à jour',
      description:
        result.source === 'remote'
          ? 'Les nouvelles permissions sont appliquées immédiatement.'
          : "Enregistré localement : les tables plans/plan_modules ne sont pas encore créées dans la base.",
    });
  };

  const filteredAdminUsers = useMemo(() => {
    const needle = userSearch.trim().toLowerCase();
    return needle ? users.filter((item) => `${item.fullName} ${item.email}`.toLowerCase().includes(needle)) : users;
  }, [userSearch, users]);
  const selectedUser = users.find((item) => item.id === selectedUserId);
  const selectedPlan = plans.find((plan) => plan.key === selectedUserPlan) || plans.find((plan) => plan.key === 'free');
  const handleSaveUser = async () => {
    if (!selectedUserId) return;
    setSavingUser(true);
    const result = await saveUserModuleOverrides(selectedUserId, userOverrides, user?.email || 'admin');
    setSavingUser(false);
    toast({ title: 'Accès utilisateur mis à jour', description: result === 'remote' ? 'Les restrictions sont appliquées immédiatement.' : 'Restrictions enregistrées localement en attente des tables distantes.' });
  };
  const handleResetUser = async () => {
    if (!selectedUserId) return;
    await resetUserModuleOverrides(selectedUserId);
    setUserOverrides({});
    toast({ title: 'Droits hérités restaurés', description: "L’utilisateur suit de nouveau son abonnement et son unité active." });
  };
  const toggleUnitRule = (type: ProductionUnitType, moduleKey: string, enabled: boolean) => setUnitRules((current) => ({ ...current, [type]: enabled ? Array.from(new Set([...current[type], moduleKey])) : current[type].filter((key) => key !== moduleKey) }));
  const handleSaveRules = async () => {
    setSavingRules(true);
    const result = await saveUnitModuleRules(unitRules);
    setSavingRules(false);
    toast({ title: 'Compatibilité des unités mise à jour', description: result === 'remote' ? 'Les menus sont recalculés immédiatement.' : 'Règles enregistrées localement en attente des tables distantes.' });
  };

  if (isLoading && !draft) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des abonnements…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Résumé */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Plans actifs</p>
            <p className="text-2xl font-bold">{plans.filter((p) => p.isActive).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Modules disponibles</p>
            <p className="text-2xl font-bold">{MODULE_CATALOG.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Modules premium</p>
            <p className="text-2xl font-bold">{MODULE_CATALOG.filter((m) => m.isPremium).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Stockage config.</p>
            <p className="text-sm font-semibold">{source === 'remote' ? 'Base de données' : 'Local (temporaire)'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sélection du plan */}
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => (
          <Button
            key={plan.key}
            variant={plan.key === selectedKey ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedKey(plan.key)}
          >
            {plan.name}
            <Badge variant="secondary" className="ml-2">{plan.modules.length}</Badge>
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => refresh()}>
          <RefreshCw className="w-4 h-4 mr-1" /> Actualiser
        </Button>
      </div>

      {draft && (
        <Tabs defaultValue="modules" className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start">
            <TabsTrigger value="modules"><Layers className="w-4 h-4 mr-1" /> Modules inclus</TabsTrigger>
            <TabsTrigger value="permissions"><ShieldCheck className="w-4 h-4 mr-1" /> Permissions par rôle</TabsTrigger>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" /> Utilisateurs</TabsTrigger>
            <TabsTrigger value="units"><Building2 className="w-4 h-4 mr-1" /> Types d’unités</TabsTrigger>
            <TabsTrigger value="audit"><History className="w-4 h-4 mr-1" /> Journal d'audit</TabsTrigger>
          </TabsList>

          <TabsContent value="modules" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Abonnement : {draft.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label>Nom du plan</Label>
                    <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                  </div>
                  <div>
                    <Label>Prix</Label>
                    <Input
                      type="number"
                      value={draft.price}
                      onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Switch
                      checked={draft.isActive}
                      onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })}
                    />
                    <span className="text-sm">Plan actif</span>
                  </div>
                </div>

                {categories.map(([category, modules]) => (
                  <div key={category} className="space-y-2">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {modules.map((module) => (
                        <div
                          key={module.key}
                          className="flex items-center justify-between gap-3 rounded-md border p-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">{module.name}</span>
                              {module.isPremium && <Crown className="w-3 h-3 text-amber-500" />}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{module.key}</p>
                          </div>
                          <Switch
                            checked={draft.modules.includes(module.key)}
                            disabled={module.isCore}
                            onCheckedChange={(checked) => toggleModule(module.key, checked)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Restrictions par utilisateur</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2"><div><Label>Rechercher</Label><Input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Nom ou e-mail" /></div><div><Label>Utilisateur</Label><Select value={selectedUserId} onValueChange={setSelectedUserId}><SelectTrigger><SelectValue placeholder="Sélectionner un compte" /></SelectTrigger><SelectContent>{filteredAdminUsers.map((item) => <SelectItem key={item.id} value={item.id}>{item.fullName} — {item.email}</SelectItem>)}</SelectContent></Select></div></div>
              {selectedUser && selectedPlan && <><div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">{selectedPlan.name}</Badge><Badge variant="secondary">{selectedUser.role}</Badge>{selectedUserUnits.map((type) => <Badge key={type}>{UNIT_TYPE_LABELS[type]}</Badge>)}</div><p className="text-sm text-muted-foreground">Une autorisation individuelle ne dépasse jamais les modules compris dans l’abonnement. La compatibilité de l’unité active s’applique ensuite.</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{MODULE_CATALOG.map((module) => { const included = selectedPlan.modules.includes(module.key); const value = userOverrides[module.key] === false ? 'blocked' : userOverrides[module.key] === true ? 'allowed' : 'inherit'; return <div key={module.key} className="flex items-center justify-between gap-3 rounded-md border p-3"><div className="min-w-0"><p className="font-medium truncate">{module.name}</p><p className="text-xs text-muted-foreground">{included ? 'Inclus au plan' : 'Absent du plan'}</p></div><Select value={value} disabled={module.isCore || !included} onValueChange={(next) => setUserOverrides((current) => { const copy = { ...current }; if (next === 'inherit') delete copy[module.key]; else copy[module.key] = next === 'allowed'; return copy; })}><SelectTrigger className="w-[118px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inherit">Hérité</SelectItem><SelectItem value="allowed">Autorisé</SelectItem><SelectItem value="blocked">Bloqué</SelectItem></SelectContent></Select></div>; })}</div><div className="flex flex-wrap gap-2"><Button onClick={handleSaveUser} disabled={savingUser}>{savingUser ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Enregistrer</Button><Button variant="outline" onClick={handleResetUser}><RotateCcw className="w-4 h-4 mr-2" />Réinitialiser</Button></div></>}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="units" className="space-y-4">
            <Card><CardHeader className="pb-3"><CardTitle className="text-lg">Modules compatibles par type d’unité</CardTitle></CardHeader><CardContent className="space-y-4 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Module</TableHead>{(Object.keys(UNIT_TYPE_LABELS) as ProductionUnitType[]).map((type) => <TableHead key={type} className="min-w-[120px] text-center">{UNIT_TYPE_LABELS[type]}</TableHead>)}</TableRow></TableHeader><TableBody>{MODULE_CATALOG.map((module) => <TableRow key={module.key}><TableCell className="whitespace-nowrap font-medium">{module.name}</TableCell>{(Object.keys(UNIT_TYPE_LABELS) as ProductionUnitType[]).map((type) => <TableCell key={type} className="text-center"><Checkbox checked={module.isCore || unitRules[type].includes(module.key)} disabled={module.isCore} onCheckedChange={(checked) => toggleUnitRule(type, module.key, Boolean(checked))} /></TableCell>)}</TableRow>)}</TableBody></Table><Button onClick={handleSaveRules} disabled={savingRules}>{savingRules ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Enregistrer la matrice</Button></CardContent></Card>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Permissions par rôle — {draft.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 overflow-x-auto">
                {MANAGED_ROLES.map((role) => (
                  <div key={role} className="space-y-2">
                    <p className="font-semibold">{ROLE_LABELS[role]}</p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Module</TableHead>
                          {MODULE_ACTIONS.map((action) => (
                            <TableHead key={action.id} className="text-center">{action.label}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {MODULE_CATALOG.filter((module) => draft.modules.includes(module.key)).map((module) => (
                          <TableRow key={module.key}>
                            <TableCell className="whitespace-nowrap">{module.name}</TableCell>
                            {MODULE_ACTIONS.map((action) => (
                              <TableCell key={action.id} className="text-center">
                                <Checkbox
                                  checked={Boolean(draft.rolePermissions[role]?.[module.key]?.[action.id])}
                                  onCheckedChange={(checked) =>
                                    togglePermission(role, module.key, action.id, Boolean(checked))
                                  }
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Historique des modifications</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Module</TableHead>
                        <TableHead>Changement</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audit.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleString('fr-FR')}
                          </TableCell>
                          <TableCell>{entry.admin_email}</TableCell>
                          <TableCell>{entry.plan_key}</TableCell>
                          <TableCell>{entry.module_key}</TableCell>
                          <TableCell className="text-sm">
                            {entry.action} : {entry.before_value} → {entry.after_value}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default PlansModulesPanel;
