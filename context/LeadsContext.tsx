import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useClientContext } from '@/context/ClientContext';
import type { LeadStage, LeadSource, LeadInterest } from '@/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppLead = {
  id: string;
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: LeadSource;
  status: LeadStage;
  interests: LeadInterest[];
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LeadActivity = {
  id: string;
  lead_id: string;
  client_id: string;
  type: 'lead_created' | 'stage_changed' | 'note_added' | 'call_made' | 'trial_booked';
  description: string;
  created_at: string;
};

type State = {
  leads: AppLead[];
  loading: boolean;
};

type Action =
  | { type: 'SET_LEADS'; leads: AppLead[] }
  | { type: 'ADD_LEAD'; lead: AppLead }
  | { type: 'UPDATE_LEAD'; id: string; updates: Partial<AppLead> }
  | { type: 'DELETE_LEAD'; id: string }
  | { type: 'SET_LOADING'; loading: boolean };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LEADS':
      return { ...state, leads: action.leads, loading: false };
    case 'ADD_LEAD':
      return { ...state, leads: [action.lead, ...state.leads] };
    case 'UPDATE_LEAD':
      return {
        ...state,
        leads: state.leads.map(l =>
          l.id === action.id ? { ...l, ...action.updates, updated_at: new Date().toISOString() } : l
        ),
      };
    case 'DELETE_LEAD':
      return { ...state, leads: state.leads.filter(l => l.id !== action.id) };
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type LeadsContextType = {
  leads: AppLead[];
  loading: boolean;
  addLead: (lead: Omit<AppLead, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateLead: (id: string, updates: Partial<AppLead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  getLead: (id: string) => AppLead | undefined;
  fetchLeadActivities: (leadId: string) => Promise<LeadActivity[]>;
};

const LeadsContext = createContext<LeadsContextType | null>(null);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const { clientId } = useClientContext();
  const [state, dispatch] = useReducer(reducer, { leads: [], loading: true });

  const fetchLeads = useCallback(async () => {
    if (!clientId) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (data) dispatch({ type: 'SET_LEADS', leads: data as AppLead[] });
  }, [clientId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function addLead(data: Omit<AppLead, 'id' | 'created_at' | 'updated_at'>) {
    const { data: row, error } = await supabase
      .from('leads')
      .insert({ ...data, client_id: clientId })
      .select()
      .single();
    if (error || !row) return;
    dispatch({ type: 'ADD_LEAD', lead: row as AppLead });
    // Auto-log lead_created activity
    await supabase.from('lead_activities').insert({
      lead_id: row.id,
      client_id: clientId,
      type: 'lead_created',
      description: `Lead created from ${data.source}`,
    });
  }

  async function updateLead(id: string, updates: Partial<AppLead>) {
    const prev = state.leads.find(l => l.id === id);
    dispatch({ type: 'UPDATE_LEAD', id, updates }); // optimistic
    const { error } = await supabase.from('leads').update(updates).eq('id', id);
    if (error && prev) {
      dispatch({ type: 'UPDATE_LEAD', id, updates: prev }); // rollback
      return;
    }
    // Auto-log stage_changed activity
    if (updates.status && prev && updates.status !== prev.status) {
      await supabase.from('lead_activities').insert({
        lead_id: id,
        client_id: clientId,
        type: 'stage_changed',
        description: `Stage changed from ${prev.status} to ${updates.status}`,
      });
    }
  }

  async function deleteLead(id: string) {
    dispatch({ type: 'DELETE_LEAD', id }); // optimistic
    const { error } = await supabase.from('leads').delete().eq('id', id);
    if (error) fetchLeads(); // refetch on failure
  }

  function getLead(id: string) {
    return state.leads.find(l => l.id === id);
  }

  async function fetchLeadActivities(leadId: string): Promise<LeadActivity[]> {
    const { data } = await supabase
      .from('lead_activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });
    return (data ?? []) as LeadActivity[];
  }

  return (
    <LeadsContext.Provider value={{
      leads: state.leads,
      loading: state.loading,
      addLead,
      updateLead,
      deleteLead,
      getLead,
      fetchLeadActivities,
    }}>
      {children}
    </LeadsContext.Provider>
  );
}

export function useLeadsContext() {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error('useLeadsContext must be inside LeadsProvider');
  return ctx;
}
