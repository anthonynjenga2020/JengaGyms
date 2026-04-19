import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { router } from 'expo-router';
import { supabase, Client } from '@/lib/supabase';

type ClientContextValue = {
  client: Client | null;
  clientId: string | undefined;
  loading: boolean;
  refetch: () => Promise<void>;
  updateClient: (patch: Partial<Client>) => Promise<void>;
};

const ClientContext = createContext<ClientContextValue>({
  client: null,
  clientId: undefined,
  loading: true,
  refetch: async () => {},
  updateClient: async () => {},
});

export function useClientContext() {
  return useContext(ClientContext);
}

export function ClientProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchClient() {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('owner_user_id', userId)
      .single();

    if (!error && data) {
      setClient(data as Client);
      // New user: stub row has empty gym_name → redirect to onboarding
      if (!data.gym_name) {
        router.replace('/(onboarding)/setup');
      }
    }
    setLoading(false);
  }

  useEffect(() => { fetchClient(); }, [userId]);

  async function refetch() {
    setLoading(true);
    await fetchClient();
  }

  async function updateClient(patch: Partial<Client>) {
    if (!client) return;
    const { data, error } = await supabase
      .from('clients')
      .update(patch)
      .eq('id', client.id)
      .select()
      .single();
    if (!error && data) setClient(data as Client);
  }

  return (
    <ClientContext.Provider value={{ client, clientId: client?.id, loading, refetch, updateClient }}>
      {children}
    </ClientContext.Provider>
  );
}
