import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// Supabase Auth storage adapter using SecureStore (encrypted, device-local)
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type Client = {
  id: string;
  owner_user_id: string;
  gym_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  website_url: string | null;
  plan: 'starter' | 'growth' | 'pro';
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
  updated_at: string;
};

export type Lead = {
  id: string;
  client_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: 'website' | 'instagram' | 'referral' | 'walk_in' | 'google_ads' | 'other';
  status: 'new_lead' | 'contacted' | 'trial_booked' | 'trial_completed' | 'joined_gym' | 'lost_lead';
  notes: string | null;
  interests: string[];
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Review = {
  id: string;
  client_id: string;
  reviewer_name: string;
  reviewer_avatar_url: string | null;
  rating: number;
  content: string | null;
  replied: boolean;
  reply_text: string | null;
  replied_at: string | null;
  resolved: boolean;
  google_review_id: string | null;
  platform: 'google' | 'facebook';
  created_at: string;
};

export type Campaign = {
  id: string;
  client_id: string;
  name: string;
  type: 'sms_broadcast' | 'follow_up' | 'reactivation' | 'promotion' | 'event' | 'review_request';
  status: 'draft' | 'active' | 'completed' | 'paused' | 'scheduled';
  channel: 'sms' | 'whatsapp';
  message: string | null;
  subject: string | null;
  audience_size: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  delivered_count: number;
  response_count: number;
  conversion_count: number;
  recipient_count: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Subscription = {
  id: string;
  client_id: string;
  plan: string;
  amount_kes: number;
  billing_cycle: string;
  next_billing_date: string | null;
  paystack_subscription_id: string | null;
  is_active: boolean;
  trial_ends_at: string | null;
  created_at: string;
};

export type Trainer = {
  id: string;
  client_id: string;
  name: string;
  role: string;
  specialization: string | null;
  avatar_initials: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  client_id: string;
  name: string;
  role: string;
  avatar_initials: string;
  created_at: string;
  updated_at: string;
};

export type MemberStatus = 'active' | 'inactive' | 'expired' | 'frozen';
export type MemberPlan = 'monthly_basic' | 'monthly_premium' | 'annual_basic' | 'annual_premium' | 'pay_per_class' | 'custom';
export type BillingCycle = 'monthly' | 'annual' | 'one_time';

export type Member = {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  email: string | null;
  date_of_birth: string | null;
  gender: 'male' | 'female' | 'other' | null;
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
  method: 'mpesa' | 'cash' | 'card' | 'bank_transfer';
  status: 'paid' | 'pending' | 'failed';
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

export type GymClass = {
  id: string;
  client_id: string;
  name: string;
  category: 'hiit' | 'yoga' | 'strength' | 'cardio' | 'pilates' | 'boxing' | 'spinning' | 'general';
  description: string | null;
  type: 'recurring' | 'one_time';
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  max_capacity: number;
  booked_count: number;
  trainer_id: string | null;
  status: 'active' | 'cancelled';
  allow_waitlist: boolean;
  max_waitlist: number;
  repeat: 'daily' | 'weekly' | 'monthly' | null;
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
  member_plan: string | null;
  is_walkin: boolean;
  attendance_status: 'present' | 'absent' | 'pending';
  created_at: string;
};

export type ClassWaitlistEntry = {
  id: string;
  class_id: string;
  client_id: string;
  member_id: string;
  member_name: string;
  position: number;
  added_at: string;
};

export type Conversation = {
  id: string;
  client_id: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string | null;
  channel: 'whatsapp' | 'sms' | 'instagram' | 'website_chat';
  status: 'open' | 'resolved';
  assigned_to: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  client_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  sender_name: string;
  sent_at: string;
  read: boolean;
  created_at: string;
};

export type QuickReplyTemplate = {
  id: string;
  client_id: string;
  category: 'greeting' | 'pricing' | 'booking' | 'follow_up' | 'payment';
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type LeadActivityType = 'lead_created' | 'stage_changed' | 'note_added' | 'call_made' | 'trial_booked';

export type LeadActivity = {
  id: string;
  lead_id: string;
  client_id: string;
  type: LeadActivityType;
  description: string;
  created_at: string;
};

export type Automation = {
  id: string;
  client_id: string;
  name: string;
  emoji: string;
  icon_color: string;
  trigger: string;
  trigger_days: number | null;
  action_summary: string | null;
  stats_text: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AutomationStep = {
  id: string;
  automation_id: string;
  step_order: number;
  type: 'send_sms' | 'wait' | 'update_stage' | 'assign_team' | 'add_tag';
  message: string | null;
  wait_duration: string | null;
  stage: string | null;
  team_member: string | null;
  tag: string | null;
  created_at: string;
};

export type Broadcast = {
  id: string;
  client_id: string;
  recipient_label: string;
  message: string;
  status: 'sent' | 'scheduled' | 'failed';
  sent_at: string | null;
  scheduled_at: string | null;
  recipient_count: number;
  created_at: string;
  updated_at: string;
};

export type BroadcastRecipient = {
  id: string;
  broadcast_id: string;
  client_id: string;
  name: string;
  type: 'member' | 'lead';
  delivery_status: 'delivered' | 'failed' | 'pending';
  ref_id: string | null;
  created_at: string;
};

export type SmsTemplate = {
  id: string;
  client_id: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ReviewRequest = {
  id: string;
  client_id: string;
  member_id: string | null;
  member_name: string;
  member_phone: string;
  platform: 'google' | 'facebook';
  sent_at: string;
  status: 'pending' | 'reviewed' | 'no_response';
  created_at: string;
};
