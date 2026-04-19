import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useClientContext } from '@/context/ClientContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MemberStatus = 'active' | 'inactive' | 'expired' | 'frozen';
export type MemberPlan =
  | 'monthly_basic' | 'monthly_premium'
  | 'annual_basic'  | 'annual_premium'
  | 'pay_per_class' | 'custom';
export type BillingCycle = 'monthly' | 'annual' | 'one_time';
export type Gender = 'male' | 'female' | 'other';
export type PaymentMethod = 'mpesa' | 'cash' | 'card' | 'bank_transfer';
export type PaymentStatus = 'paid' | 'pending' | 'failed';

export type Member = {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  plan: MemberPlan;
  plan_label: string;
  start_date: string;
  expiry_date: string;
  billing_amount: number;
  billing_cycle: BillingCycle;
  next_billing_date: string | null;
  assigned_trainer: string | null;
  trainer_id: string | null;
  status: MemberStatus;
  notes: string | null;
  streak: number;
  last_visit_at: string | null;
  total_visits: number;
  height_cm: number | null;
  weight_kg: number | null;
  fitness_goal: string | null;
  created_at: string;
  updated_at: string;
};

export type Payment = {
  id: string;
  member_id: string;
  client_id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string;
  reference: string | null;
  note: string | null;
  created_at: string;
};

export type AttendanceRecord = {
  id: string;
  member_id: string;
  client_id: string;
  date: string;
  time_in: string;
  duration_minutes: number;
  created_at: string;
};

export type CheckIn = {
  id: string;
  member_id: string;
  timestamp: string;
  date: string;
};

// ── State & Actions ───────────────────────────────────────────────────────────

type State = {
  members: Member[];
  checkIns: CheckIn[];
  loading: boolean;
};

type Action =
  | { type: 'SET_MEMBERS'; members: Member[] }
  | { type: 'ADD_MEMBER'; member: Member }
  | { type: 'UPDATE_MEMBER'; id: string; updates: Partial<Member> }
  | { type: 'DELETE_MEMBER'; id: string }
  | { type: 'CHECK_IN'; checkIn: CheckIn }
  | { type: 'SET_LOADING'; loading: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_MEMBERS':
      return { ...state, members: action.members, loading: false };
    case 'ADD_MEMBER':
      return { ...state, members: [action.member, ...state.members] };
    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map(m =>
          m.id === action.id ? { ...m, ...action.updates, updated_at: new Date().toISOString() } : m
        ),
      };
    case 'DELETE_MEMBER':
      return { ...state, members: state.members.filter(m => m.id !== action.id) };
    case 'CHECK_IN': {
      const updatedMembers = state.members.map(m => {
        if (m.id !== action.checkIn.member_id) return m;
        return {
          ...m,
          last_visit_at: action.checkIn.timestamp,
          streak: m.streak + 1,
          total_visits: m.total_visits + 1,
          updated_at: new Date().toISOString(),
        };
      });
      return { ...state, members: updatedMembers, checkIns: [...state.checkIns, action.checkIn] };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type MembersContextType = {
  members: Member[];
  checkIns: CheckIn[];
  loading: boolean;
  addMember: (m: Omit<Member, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMember: (id: string, updates: Partial<Member>) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  getMember: (id: string) => Member | undefined;
  checkInMember: (memberId: string) => Promise<void>;
  isCheckedInToday: (memberId: string) => boolean;
  recordPayment: (p: Omit<Payment, 'id' | 'client_id' | 'created_at'>) => Promise<void>;
  getMemberPayments: (memberId: string) => Promise<Payment[]>;
  getMemberAttendance: (memberId: string) => Promise<AttendanceRecord[]>;
};

const MembersContext = createContext<MembersContextType | null>(null);

export function MembersProvider({ children }: { children: React.ReactNode }) {
  const { clientId } = useClientContext();
  const [state, dispatch] = useReducer(reducer, { members: [], checkIns: [], loading: true });

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchMembers = useCallback(async () => {
    if (!clientId) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (data) dispatch({ type: 'SET_MEMBERS', members: data as Member[] });
  }, [clientId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  async function addMember(data: Omit<Member, 'id' | 'created_at' | 'updated_at'>) {
    const { data: row, error } = await supabase
      .from('members')
      .insert({ ...data, client_id: clientId })
      .select()
      .single();
    if (!error && row) dispatch({ type: 'ADD_MEMBER', member: row as Member });
  }

  async function updateMember(id: string, updates: Partial<Member>) {
    const prev = state.members.find(m => m.id === id);
    dispatch({ type: 'UPDATE_MEMBER', id, updates }); // optimistic
    const { error } = await supabase.from('members').update(updates).eq('id', id);
    if (error && prev) dispatch({ type: 'UPDATE_MEMBER', id, updates: prev }); // rollback
  }

  async function deleteMember(id: string) {
    dispatch({ type: 'DELETE_MEMBER', id }); // optimistic
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) fetchMembers();
  }

  function getMember(id: string) {
    return state.members.find(m => m.id === id);
  }

  async function checkInMember(memberId: string) {
    const now = new Date();
    const todayDate = todayStr;
    const timeIn = now.toTimeString().slice(0, 5); // HH:MM

    const checkIn: CheckIn = {
      id: `ci${Date.now()}`,
      member_id: memberId,
      timestamp: now.toISOString(),
      date: todayDate,
    };
    dispatch({ type: 'CHECK_IN', checkIn });

    // Insert attendance row (unique constraint handles duplicate same-day check-ins)
    await supabase.from('attendance').insert({
      member_id: memberId,
      client_id: clientId,
      date: todayDate,
      time_in: timeIn,
      duration_minutes: 60,
    });

    // Update member's last_visit_at, streak, total_visits
    const member = state.members.find(m => m.id === memberId);
    if (member) {
      await supabase.from('members').update({
        last_visit_at: now.toISOString(),
        streak: member.streak + 1,
        total_visits: member.total_visits + 1,
      }).eq('id', memberId);
    }
  }

  function isCheckedInToday(memberId: string) {
    return state.checkIns.some(ci => ci.member_id === memberId && ci.date === todayStr);
  }

  async function recordPayment(p: Omit<Payment, 'id' | 'client_id' | 'created_at'>) {
    await supabase.from('payments').insert({ ...p, client_id: clientId });
  }

  async function getMemberPayments(memberId: string): Promise<Payment[]> {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false });
    return (data ?? []) as Payment[];
  }

  async function getMemberAttendance(memberId: string): Promise<AttendanceRecord[]> {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('member_id', memberId)
      .order('date', { ascending: false });
    return (data ?? []) as AttendanceRecord[];
  }

  return (
    <MembersContext.Provider value={{
      members: state.members,
      checkIns: state.checkIns,
      loading: state.loading,
      addMember, updateMember, deleteMember, getMember,
      checkInMember, isCheckedInToday,
      recordPayment, getMemberPayments, getMemberAttendance,
    }}>
      {children}
    </MembersContext.Provider>
  );
}

export function useMembersContext() {
  const ctx = useContext(MembersContext);
  if (!ctx) throw new Error('useMembersContext must be inside MembersProvider');
  return ctx;
}
