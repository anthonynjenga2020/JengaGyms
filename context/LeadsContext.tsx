import React, { createContext, useContext, useReducer } from 'react';
import { MOCK_LEADS } from '@/lib/mockData';
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
  type: 'lead_created' | 'stage_changed' | 'note_added' | 'call_made' | 'trial_booked';
  description: string;
  created_at: string;
};

type State = {
  leads: AppLead[];
};

type Action =
  | { type: 'ADD_LEAD'; lead: AppLead }
  | { type: 'UPDATE_LEAD'; id: string; updates: Partial<AppLead> }
  | { type: 'DELETE_LEAD'; id: string };

// ── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_LEAD':
      return { leads: [action.lead, ...state.leads] };
    case 'UPDATE_LEAD':
      return {
        leads: state.leads.map(l =>
          l.id === action.id ? { ...l, ...action.updates, updated_at: new Date().toISOString() } : l
        ),
      };
    case 'DELETE_LEAD':
      return { leads: state.leads.filter(l => l.id !== action.id) };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type LeadsContextType = {
  leads: AppLead[];
  addLead: (lead: Omit<AppLead, 'id' | 'created_at' | 'updated_at'>) => void;
  updateLead: (id: string, updates: Partial<AppLead>) => void;
  deleteLead: (id: string) => void;
  getLead: (id: string) => AppLead | undefined;
};

const LeadsContext = createContext<LeadsContextType | null>(null);

export function LeadsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { leads: MOCK_LEADS });

  function addLead(data: Omit<AppLead, 'id' | 'created_at' | 'updated_at'>) {
    const lead: AppLead = {
      ...data,
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_LEAD', lead });
  }

  function updateLead(id: string, updates: Partial<AppLead>) {
    dispatch({ type: 'UPDATE_LEAD', id, updates });
  }

  function deleteLead(id: string) {
    dispatch({ type: 'DELETE_LEAD', id });
  }

  function getLead(id: string) {
    return state.leads.find(l => l.id === id);
  }

  return (
    <LeadsContext.Provider value={{ leads: state.leads, addLead, updateLead, deleteLead, getLead }}>
      {children}
    </LeadsContext.Provider>
  );
}

export function useLeadsContext() {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error('useLeadsContext must be used inside LeadsProvider');
  return ctx;
}
