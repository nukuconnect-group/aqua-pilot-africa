import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, UserPlus, Loader2, LayoutDashboard } from 'lucide-react';
import { useLogs } from '@/contexts/LogsContext';
import { useToast } from '@/hooks/use-toast';
import { useTeamMembers, TeamMember, NewTeamMember } from '@/hooks/useTeamMembers';
import { useTeamMemberUnits, TeamMemberUnit } from '@/hooks/useTeamMemberUnits';
import { useProductionUnits } from '@/contexts/ProductionUnitsContext';
import { useSettings } from '@/contexts/SettingsContext';
import { supabase } from '@/integrations/supabase/appClient';
import { createNotification } from '@/lib/notificationService';
import { DASHBOARD_ROLE_DEFINITIONS, TeamRole } from '@/lib/dashboardRoles';
import { APP_MODULE_PERMISSIONS, sanitizeModulePermissions } from '@/lib/moduleAccess';

// Sub-components
import TeamStats from './team/TeamStats';
import TeamMemberList from './team/TeamMemberList';
import AddMemberDialog from './team/AddMemberDialog';
import SummaryDialog from './team/SummaryDialog';
import MemberDetailsDialog from './team/MemberDetailsDialog';
import CredentialsDialog from './team/CredentialsDialog';
import ResetPasswordDialog from './team/ResetPasswordDialog';
import ViewCredentialsDialog from './team/ViewCredentialsDialog';
import TeamRoleDashboard from './team/TeamRoleDashboard';

interface UnitPermissions {
  unitId: string;
  unitName: string;
  permissions: Record<string, boolean>;
}

interface CreatedCredentials {
  email: string;
  password?: string | null;
  loginUrl: string;
  memberName: string;
  emailSent: boolean;
  emailError?: string | null;
  existingUser?: boolean;
}

