import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useClientContext } from '@/context/ClientContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClassCategory =
  | 'yoga' | 'hiit' | 'strength' | 'cardio'
  | 'pilates' | 'boxing' | 'spinning' | 'general';

export type ClassStatus = 'active' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'pending';
export type RepeatCycle = 'daily' | 'weekly' | 'monthly';

export type GymClass = {
  id: string;
  client_id: string;
  name: string;
  category: ClassCategory;
  description: string | null;
  type: 'recurring' | 'one_time';
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  max_capacity: number;
  booked_count: number;
  trainer_id: string | null;
  status: ClassStatus;
  allow_waitlist: boolean;
  max_waitlist: number;
  repeat?: RepeatCycle | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassAttendee = {
  id: string;
  class_id: string;
  client_id: string;
  member_id: string | null;
  member_name: string;
  member_plan?: string | null;
  is_walkin: boolean;
  attendance_status: AttendanceStatus;
  created_at: string;
};

export type WaitlistEntry = {
  id: string;
  class_id: string;
  client_id: string;
  member_id: string;
  member_name: string;
  position: number;
  added_at: string;
};

export type ClassTrainer = {
  id: string;
  client_id: string;
  name: string;
  role: string;
  specialization: string | null;
  avatar_initials: string;
  color: string;
};

// ── Derived status ────────────────────────────────────────────────────────────

export type DerivedStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

export function getDerivedStatus(c: GymClass): DerivedStatus {
  if (c.status === 'cancelled') return 'cancelled';
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (c.date < todayStr) return 'completed';
  if (c.date > todayStr) return 'upcoming';

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = c.start_time.split(':').map(Number);
  const [eh, em] = c.end_time.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;

  if (nowMins < startMins) return 'upcoming';
  if (nowMins >= startMins && nowMins < endMins) return 'in_progress';
  return 'completed';
}

// ── Category / Status config ──────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<ClassCategory, string> = {
  yoga:     '#A855F7',
  hiit:     '#EF4444',
  strength: '#4C9FFF',
  cardio:   '#F97316',
  pilates:  '#EC4899',
  boxing:   '#7F1D1D',
  spinning: '#33D169',
  general:  '#8FA3B4',
};

export const CATEGORY_LABELS: Record<ClassCategory, string> = {
  yoga: 'Yoga', hiit: 'HIIT', strength: 'Strength', cardio: 'Cardio',
  pilates: 'Pilates', boxing: 'Boxing', spinning: 'Spinning', general: 'General',
};

export const STATUS_COLORS: Record<DerivedStatus, string> = {
  upcoming:    '#4C9FFF',
  in_progress: '#33D169',
  completed:   '#8FA3B4',
  cancelled:   '#EF4444',
};

// ── State & Actions ───────────────────────────────────────────────────────────

type State = {
  classes: GymClass[];
  attendees: Record<string, ClassAttendee[]>;
  waitlist: Record<string, WaitlistEntry[]>;
  trainers: ClassTrainer[];
  loading: boolean;
};

