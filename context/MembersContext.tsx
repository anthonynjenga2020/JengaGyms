import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { MOCK_MEMBERS, MOCK_PAYMENTS, MOCK_ATTENDANCE } from '@/lib/mockMembers';

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
  email: string;
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
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  date: string;
  reference: string | null;
  note: string | null;
};

export type AttendanceRecord = {
  date: string;
  time_in: string;
  duration_minutes: number;
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
  payments: Record<string, Payment[]>;
  attendance: Record<string, AttendanceRecord[]>;
  checkIns: CheckIn[];
};

type Action =
  | { type: 'ADD_MEMBER'; member: Member }
  | { type: 'UPDATE_MEMBER'; id: string; updates: Partial<Member> }
  | { type: 'DELETE_MEMBER'; id: string }
  | { type: 'CHECK_IN'; checkIn: CheckIn }
  | { type: 'RECORD_PAYMENT'; payment: Payment };

function reducer(state: State, action: Action): State {
  switch (action.type) {
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
      // Update member's last_visit_at and streak
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
    case 'RECORD_PAYMENT': {
      const existing = state.payments[action.payment.member_id] ?? [];
      return {
        ...state,
        payments: {
          ...state.payments,
          [action.payment.member_id]: [action.payment, ...existing],
        },
      };
    }
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type MembersContextType = {
  members: Member[];
  payments: Record<string, Payment[]>;
  attendance: Record<string, AttendanceRecord[]>;
  checkIns: CheckIn[];
  addMember: (m: Omit<Member, 'id' | 'created_at' | 'updated_at'>) => void;
  updateMember: (id: string, updates: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  getMember: (id: string) => Member | undefined;
  checkInMember: (memberId: string) => void;
  isCheckedInToday: (memberId: string) => boolean;
  recordPayment: (p: Omit<Payment, 'id'>) => void;
  getMemberPayments: (memberId: string) => Payment[];
  getMemberAttendance: (memberId: string) => AttendanceRecord[];
};

const MembersContext = createContext<MembersContextType | null>(null);

export function MembersProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    members: MOCK_MEMBERS,
    payments: MOCK_PAYMENTS,
    attendance: MOCK_ATTENDANCE,
    checkIns: [],
  });

  const todayStr = new Date().toISOString().split('T')[0];

  function addMember(data: Omit<Member, 'id' | 'created_at' | 'updated_at'>) {
    dispatch({
      type: 'ADD_MEMBER',
      member: { ...data, id: `m${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    });
  }

  function updateMember(id: string, updates: Partial<Member>) {
    dispatch({ type: 'UPDATE_MEMBER', id, updates });
  }

  function deleteMember(id: string) {
    dispatch({ type: 'DELETE_MEMBER', id });
  }

  function getMember(id: string) {
    return state.members.find(m => m.id === id);
  }

  function checkInMember(memberId: string) {
    const now = new Date();
    dispatch({
      type: 'CHECK_IN',
      checkIn: {
        id: `ci${Date.now()}`,
        member_id: memberId,
        timestamp: now.toISOString(),
        date: now.toISOString().split('T')[0],
      },
    });
  }

  function isCheckedInToday(memberId: string) {
    return state.checkIns.some(ci => ci.member_id === memberId && ci.date === todayStr);
  }

  function recordPayment(p: Omit<Payment, 'id'>) {
    dispatch({ type: 'RECORD_PAYMENT', payment: { ...p, id: `pay${Date.now()}` } });
  }

  function getMemberPayments(memberId: string) {
    return state.payments[memberId] ?? [];
  }

  function getMemberAttendance(memberId: string) {
    return state.attendance[memberId] ?? [];
  }

  return (
    <MembersContext.Provider value={{
      members: state.members,
      payments: state.payments,
      attendance: state.attendance,
      checkIns: state.checkIns,
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
  if (!ctx) throw new Error('useMembersContext must be used inside MembersProvider');
  return ctx;
}