const TeamManagement = () => {
  const { t } = useSettings();
  const { addLog } = useLogs();
  const { toast } = useToast();
  const { teamMembers, isLoading, addTeamMember, updateTeamMember, deleteTeamMember, refetch } = useTeamMembers();
  const { units } = useProductionUnits();

  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showSummaryStep, setShowSummaryStep] = useState(false);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [selectedMemberUnits, setSelectedMemberUnits] = useState<TeamMemberUnit[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [selectedUnitsForInvite, setSelectedUnitsForInvite] = useState<Set<string>>(new Set());
  const [generatedPassword, setGeneratedPassword] = useState<string>('');
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [resetPasswordMember, setResetPasswordMember] = useState<TeamMember | null>(null);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ password: string; loginUrl: string; emailSent: boolean } | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [showMemberCredentials, setShowMemberCredentials] = useState(false);
  const [viewMemberCredentials, setViewMemberCredentials] = useState<{ member: TeamMember; loginUrl: string } | null>(null);

  const [inviteData, setInviteData] = useState<{
    name: string;
    email: string;
    password: string;
    role: string;
    customRole: string;
    department: string;
    permissions: Record<string, boolean>;
    unitPermissions: UnitPermissions[];
    dashboardRoles: TeamRole[];
  }>({
    name: '',
    email: '',
    password: '',
    role: '',
    customRole: '',
    department: '',
    permissions: {},
    unitPermissions: [],
    dashboardRoles: []
  });

  // Listes pré-remplies retirées : l'utilisateur saisit librement le poste et le département.
  const roles: { key: string; label: string }[] = [];
  const departments: { key: string; label: string }[] = [];

  const modulePermissions = APP_MODULE_PERMISSIONS;

  // --- Helpers ---
  const generatePasswordLocal = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%&*';
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];
    const allChars = uppercase + lowercase + numbers + special;
    for (let i = 0; i < 8; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return t('status_active');
      case 'inactive': return t('status_inactive');
      case 'pending': return t('status_pending');
      default: return status;
    }
  };

  // --- Unit management ---
  const loadMemberUnits = async (memberId: string) => {
    setIsLoadingUnits(true);
    try {
      const { data, error } = await supabase
        .from('team_member_units')
        .select('*')
        .eq('team_member_id', memberId);
      if (error) throw error;
      setSelectedMemberUnits((data || []).map(item => ({
        ...item,
        permissions: item.permissions as Record<string, boolean>
      })));
    } catch (error) {
      console.error('Error loading member units:', error);
    } finally {
      setIsLoadingUnits(false);
    }
  };

  const toggleUnitSelection = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit) return;
    setSelectedUnitsForInvite(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
        setInviteData(prevData => ({ ...prevData, unitPermissions: prevData.unitPermissions.filter(up => up.unitId !== unitId) }));
      } else {
        newSet.add(unitId);
        setInviteData(prevData => ({ ...prevData, unitPermissions: [...prevData.unitPermissions, { unitId: unit.id, unitName: unit.name, permissions: sanitizeModulePermissions(prevData.permissions) }] }));
      }
      return newSet;
    });
  };

  const removeUnitFromInvite = (unitId: string) => {
    setInviteData(prev => ({ ...prev, unitPermissions: prev.unitPermissions.filter(up => up.unitId !== unitId) }));
    setSelectedUnitsForInvite(prev => { const s = new Set(prev); s.delete(unitId); return s; });
  };

  const toggleUnitPermission = (unitId: string, permissionId: string) => {
    setInviteData(prev => ({
      ...prev,
      unitPermissions: prev.unitPermissions.map(up =>
        up.unitId === unitId ? { ...up, permissions: { ...up.permissions, [permissionId]: !up.permissions[permissionId] } } : up
      )
    }));
  };

  const toggleInvitePermission = (permissionId: string) => {
    setInviteData(prev => {
      const nextPermissions = sanitizeModulePermissions({ ...prev.permissions, [permissionId]: !prev.permissions[permissionId] });
      return {
        ...prev,
        permissions: nextPermissions,
        unitPermissions: prev.unitPermissions.map((unit) => ({ ...unit, permissions: nextPermissions })),
      };
    });
  };

  const toggleMemberPermission = (permissionId: string) => {
    if (!selectedMember) return;
    setSelectedMember(prev => prev ? { ...prev, permissions: { ...prev.permissions, [permissionId]: !prev.permissions[permissionId] } } : null);
  };

  const addUnitToMember = (unitId: string) => {
    const unit = units.find(u => u.id === unitId);
    if (!unit || selectedMemberUnits.some(mu => mu.unit_id === unitId)) return;
    setSelectedMemberUnits(prev => [...prev, {
      id: `temp-${Date.now()}`, team_member_id: selectedMember?.id || '', unit_id: unit.id,
      unit_name: unit.name, permissions: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }]);
  };

  const removeUnitFromMember = (unitId: string) => {
    setSelectedMemberUnits(prev => prev.filter(mu => mu.unit_id !== unitId));
  };

  const toggleMemberUnitPermission = (unitId: string, permissionId: string) => {
    setSelectedMemberUnits(prev => prev.map(mu =>
      mu.unit_id === unitId ? { ...mu, permissions: { ...mu.permissions, [permissionId]: !mu.permissions[permissionId] } } : mu
    ));
  };

  // --- Handlers ---
  const handleProceedToSummary = async () => {
    if (!inviteData.name || !inviteData.email) {
      toast({ title: t('error'), description: t('fill_required_fields'), variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteData.email)) {
      toast({ title: t('error'), description: t('invalid_email_format'), variant: "destructive" });
      return;
    }
    if (!inviteData.dashboardRoles || inviteData.dashboardRoles.length === 0) {
      toast({ title: t('error'), description: "Sélectionnez au moins un rôle pour ce membre.", variant: "destructive" });
      return;
    }
    if (Object.values(inviteData.permissions).filter(Boolean).length === 0) {
      toast({ title: t('error'), description: "Sélectionnez au moins un module autorisé pour ce membre.", variant: "destructive" });
      return;
    }
    if (inviteData.unitPermissions.length === 0) {
      toast({ title: t('error'), description: t('assign_at_least_one_unit'), variant: "destructive" });
      return;
    }
    // Automatisation : on saute l'étape intermédiaire "Créer le compte".
    // Génération sécurisée du mot de passe et création immédiate du compte avec envoi d'email.
    const finalPassword = inviteData.password || generatePasswordLocal();
    setGeneratedPassword(finalPassword);
    setInviteData(prev => ({ ...prev, password: finalPassword }));
    await handleConfirmAndCreate(true, finalPassword);
  };

  const handleConfirmAndCreate = async (sendEmail: boolean, explicitPassword?: string) => {
    setIsSubmitting(true);
    const finalRole = 'Membre';
    const newMember: NewTeamMember = {
      member_name: inviteData.name, member_email: inviteData.email,
      role: finalRole, custom_role: undefined,
      department: null as any, permissions: sanitizeModulePermissions(inviteData.permissions),
      dashboard_roles: inviteData.dashboardRoles ?? []
    };

    const result = await addTeamMember(newMember);
    if (result.success && result.data) {
      // Mettre à jour les rôles dashboard assignés (production / administration)
      try {
        await supabase
          .from('team_members')
          .update({ dashboard_roles: inviteData.dashboardRoles ?? [] } as any)
          .eq('id', result.data.id);
      } catch (e) {
        console.error('Error updating dashboard_roles:', e);
      }

      for (const unitPerm of inviteData.unitPermissions) {
        const { error: unitErr } = await supabase.from('team_member_units').insert({
          team_member_id: result.data.id, unit_id: unitPerm.unitId, unit_name: unitPerm.unitName, permissions: sanitizeModulePermissions(inviteData.permissions)
        });
        if (unitErr) console.error('Error inserting unit permission:', unitErr);
      }

      // Notification pour le propriétaire : récap des tableaux de bord assignés
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.user?.id) {
          const labels = (inviteData.dashboardRoles ?? [])
            .map(r => DASHBOARD_ROLE_DEFINITIONS[r]?.label || r)
            .join(', ') || 'Aucun';
          await createNotification({
            userId: s.user.id,
            title: 'Nouveau membre ajouté',
            message: `${inviteData.name} a été ajouté à l'équipe avec accès aux tableaux : ${labels}.`,
            type: 'success',
            module: 'team',
            metadata: { memberId: result.data.id, dashboards: inviteData.dashboardRoles }
          });
        }
      } catch (notifErr) {
        console.error('Notification creation failed:', notifErr);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Session expirée. Veuillez vous reconnecter.');
        const passwordToUse = explicitPassword || inviteData.password || generatedPassword || generatePasswordLocal();
        const response = await supabase.functions.invoke('create-team-member-account', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { email: inviteData.email, full_name: inviteData.name, team_member_id: result.data.id, password: passwordToUse, sendEmail }
        });
        // Edge function may return a non-2xx status with an error payload in data
        if (response.error) {
          const serverMsg = (response.data as any)?.error || response.error.message || 'Erreur lors de la création du compte';
          throw new Error(serverMsg);
        }

        const loginUrl = `${window.location.origin}/auth`;
        if (response.data?.existingUser || response.data?.alreadyLinked) {
          setCreatedCredentials({ email: inviteData.email, password: null, loginUrl, memberName: inviteData.name, emailSent: false, existingUser: true });
          setShowCredentialsDialog(true);
          addLog('Compte lié (utilisateur existant)', 'Équipe', `${inviteData.name} : compte existant lié`, 'info');
          toast({ title: t('existing_account'), description: t('reset_password_if_needed') });
          await refetch();
        } else if (response.data?.credentials) {
          setCreatedCredentials({
            email: response.data.credentials.email, password: response.data.credentials.password,
            loginUrl: response.data.credentials.loginUrl || loginUrl, memberName: inviteData.name,
            emailSent: response.data.emailSent || false, emailError: response.data.emailError, existingUser: false
          });
          setShowCredentialsDialog(true);
          addLog('Membre invité', 'Équipe', `${inviteData.name} invité avec compte créé`, 'success');
          toast({ title: response.data?.emailSent ? t('member_added_email_sent') : t('member_added'), description: `${t('account_created_for')} ${inviteData.name}` });
          await refetch();
        } else {
          setCreatedCredentials({ email: inviteData.email, password: passwordToUse, loginUrl, memberName: inviteData.name, emailSent: false, emailError: response.data?.emailError, existingUser: false });
          setShowCredentialsDialog(true);
          toast({ title: t('member_added'), description: `${t('account_created_for')} ${inviteData.name}.` });
          await refetch();
        }
      } catch (error: any) {
        console.error('Error creating user account:', error);
        addLog('Membre invité (sans compte)', 'Équipe', `${inviteData.name} ajouté sans compte: ${error?.message}`, 'warning');
        toast({ title: t('member_added'), description: `${inviteData.name} - ${t('account_not_created')}: ${error.message}`, variant: "destructive" });
        // Always refetch so the new (possibly orphan) member shows up and the user can retry "Créer un compte"
        await refetch();
      }

      setInviteData({ name: '', email: '', password: '', role: '', customRole: '', department: '', permissions: {}, unitPermissions: [], dashboardRoles: [] });
      setSelectedUnitsForInvite(new Set());
      setGeneratedPassword('');
      setShowSummaryStep(false);
      setShowInviteForm(false);
    } else {
      toast({ title: t('error'), description: result.error || t('unable_to_add_member'), variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleUpdateMemberPermissions = async () => {
    if (!selectedMember) return;
    if (!selectedMember.dashboard_roles || selectedMember.dashboard_roles.length === 0) {
      toast({ title: t('error'), description: "Sélectionnez au moins un rôle pour ce membre.", variant: "destructive" });
      return;
    }
    if (Object.values(selectedMember.permissions || {}).filter(Boolean).length === 0) {
      toast({ title: t('error'), description: "Sélectionnez au moins un module autorisé pour ce membre.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const cleanPermissions = sanitizeModulePermissions(selectedMember.permissions);
    const result = await updateTeamMember(selectedMember.id, {
      member_name: selectedMember.member_name, member_email: selectedMember.member_email,
      permissions: cleanPermissions, role: selectedMember.role, custom_role: selectedMember.custom_role,
      department: selectedMember.department, status: selectedMember.status
    });
    if (result.success) {
      // Persist dashboard_roles separately (not in TeamMember update typing)
      try {
        await supabase
          .from('team_members')
          .update({ dashboard_roles: selectedMember.dashboard_roles ?? [] } as any)
          .eq('id', selectedMember.id);
      } catch (e) {
        console.error('Error updating dashboard_roles:', e);
      }
      await supabase.from('team_member_units').delete().eq('team_member_id', selectedMember.id);
      for (const unitPerm of selectedMemberUnits) {
        await supabase.from('team_member_units').insert({
          team_member_id: selectedMember.id, unit_id: unitPerm.unit_id, unit_name: unitPerm.unit_name, permissions: cleanPermissions
        });
      }
      toast({ title: "Membre mis à jour", description: `Les informations de ${selectedMember.member_name} ont été mises à jour` });
      setShowMemberDetails(false);
    } else {
      toast({ title: t('error'), description: result.error || t('unable_to_update'), variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleDeleteMember = async (member: TeamMember) => {
    if (!confirm(`Êtes-vous sûr de vouloir retirer ${member.member_name} de votre équipe ?`)) return;
    const result = await deleteTeamMember(member.id);
    if (result.success) {
      addLog('Membre retiré', 'Équipe', `${member.member_name} retiré de l'équipe`, 'info');
      toast({ title: "Membre retiré", description: `${member.member_name} a été retiré de votre équipe` });
    } else {
      toast({ title: "Erreur", description: result.error || "Impossible de retirer le membre", variant: "destructive" });
    }
  };

  const handleToggleStatus = async (member: TeamMember) => {
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    const result = await updateTeamMember(member.id, { status: newStatus });
    if (result.success) {
      toast({ title: "Statut mis à jour", description: `${member.member_name} est maintenant ${newStatus === 'active' ? 'actif' : 'inactif'}` });
    }
  };

  const handleResetPassword = async (member: TeamMember, sendEmail: boolean) => {
    setIsResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expirée.');
      const response = await supabase.functions.invoke('reset-team-member-password', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { email: member.member_email, member_name: member.member_name, sendEmail }
      });
      if (response.error) throw new Error(response.error.message);
      if (response.data?.success) {
        setResetPasswordResult({ password: response.data.newPassword, loginUrl: response.data.loginUrl, emailSent: response.data.emailSent });
        addLog('Mot de passe réinitialisé', 'Équipe', `Mot de passe de ${member.member_name} réinitialisé`, 'info');
        toast({ title: response.data.emailSent ? "Mot de passe réinitialisé et email envoyé" : "Mot de passe réinitialisé" });
      } else {
        throw new Error(response.data?.error || 'Erreur inconnue');
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({ title: "Erreur", description: error.message || "Impossible de réinitialiser", variant: "destructive" });
      setShowResetPasswordDialog(false);
    }
    setIsResettingPassword(false);
  };


  const openMemberDetails = async (member: TeamMember) => {
    setSelectedMember(member);
    await loadMemberUnits(member.id);
    setShowMemberDetails(true);
  };

  const openResetPasswordDialog = (member: TeamMember) => {
    setResetPasswordMember(member);
    setResetPasswordResult(null);
    setShowResetPasswordDialog(true);
  };

  const openMemberCredentialsView = (member: TeamMember) => {
    const loginUrl = `${window.location.origin}/auth`;
    setViewMemberCredentials({ member, loginUrl });
    setShowMemberCredentials(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/90 to-primary/60 p-6 rounded-xl text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">{t('team_header_title')}</h2>
            <p className="text-primary-foreground/80">{t('team_header_subtitle')}</p>
          </div>
          <Button
            variant="outline"
            className="bg-white/20 border-white/30 text-white hover:bg-white/30"
            onClick={() => setShowInviteForm(true)}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            {t('add_member_btn')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <TeamStats
        totalMembers={teamMembers.length}
        activeMembers={teamMembers.filter(m => m.status === 'active').length}
        totalUnits={units.length}
        totalModules={modulePermissions.length}
      />

      {/* Tabs */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="w-4 h-4 mr-1.5" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="members">{t('team_members_tab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <TeamRoleDashboard
            members={teamMembers}
            modulePermissions={modulePermissions}
            onEditMember={openMemberDetails}
          />
        </TabsContent>

        <TabsContent value="members">
          <TeamMemberList
            members={teamMembers}
            onViewCredentials={openMemberCredentialsView}
            onEdit={openMemberDetails}
            onToggleStatus={handleToggleStatus}
            onResetPassword={openResetPasswordDialog}
            onDelete={handleDeleteMember}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddMemberDialog
        open={showInviteForm}
        onOpenChange={setShowInviteForm}
        inviteData={inviteData}
        setInviteData={setInviteData}
        units={units}
        selectedUnitsForInvite={selectedUnitsForInvite}
        setSelectedUnitsForInvite={setSelectedUnitsForInvite}
        modulePermissions={modulePermissions}
        isSubmitting={isSubmitting}
        onProceedToSummary={handleProceedToSummary}
        onToggleUnitSelection={toggleUnitSelection}
        onRemoveUnit={removeUnitFromInvite}
        onToggleUnitPermission={toggleUnitPermission}
        onToggleInvitePermission={toggleInvitePermission}
      />

      <SummaryDialog
        open={showSummaryStep}
        onOpenChange={setShowSummaryStep}
        inviteData={inviteData}
        generatedPassword={generatedPassword}
        setGeneratedPassword={setGeneratedPassword}
        setInviteDataPassword={(pw) => setInviteData(prev => ({ ...prev, password: pw }))}
        generatePasswordLocal={generatePasswordLocal}
        isSubmitting={isSubmitting}
        onConfirmAndCreate={handleConfirmAndCreate}
      />

      <MemberDetailsDialog
        open={showMemberDetails}
        onOpenChange={setShowMemberDetails}
        selectedMember={selectedMember}
        setSelectedMember={setSelectedMember}
        selectedMemberUnits={selectedMemberUnits}
        isLoadingUnits={isLoadingUnits}
        isSubmitting={isSubmitting}
        units={units}
        modulePermissions={modulePermissions}
        onSave={handleUpdateMemberPermissions}
        onResetPassword={openResetPasswordDialog}
        onAddUnit={addUnitToMember}
        onRemoveUnit={removeUnitFromMember}
        onToggleUnitPermission={toggleMemberUnitPermission}
        onToggleMemberPermission={toggleMemberPermission}
      />

      <CredentialsDialog
        open={showCredentialsDialog}
        onOpenChange={setShowCredentialsDialog}
        credentials={createdCredentials}
      />

      <ResetPasswordDialog
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
        member={resetPasswordMember}
        result={resetPasswordResult}
        isResetting={isResettingPassword}
        onReset={handleResetPassword}
        onClearResult={() => setResetPasswordResult(null)}
      />

      <ViewCredentialsDialog
        open={showMemberCredentials}
        onOpenChange={setShowMemberCredentials}
        member={viewMemberCredentials?.member || null}
        loginUrl={viewMemberCredentials?.loginUrl || ''}
        onResetPassword={openResetPasswordDialog}
        onEdit={openMemberDetails}
        getStatusColor={getStatusColor}
        getStatusLabel={getStatusLabel}
      />
    </div>
  );
};

export default TeamManagement;
