import { useEffect, useState, useCallback } from 'react';
import { supabase, Lead } from '@/lib/supabase';

export function useLeads(clientId: string | undefined) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setLeads(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function updateLeadStatus(id: string, status: Lead['status']) {
    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', id);

    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
    }
    return error;
  }

  async function updateLeadNotes(id: string, notes: string) {
    const { error } = await supabase
      .from('leads')
      .update({ notes })
      .eq('id', id);

    if (!error) {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, notes } : l));
    }
    return error;
  }

  return { leads, loading, error, refresh: fetchLeads, updateLeadStatus, updateLeadNotes };
}
