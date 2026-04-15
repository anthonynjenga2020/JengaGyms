import { useEffect, useState } from 'react';
import { supabase, Client } from '@/lib/supabase';

export function useClient() {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClient() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('owner_user_id', user.id)
        .single();

      if (error) setError(error.message);
      else setClient(data);
      setLoading(false);
    }

    fetchClient();
  }, []);

  return { client, loading, error };
}
