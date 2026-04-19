import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { MockBroadcast } from '@/lib/mockBroadcasts';

function dbToMock(row: Record<string, unknown>): MockBroadcast {
  return {
    id: row.id as string,
    recipientLabel: row.recipient_label as string,
    message: row.message as string,
    status: row.status as MockBroadcast['status'],
    sentAt: (row.sent_at as string) ?? undefined,
    scheduledAt: (row.scheduled_at as string) ?? undefined,
    recipientCount: row.recipient_count as number,
    recipients: [],
  };
}

export function useBroadcasts(clientId?: string) {
  const [broadcasts, setBroadcasts] = useState<MockBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!clientId) { setLoading(false); return; }
    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    setBroadcasts((data ?? []).map(dbToMock));
    setLoading(false);
  }, [clientId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function createBroadcast(broadcast: MockBroadcast) {
    if (!clientId) return;
    const { data: row, error } = await supabase
      .from('broadcasts')
      .insert({
        client_id: clientId,
        recipient_label: broadcast.recipientLabel,
        message: broadcast.message,
        status: broadcast.status,
        sent_at: broadcast.sentAt ?? null,
        scheduled_at: broadcast.scheduledAt ?? null,
        recipient_count: broadcast.recipientCount,
      })
      .select()
      .single();
    if (!error && row) {
      setBroadcasts(prev => [dbToMock(row as Record<string, unknown>), ...prev]);
    }
  }

  async function cancelBroadcast(id: string) {
    setBroadcasts(prev => prev.filter(b => b.id !== id));
    await supabase.from('broadcasts').delete().eq('id', id);
  }

  return { broadcasts, loading, createBroadcast, cancelBroadcast, refresh };
}
