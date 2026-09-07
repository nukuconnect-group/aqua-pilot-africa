import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/appClient';
import { useAuth } from '@/contexts/AuthContext';

export interface AquaMessage {
  role: 'user' | 'assistant';
  content: string;
  category?: string;
  unitId?: string;
  unitName?: string | null;
  createdAt?: string;
}

export interface AquaConversation {
  id: string;
  title: string;
  unit_id: string | null;
  unit_name: string | null;
  last_category: string | null;
  messages: AquaMessage[];
  created_at: string;
  updated_at: string;
}

const buildTitle = (messages: AquaMessage[]) => {
  const firstUser = messages.find((m) => m.role === 'user' && m.content.trim());
  if (!firstUser) return 'Nouvelle conversation';
  const c = firstUser.content.replace(/\s+/g, ' ').trim();
  return c.length > 52 ? `${c.slice(0, 52)}…` : c;
};

export const useAquaAssistantConversations = (greeting: string) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AquaConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setConversations([]);
      setActiveId(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('aqua_assistant_conversations')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(50);
    if (!error && data) {
      const list = data.map((c: any) => ({
        ...c,
        messages: Array.isArray(c.messages) ? (c.messages as AquaMessage[]) : [],
      })) as AquaConversation[];
      setConversations(list);
      if (list.length > 0) setActiveId((prev) => prev ?? list[0].id);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  const startNew = useCallback(
    async (unit?: { id?: string | null; name?: string | null }) => {
      if (!user) return null;
      const initial: AquaMessage[] = [
        { role: 'assistant', content: greeting, createdAt: new Date().toISOString() },
      ];
      const { data, error } = await supabase
        .from('aqua_assistant_conversations')
        .insert({
          user_id: user.id,
          title: 'Nouvelle conversation',
          unit_id: unit?.id ?? null,
          unit_name: unit?.name ?? null,
          messages: initial as any,
        })
        .select('*')
        .single();
      if (!error && data) {
        const conv = { ...data, messages: initial } as AquaConversation;
        setConversations((prev) => [conv, ...prev]);
        setActiveId(conv.id);
        return conv;
      }
      return null;
    },
    [greeting, user],
  );

  const persistMessages = useCallback(
    async (conversationId: string, messages: AquaMessage[], category?: string | null) => {
      const title = buildTitle(messages);
      const lastCategory =
        [...messages].reverse().find((m) => m.category)?.category ?? category ?? null;
      const updatedAt = new Date().toISOString();
      setConversations((prev) =>
        prev
          .map((c) =>
            c.id === conversationId
              ? { ...c, messages, title, last_category: lastCategory, updated_at: updatedAt }
              : c,
          )
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
      );
      await supabase
        .from('aqua_assistant_conversations')
        .update({
          messages: messages as any,
          title,
          last_category: lastCategory,
          updated_at: updatedAt,
        })
        .eq('id', conversationId);
    },
    [],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await supabase.from('aqua_assistant_conversations').delete().eq('id', id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId],
  );

  const clearAll = useCallback(async () => {
    if (!user) return;
    await supabase.from('aqua_assistant_conversations').delete().eq('user_id', user.id);
    setConversations([]);
    setActiveId(null);
  }, [user]);

  return {
    loading,
    conversations,
    activeConversation,
    activeId,
    setActiveId,
    startNew,
    persistMessages,
    deleteConversation,
    clearAll,
    refresh: fetchAll,
  };
};