type Action =
  | { type: 'SET_CLASSES'; classes: GymClass[]; trainers: ClassTrainer[] }
  | { type: 'SET_ATTENDEES'; classId: string; attendees: ClassAttendee[] }
  | { type: 'SET_WAITLIST'; classId: string; entries: WaitlistEntry[] }
  | { type: 'ADD_CLASS'; cls: GymClass }
  | { type: 'UPDATE_CLASS'; id: string; updates: Partial<GymClass> }
  | { type: 'DELETE_CLASS'; id: string }
  | { type: 'ADD_ATTENDEE'; attendee: ClassAttendee }
  | { type: 'REMOVE_ATTENDEE'; classId: string; attendeeId: string }
  | { type: 'UPDATE_ATTENDANCE'; classId: string; attendeeId: string; status: AttendanceStatus }
  | { type: 'ADD_TO_WAITLIST'; entry: WaitlistEntry }
  | { type: 'REMOVE_FROM_WAITLIST'; classId: string; entryId: string }
  | { type: 'MOVE_WAITLIST_TO_ATTENDEES'; classId: string; entryId: string; newAttendee: ClassAttendee }
  | { type: 'SET_LOADING'; loading: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_CLASSES':
      return { ...state, classes: action.classes, trainers: action.trainers, loading: false };
    case 'SET_ATTENDEES':
      return { ...state, attendees: { ...state.attendees, [action.classId]: action.attendees } };
    case 'SET_WAITLIST':
      return { ...state, waitlist: { ...state.waitlist, [action.classId]: action.entries } };
    case 'ADD_CLASS':
      return { ...state, classes: [action.cls, ...state.classes] };
    case 'UPDATE_CLASS':
      return { ...state, classes: state.classes.map(c => c.id === action.id ? { ...c, ...action.updates } : c) };
    case 'DELETE_CLASS': {
      const { [action.id]: _c, ...restA } = state.attendees;
      const { [action.id]: _w, ...restW } = state.waitlist;
      return { ...state, classes: state.classes.filter(c => c.id !== action.id), attendees: restA, waitlist: restW };
    }
    case 'ADD_ATTENDEE': {
      const existing = state.attendees[action.attendee.class_id] ?? [];
      return {
        ...state,
        classes: state.classes.map(c =>
          c.id === action.attendee.class_id ? { ...c, booked_count: c.booked_count + 1 } : c
        ),
        attendees: { ...state.attendees, [action.attendee.class_id]: [...existing, action.attendee] },
      };
    }
    case 'REMOVE_ATTENDEE': {
      const list = (state.attendees[action.classId] ?? []).filter(a => a.id !== action.attendeeId);
      return {
        ...state,
        classes: state.classes.map(c =>
          c.id === action.classId ? { ...c, booked_count: Math.max(0, c.booked_count - 1) } : c
        ),
        attendees: { ...state.attendees, [action.classId]: list },
      };
    }
    case 'UPDATE_ATTENDANCE':
      return {
        ...state,
        attendees: {
          ...state.attendees,
          [action.classId]: (state.attendees[action.classId] ?? []).map(a =>
            a.id === action.attendeeId ? { ...a, attendance_status: action.status } : a
          ),
        },
      };
    case 'ADD_TO_WAITLIST': {
      const wl = state.waitlist[action.entry.class_id] ?? [];
      return { ...state, waitlist: { ...state.waitlist, [action.entry.class_id]: [...wl, action.entry] } };
    }
    case 'REMOVE_FROM_WAITLIST': {
      const wl = (state.waitlist[action.classId] ?? [])
        .filter(e => e.id !== action.entryId)
        .map((e, i) => ({ ...e, position: i + 1 }));
      return { ...state, waitlist: { ...state.waitlist, [action.classId]: wl } };
    }
    case 'MOVE_WAITLIST_TO_ATTENDEES': {
      const updatedWl = (state.waitlist[action.classId] ?? [])
        .filter(e => e.id !== action.entryId)
        .map((e, i) => ({ ...e, position: i + 1 }));
      const updatedAttendees = [...(state.attendees[action.classId] ?? []), action.newAttendee];
      return {
        ...state,
        classes: state.classes.map(c =>
          c.id === action.classId ? { ...c, booked_count: c.booked_count + 1 } : c
        ),
        attendees: { ...state.attendees, [action.classId]: updatedAttendees },
        waitlist: { ...state.waitlist, [action.classId]: updatedWl },
      };
    }
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type ClassesContextType = {
  classes: GymClass[];
  trainers: ClassTrainer[];
  loading: boolean;
  getClassesForDay: (date: string) => GymClass[];
  getClass: (id: string) => GymClass | undefined;
  getTrainer: (id: string) => ClassTrainer | undefined;
  getAttendees: (classId: string) => ClassAttendee[];
  getWaitlist: (classId: string) => WaitlistEntry[];
  loadClassData: (classId: string) => Promise<void>;
  addClass: (c: Omit<GymClass, 'id' | 'client_id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateClass: (id: string, updates: Partial<GymClass>) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  addAttendee: (a: Omit<ClassAttendee, 'id' | 'client_id' | 'created_at'>) => Promise<void>;
  removeAttendee: (classId: string, attendeeId: string) => Promise<void>;
  updateAttendance: (classId: string, attendeeId: string, status: AttendanceStatus) => Promise<void>;
  addToWaitlist: (classId: string, memberId: string, memberName: string) => Promise<void>;
  removeFromWaitlist: (classId: string, entryId: string) => Promise<void>;
  moveWaitlistToAttendees: (classId: string, entryId: string) => Promise<void>;
};

const ClassesContext = createContext<ClassesContextType | null>(null);

export function ClassesProvider({ children }: { children: React.ReactNode }) {
  const { clientId } = useClientContext();
  const [state, dispatch] = useReducer(reducer, {
    classes: [], attendees: {}, waitlist: {}, trainers: [], loading: true,
  });

  const fetchAll = useCallback(async () => {
    if (!clientId) return;
    dispatch({ type: 'SET_LOADING', loading: true });
    const [{ data: classData }, { data: trainerData }] = await Promise.all([
      supabase.from('classes').select('*').eq('client_id', clientId).order('date').order('start_time'),
      supabase.from('trainers').select('*').eq('client_id', clientId),
    ]);
    dispatch({
      type: 'SET_CLASSES',
      classes: (classData ?? []) as GymClass[],
      trainers: (trainerData ?? []) as ClassTrainer[],
    });
  }, [clientId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function loadClassData(classId: string) {
    if (!clientId) return;
    const [{ data: attendeeData }, { data: waitlistData }] = await Promise.all([
      supabase.from('class_attendees').select('*').eq('class_id', classId),
      supabase.from('class_waitlist').select('*').eq('class_id', classId).order('position'),
    ]);
    dispatch({ type: 'SET_ATTENDEES', classId, attendees: (attendeeData ?? []) as ClassAttendee[] });
    dispatch({ type: 'SET_WAITLIST', classId, entries: (waitlistData ?? []) as WaitlistEntry[] });
  }

  const getClassesForDay = useCallback((date: string) =>
    state.classes
      .filter(c => c.date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  [state.classes]);

  const getClass = (id: string) => state.classes.find(c => c.id === id);
  const getTrainer = (id: string) => state.trainers.find(t => t.id === id);
  const getAttendees = (classId: string) => state.attendees[classId] ?? [];
  const getWaitlist = (classId: string) => state.waitlist[classId] ?? [];

  async function addClass(data: Omit<GymClass, 'id' | 'client_id' | 'created_at' | 'updated_at'>) {
    const { data: row, error } = await supabase
      .from('classes')
      .insert({ ...data, client_id: clientId })
      .select()
      .single();
    if (!error && row) dispatch({ type: 'ADD_CLASS', cls: row as GymClass });
  }

  async function updateClass(id: string, updates: Partial<GymClass>) {
    dispatch({ type: 'UPDATE_CLASS', id, updates });
    await supabase.from('classes').update(updates).eq('id', id);
  }

  async function deleteClass(id: string) {
    dispatch({ type: 'DELETE_CLASS', id });
    await supabase.from('classes').delete().eq('id', id);
  }

  async function addAttendee(a: Omit<ClassAttendee, 'id' | 'client_id' | 'created_at'>) {
    const { data: row, error } = await supabase
      .from('class_attendees')
      .insert({ ...a, client_id: clientId })
      .select()
      .single();
    if (!error && row) dispatch({ type: 'ADD_ATTENDEE', attendee: row as ClassAttendee });
  }

  async function removeAttendee(classId: string, attendeeId: string) {
    dispatch({ type: 'REMOVE_ATTENDEE', classId, attendeeId });
    await supabase.from('class_attendees').delete().eq('id', attendeeId);
  }

  async function updateAttendance(classId: string, attendeeId: string, status: AttendanceStatus) {
    dispatch({ type: 'UPDATE_ATTENDANCE', classId, attendeeId, status });
    await supabase.from('class_attendees').update({ attendance_status: status }).eq('id', attendeeId);
  }

  async function addToWaitlist(classId: string, memberId: string, memberName: string) {
    const existing = state.waitlist[classId] ?? [];
    const position = existing.length + 1;
    const { data: row, error } = await supabase
      .from('class_waitlist')
      .insert({ class_id: classId, client_id: clientId, member_id: memberId, member_name: memberName, position })
      .select()
      .single();
    if (!error && row) dispatch({ type: 'ADD_TO_WAITLIST', entry: row as WaitlistEntry });
  }

  async function removeFromWaitlist(classId: string, entryId: string) {
    dispatch({ type: 'REMOVE_FROM_WAITLIST', classId, entryId });
    await supabase.from('class_waitlist').delete().eq('id', entryId);
  }

  async function moveWaitlistToAttendees(classId: string, entryId: string) {
    const entry = (state.waitlist[classId] ?? []).find(e => e.id === entryId);
    if (!entry) return;
    const { data: newRow, error } = await supabase
      .from('class_attendees')
      .insert({ class_id: classId, client_id: clientId, member_id: entry.member_id, member_name: entry.member_name, is_walkin: false, attendance_status: 'pending' })
      .select()
      .single();
    if (error || !newRow) return;
    await supabase.from('class_waitlist').delete().eq('id', entryId);
    dispatch({ type: 'MOVE_WAITLIST_TO_ATTENDEES', classId, entryId, newAttendee: newRow as ClassAttendee });
  }

  return (
    <ClassesContext.Provider value={{
      classes: state.classes,
      trainers: state.trainers,
      loading: state.loading,
      getClassesForDay, getClass, getTrainer, getAttendees, getWaitlist,
      loadClassData,
      addClass, updateClass, deleteClass,
      addAttendee, removeAttendee, updateAttendance,
      addToWaitlist, removeFromWaitlist, moveWaitlistToAttendees,
    }}>
      {children}
    </ClassesContext.Provider>
  );
}

export function useClassesContext() {
  const ctx = useContext(ClassesContext);
  if (!ctx) throw new Error('useClassesContext must be inside ClassesProvider');
  return ctx;
}
