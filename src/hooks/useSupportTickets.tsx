import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SupportTicket {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  subject: string;
  category: string;
  message: string;
  status: string;
  priority: string;
  admin_response: string | null;
  responded_at: string | null;
  responded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_name: string;
  sender_type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const useSupportTickets = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data as SupportTicket[]) || []);
    } catch (err) {
      console.error('Error fetching support tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as SupportMessage[]) || []);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  const createTicket = async (data: {
    subject: string;
    category: string;
    message: string;
    priority?: string;
  }) => {
    if (!user?.id || !user?.email) return null;

    const userName = (user as unknown as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name || user.email;

    try {
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          user_email: user.email,
          user_name: userName,
          subject: data.subject,
          category: data.category,
          message: data.message,
          priority: data.priority || 'normal'
        })
        .select()
        .single();

      if (error) throw error;

      // Créer le premier message
      await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          sender_name: userName,
          sender_type: 'user',
          message: data.message
        });

      toast({
        title: "Ticket créé",
        description: "Votre demande de support a été envoyée"
      });

      await fetchTickets();
      return ticket;
    } catch (err) {
      console.error('Error creating ticket:', err);
      toast({
        title: "Erreur",
        description: "Impossible de créer le ticket",
        variant: "destructive"
      });
      return null;
    }
  };

  const sendMessage = async (ticketId: string, message: string) => {
    if (!user?.id) return false;

    const userName = (user as unknown as { user_metadata?: { full_name?: string } })?.user_metadata?.full_name || user.email || 'Utilisateur';

    try {
      const { error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: user.id,
          sender_name: userName,
          sender_type: user.role === 'admin' ? 'admin' : 'user',
          message
        });

      if (error) throw error;
      await fetchMessages(ticketId);
      return true;
    } catch (err) {
      console.error('Error sending message:', err);
      return false;
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string, response?: string) => {
    if (!user?.id) return false;

    try {
      const updateData: Record<string, unknown> = { status };
      
      if (response) {
        updateData.admin_response = response;
        updateData.responded_at = new Date().toISOString();
        updateData.responded_by = user.id;
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData as never)
        .eq('id', ticketId);

      if (error) throw error;
      await fetchTickets();
      return true;
    } catch (err) {
      console.error('Error updating ticket:', err);
      return false;
    }
  };

  const markMessagesAsRead = async (ticketId: string) => {
    if (!user?.id) return;

    try {
      await supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('ticket_id', ticketId)
        .neq('sender_id', user.id);
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime subscription for tickets AND messages (instant messaging)
  useEffect(() => {
    if (!user?.id) return;

    // Channel for tickets changes
    const ticketsChannel = supabase
      .channel(`support_tickets_realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'support_tickets' },
        (payload) => {
          fetchTickets();
          if (
            payload.eventType === 'INSERT' &&
            user?.role === 'admin' &&
            (payload.new as any)?.user_id !== user.id
          ) {
            const t = payload.new as any;
            toast({
              title: '🔔 Nouveau ticket de support',
              description: `${t.user_name || t.user_email} : ${t.subject}`,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketsChannel);
    };
  }, [user?.id, user?.role, fetchTickets, toast]);

  // Separate channel for messages - instant updates
  const [currentTicketIdForRealtime, setCurrentTicketIdForRealtime] = useState<string | null>(null);

  const subscribeToMessages = useCallback((ticketId: string) => {
    setCurrentTicketIdForRealtime(ticketId);
  }, []);

  useEffect(() => {
    if (!user?.id || !currentTicketIdForRealtime) return;

    const messagesChannel = supabase
      .channel(`support_messages_${currentTicketIdForRealtime}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'support_messages',
          filter: `ticket_id=eq.${currentTicketIdForRealtime}`
        },
        (payload) => {
          // Add the new message instantly without refetching all
          setMessages((prev) => {
            const newMsg = payload.new as SupportMessage;
            // Avoid duplicates
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
    };
  }, [user?.id, currentTicketIdForRealtime]);

  const unreadTicketsCount = tickets.filter(t => 
    t.status === 'open' && user?.role === 'admin'
  ).length;

  // Wrap fetchMessages to also subscribe to realtime updates for that ticket
  const fetchMessagesAndSubscribe = useCallback(async (ticketId: string) => {
    await fetchMessages(ticketId);
    subscribeToMessages(ticketId);
  }, [fetchMessages, subscribeToMessages]);

  return {
    tickets,
    messages,
    loading,
    unreadTicketsCount,
    createTicket,
    sendMessage,
    updateTicketStatus,
    fetchMessages: fetchMessagesAndSubscribe,
    markMessagesAsRead,
    refetch: fetchTickets
  };
};
