import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { TeamRole } from '@/lib/dashboardRoles';

export interface TeamMember {
  id: string;
  owner_id: string;
  member_email: string;
  member_name: string;
  role: string;
  custom_role: string | null;
  department: string | null;
  status: 'active' | 'inactive' | 'pending';
  permissions: Record<string, boolean>;
  invited_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string | null; // Auth user ID - null if account not created
  dashboard_roles?: TeamRole[];
}

export interface NewTeamMember {
  member_email: string;
  member_name: string;
  role: string;
  custom_role?: string;
  department: string;
  permissions: Record<string, boolean>;
  dashboard_roles?: TeamRole[];
}

export const useTeamMembers = () => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTeamMembers = async () => {
    if (!user?.id) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTeamMembers((data || []).map(item => ({
        ...item,
        permissions: item.permissions as Record<string, boolean>,
        status: item.status as 'active' | 'inactive' | 'pending',
        custom_role: (item as any).custom_role || null,
        user_id: item.user_id || null,
        dashboard_roles: ((item as any).dashboard_roles || []) as TeamRole[]
      })));
    } catch (error: any) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les membres de l'équipe",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTeamMember = async (member: NewTeamMember) => {
    if (!user?.id) return { success: false, error: 'Non authentifié' };

    // Ensure we have a real Supabase session (prevents RLS errors in demo/expired sessions)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      return { success: false, error: 'Session expirée. Veuillez vous reconnecter.' };
    }

    try {
      const { data, error } = await supabase
        .from('team_members')
        .insert({
          owner_id: session.user.id,
          member_email: member.member_email.toLowerCase().trim(),
          member_name: member.member_name.trim(),
          role: member.role,
          custom_role: member.custom_role || null,
          department: member.department,
          permissions: member.permissions,
          status: 'active',
          dashboard_roles: member.dashboard_roles || []
        } as any)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Ce membre existe déjà dans votre équipe' };
        }
        throw error;
      }

      setTeamMembers(prev => [{
        ...data,
        permissions: data.permissions as Record<string, boolean>,
        status: data.status as 'active' | 'inactive' | 'pending',
        custom_role: (data as any).custom_role || null,
        user_id: data.user_id || null,
        dashboard_roles: ((data as any).dashboard_roles || []) as TeamRole[]
      }, ...prev]);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding team member:', error);
      return { success: false, error: error.message };
    }
  };

  const updateTeamMember = async (id: string, updates: Partial<TeamMember>) => {
    try {
      const { data, error } = await supabase
        .from('team_members')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setTeamMembers(prev => prev.map(m => 
        m.id === id ? {
          ...data,
          permissions: data.permissions as Record<string, boolean>,
          status: data.status as 'active' | 'inactive' | 'pending',
          custom_role: (data as any).custom_role || null,
          user_id: data.user_id || null,
          dashboard_roles: ((data as any).dashboard_roles || []) as TeamRole[]
        } : m
      ));
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating team member:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteTeamMember = async (id: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTeamMembers(prev => prev.filter(m => m.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting team member:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, [user?.id]);

  return {
    teamMembers,
    isLoading,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    refetch: fetchTeamMembers
  };
};
