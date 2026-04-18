import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { MOCK_CLASSES, MOCK_ATTENDEES, MOCK_WAITLIST, MOCK_TRAINERS } from '@/lib/mockClasses';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ClassCategory =
  | 'yoga' | 'hiit' | 'strength' | 'cardio'
  | 'pilates' | 'boxing' | 'spinning' | 'general';

export type ClassStatus = 'active' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'pending';
export type RepeatCycle = 'daily' | 'weekly' | 'monthly';

export type GymClass = {
  id: string;
  name: string;
  category: ClassCategory;
  description: string | null;
  type: 'recurring' | 'one_time';
  date: string;           // YYYY-MM-DD
  start_time: string;     // HH:MM
  end_time: string;       // HH:MM
  location: string | null;
  max_capacity: number;
  booked_count: number;
  trainer_id: string;
  status: ClassStatus;
  allow_waitlist: boolean;
  max_waitlist: number;
  repeat?: RepeatCycle;
  end_date: string | null;
  created_at: string;
};

export type ClassAttendee = {
  id: string;
  class_id: string;
  member_id: string | null;
  member_name: string;
  member_plan?: string;
  is_walkin: boolean;
  attendance_status: AttendanceStatus;
};

export type WaitlistEntry = {
  id: string;
  class_id: string;
  member_id: string;
  member_name: string;
  position: number;
  added_at: string;
};

export type ClassTrainer = {
  id: string;
  name: string;
  role: string;
  specialization: string;
  avatar_initials: string;
  color: string;
};

// ── Derived status (computed from time, not stored) ───────────────────────────

export type DerivedStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';

export function getDerivedStatus(c: GymClass): DerivedStatus {
  if (c.status === 'cancelled') return 'cancelled';
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (c.date < todayStr) return 'completed';
  if (c.date > todayStr) return 'upcoming';

  // Same day → compare times
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = c.start_time.split(':').map(Number);
  const [eh, em] = c.end_time.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins   = eh * 60 + em;

  if (nowMins < startMins) return 'upcoming';
  if (nowMins >= startMins && nowMins < endMins) return 'in_progress';
  return 'completed';
}

// ── Category config ───────────────────────────────────────────────────────────

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
};

