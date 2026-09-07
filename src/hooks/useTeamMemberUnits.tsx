import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useToast } from '@/hooks/use-toast';

export interface TeamMemberUnit {
  id: string;
  team_member_id: string;
  unit_id: string;
  unit_name: string;
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface NewTeamMemberUnit {
  team_member_id: string;
  unit_id: string;
  unit_name: string;
  permissions: Record<string, boolean>;
}

export const useTeamMemberUnits = (teamMemberId?: string) => {
  const [memberUnits, setMemberUnits] = useState<TeamMemberUnit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const fetchMemberUnits = async (memberId?: string) => {
    const targetId = memberId || teamMemberId;
    if (!targetId) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_member_units')
        .select('*')
        .eq('team_member_id', targetId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setMemberUnits((data || []).map(item => ({
        ...item,
        permissions: item.permissions as Record<string, boolean>
      })));
    } catch (error: any) {
      console.error('Error fetching member units:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addMemberUnit = async (unit: NewTeamMemberUnit) => {
    try {
      const { data, error } = await supabase
        .from('team_member_units')
        .insert({
          team_member_id: unit.team_member_id,
          unit_id: unit.unit_id,
          unit_name: unit.unit_name,
          permissions: unit.permissions
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return { success: false, error: 'Cette unité est déjà assignée à ce membre' };
        }
        throw error;
      }

      setMemberUnits(prev => [{
        ...data,
        permissions: data.permissions as Record<string, boolean>
      }, ...prev]);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Error adding member unit:', error);
      return { success: false, error: error.message };
    }
  };

  const updateMemberUnit = async (id: string, updates: Partial<TeamMemberUnit>) => {
    try {
      const { data, error } = await supabase
        .from('team_member_units')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setMemberUnits(prev => prev.map(u => 
        u.id === id ? {
          ...data,
          permissions: data.permissions as Record<string, boolean>
        } : u
      ));
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating member unit:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteMemberUnit = async (id: string) => {
    try {
      const { error } = await supabase
        .from('team_member_units')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setMemberUnits(prev => prev.filter(u => u.id !== id));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting member unit:', error);
      return { success: false, error: error.message };
    }
  };

  const bulkAddMemberUnits = async (units: NewTeamMemberUnit[]) => {
    try {
      const { data, error } = await supabase
        .from('team_member_units')
        .insert(units.map(u => ({
          team_member_id: u.team_member_id,
          unit_id: u.unit_id,
          unit_name: u.unit_name,
          permissions: u.permissions
        })))
        .select();

      if (error) throw error;

      setMemberUnits(prev => [
        ...(data || []).map(item => ({
          ...item,
          permissions: item.permissions as Record<string, boolean>
        })),
        ...prev
      ]);
      
      return { success: true, data };
    } catch (error: any) {
      console.error('Error bulk adding member units:', error);
      return { success: false, error: error.message };
    }
  };

  const deleteAllMemberUnits = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_member_units')
        .delete()
        .eq('team_member_id', memberId);

      if (error) throw error;

      setMemberUnits(prev => prev.filter(u => u.team_member_id !== memberId));
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting all member units:', error);
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    if (teamMemberId) {
      fetchMemberUnits();
    }
  }, [teamMemberId]);

  return {
    memberUnits,
    isLoading,
    addMemberUnit,
    updateMemberUnit,
    deleteMemberUnit,
    bulkAddMemberUnits,
    deleteAllMemberUnits,
    refetch: fetchMemberUnits
  };
};
