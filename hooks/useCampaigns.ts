import { useEffect, useState, useCallback } from 'react';
import { supabase, Campaign } from '@/lib/supabase';

export function useCampaigns(clientId: string | undefined) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else setCampaigns(data ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return { campaigns, loading, error, refresh: fetchCampaigns };
}