type Action =
  | { type: 'ADD_CLASS'; cls: GymClass }
  | { type: 'UPDATE_CLASS'; id: string; updates: Partial<GymClass> }
  | { type: 'DELETE_CLASS'; id: string }
  | { type: 'ADD_ATTENDEE'; attendee: ClassAttendee }
  | { type: 'REMOVE_ATTENDEE'; classId: string; attendeeId: string }
  | { type: 'UPDATE_ATTENDANCE'; classId: string; attendeeId: string; status: AttendanceStatus }
  | { type: 'ADD_TO_WAITLIST'; entry: WaitlistEntry }
  | { type: 'REMOVE_FROM_WAITLIST'; classId: string; entryId: string }
  | { type: 'MOVE_WAITLIST_TO_ATTENDEES'; classId: string; entryId: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_CLASS':
      return { ...state, classes: [action.cls, ...state.classes] };

    case 'UPDATE_CLASS':
      return {
        ...state,
        classes: state.classes.map(c => c.id === action.id ? { ...c, ...action.updates } : c),
      };

    case 'DELETE_CLASS': {
      const { [action.id]: _c, ...restA } = state.attendees;
      const { [action.id]: _w, ...restW } = state.waitlist;
      return { ...state, classes: state.classes.filter(c => c.id !== action.id), attendees: restA, waitlist: restW };
    }

    case 'ADD_ATTENDEE': {
      const existing = state.attendees[action.attendee.class_id] ?? [];
      const updatedClasses = state.classes.map(c =>
        c.id === action.attendee.class_id ? { ...c, booked_count: c.booked_count + 1 } : c
      );
      return {
        ...state,
        classes: updatedClasses,
        attendees: { ...state.attendees, [action.attendee.class_id]: [...existing, action.attendee] },
      };
    }

    case 'REMOVE_ATTENDEE': {
      const list = (state.attendees[action.classId] ?? []).filter(a => a.id !== action.attendeeId);
      const updatedClasses = state.classes.map(c =>
        c.id === action.classId ? { ...c, booked_count: Math.max(0, c.booked_count - 1) } : c
      );
      return { ...state, classes: updatedClasses, attendees: { ...state.attendees, [action.classId]: list } };
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
      const entry = (state.waitlist[action.classId] ?? []).find(e => e.id === action.entryId);
      if (!entry) return state;
      const newAttendee: ClassAttendee = {
        id: `a${Date.now()}`,
        class_id: action.classId,
        member_id: entry.member_id,
        member_name: entry.member_name,
        is_walkin: false,
        attendance_status: 'pending',
      };
      const updatedWl = (state.waitlist[action.classId] ?? [])
        .filter(e => e.id !== action.entryId)
        .map((e, i) => ({ ...e, position: i + 1 }));
      const updatedAttendees = [...(state.attendees[action.classId] ?? []), newAttendee];
      const updatedClasses = state.classes.map(c =>
        c.id === action.classId ? { ...c, booked_count: c.booked_count + 1 } : c
      );
      return {
        ...state,
        classes: updatedClasses,
        attendees: { ...state.attendees, [action.classId]: updatedAttendees },
        waitlist: { ...state.waitlist, [action.classId]: updatedWl },
      };
    }

    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

type ClassesContextType = {
  classes: GymClass[];
  trainers: ClassTrainer[];
  getClassesForDay: (date: string) => GymClass[];
  getClass: (id: string) => GymClass | undefined;
  getTrainer: (id: string) => ClassTrainer | undefined;
  getAttendees: (classId: string) => ClassAttendee[];
  getWaitlist: (classId: string) => WaitlistEntry[];
  addClass: (c: Omit<GymClass, 'id' | 'created_at'>) => void;
  updateClass: (id: string, updates: Partial<GymClass>) => void;
  deleteClass: (id: string) => void;
  addAttendee: (a: Omit<ClassAttendee, 'id'>) => void;
  removeAttendee: (classId: string, attendeeId: string) => void;
  updateAttendance: (classId: string, attendeeId: string, status: AttendanceStatus) => void;
  addToWaitlist: (classId: string, memberId: string, memberName: string) => void;
  removeFromWaitlist: (classId: string, entryId: string) => void;
  moveWaitlistToAttendees: (classId: string, entryId: string) => void;
};

const ClassesContext = createContext<ClassesContextType | null>(null);

export function ClassesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    classes: MOCK_CLASSES,
    attendees: MOCK_ATTENDEES,
    waitlist: MOCK_WAITLIST,
    trainers: MOCK_TRAINERS,
  });

  const getClassesForDay = useCallback((date: string) =>
    state.classes
      .filter(c => c.date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time)),
  [state.classes]);

  const getClass = (id: string) => state.classes.find(c => c.id === id);
  const getTrainer = (id: string) => state.trainers.find(t => t.id === id);
  const getAttendees = (classId: string) => state.attendees[classId] ?? [];
  const getWaitlist = (classId: string) => state.waitlist[classId] ?? [];

  function addClass(data: Omit<GymClass, 'id' | 'created_at'>) {
    dispatch({ type: 'ADD_CLASS', cls: { ...data, id: `cl${Date.now()}`, created_at: new Date().toISOString() } });
  }

  function updateClass(id: string, updates: Partial<GymClass>) {
    dispatch({ type: 'UPDATE_CLASS', id, updates });
  }

  function deleteClass(id: string) {
    dispatch({ type: 'DELETE_CLASS', id });
  }

  function addAttendee(a: Omit<ClassAttendee, 'id'>) {
    dispatch({ type: 'ADD_ATTENDEE', attendee: { ...a, id: `a${Date.now()}` } });
  }

  function removeAttendee(classId: string, attendeeId: string) {
    dispatch({ type: 'REMOVE_ATTENDEE', classId, attendeeId });
  }

  function updateAttendance(classId: string, attendeeId: string, status: AttendanceStatus) {
    dispatch({ type: 'UPDATE_ATTENDANCE', classId, attendeeId, status });
  }

  function addToWaitlist(classId: string, memberId: string, memberName: string) {
    const existing = state.waitlist[classId] ?? [];
    dispatch({
      type: 'ADD_TO_WAITLIST',
      entry: {
        id: `w${Date.now()}`,
        class_id: classId,
        member_id: memberId,
        member_name: memberName,
        position: existing.length + 1,
        added_at: new Date().toISOString(),
      },
    });
  }

  function removeFromWaitlist(classId: string, entryId: string) {
    dispatch({ type: 'REMOVE_FROM_WAITLIST', classId, entryId });
  }

  function moveWaitlistToAttendees(classId: string, entryId: string) {
    dispatch({ type: 'MOVE_WAITLIST_TO_ATTENDEES', classId, entryId });
  }

  return (
    <ClassesContext.Provider value={{
      classes: state.classes,
      trainers: state.trainers,
      getClassesForDay, getClass, getTrainer, getAttendees, getWaitlist,
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
  if (!ctx) throw new Error('useClassesContext must be used inside ClassesProvider');
  return ctx;
}
