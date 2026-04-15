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
  source: 'website_form' | 'whatsapp' | 'walk_in' | 'referral';
  status: 'new' | 'contacted' | 'converted' | 'lost';
  notes: string | null;
  interest: string | null;
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
  google_review_id: string | null;
  created_at: string;
};

export type Campaign = {
  id: string;
  client_id: string;
  name: string;
  type: 'sms' | 'email' | 'whatsapp';
  status: 'draft' | 'active' | 'completed' | 'paused';
  message: string | null;
  subject: string | null;
  audience_size: number;
  sent_count: number;
  open_count: number;
  click_count: number;
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
