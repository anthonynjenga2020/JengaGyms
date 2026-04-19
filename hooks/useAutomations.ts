import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MockAutomation } from '@/lib/mockAutomations';

function dbToMock(row: Record<string, unknown>): MockAutomation {
  return {
    id: row.id as string,
    name: row.name as string,
    emoji: row.emoji as string,
    iconColor: row.icon_color as string,
    trigger: row.trigger as string,
    actionSummary: (row.action_summary as string) ?? '',
    statsText: (row.stats_text as string) ?? '',
    active: row.active as boolean,
  };
}

export function useAutomations(clientId?: string) {
  const [automations, setAutomations] = useState<MockAutomation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    const { data } = await supabase
      .from('automations')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true });
    setAutomations((data ?? []).map(dbToMock));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function toggleAutomation(id: string, active: boolean) {
    setAutomations(prev => prev.map(a => a.id === id ? { ...a, active } : a));
    await supabase.from('automations').update({ active }).eq('id', id);
  }

  async function createAutomation(data: MockAutomation, triggerDays?: number): Promise<MockAutomation | null> {
    if (!clientId) return null;
    const { data: row, error } = await supabase
      .from('automations')
      .insert({
        client_id: clientId,
        name: data.name,
        emoji: data.emoji,
        icon_color: data.iconColor,
        trigger: data.trigger,
        trigger_days: triggerDays ?? null,
        action_summary: data.actionSummary,
        stats_text: data.statsText,
        active: data.active,
      })
      .select()
      .single();
    if (error || !row) return null;
    const mock = dbToMock(row as Record<string, unknown>);
    setAutomations(prev => [mock, ...prev]);
    return mock;
  }

  return { automations, loading, toggleAutomation, createAutomation, refresh };
}
