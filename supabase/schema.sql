-- ============================================================
-- JengaPulse + Client Gym Sites — Supabase Schema
-- ============================================================
-- Run this against your Supabase project SQL editor.
-- This schema is shared by:
--   1. JengaPulse mobile app (gym owners manage their business)
--   2. Client gym websites (leads + bookings captured here)
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLIENTS
-- Gym owners subscribed to Jenga Systems
-- ============================================================
create table if not exists clients (
  id                uuid primary key default uuid_generate_v4(),
  owner_user_id     text unique,            -- Supabase Auth UID
  gym_name          text not null,
  phone             text,
  email             text,
  address           text,
  logo_url          text,
  website_url       text,
  plan              text not null default 'starter',  -- 'starter' | 'growth' | 'pro'
  status            text not null default 'active',   -- 'active' | 'paused' | 'cancelled'
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- LEADS
-- Captured from client gym websites (contact/booking forms)
-- ============================================================
create table if not exists leads (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text not null,
  phone         text,
  email         text,
  source        text not null default 'website_form',  -- 'website_form' | 'whatsapp' | 'walk_in' | 'referral'
  status        text not null default 'new',            -- 'new' | 'contacted' | 'converted' | 'lost'
  notes         text,
  interest      text,                                   -- e.g. 'Personal Training', 'Group Classes'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists leads_client_id_idx on leads(client_id);
create index if not exists leads_status_idx on leads(status);
create index if not exists leads_created_at_idx on leads(created_at desc);

-- ============================================================
-- REVIEWS
-- Google reviews for each gym
-- ============================================================
create table if not exists reviews (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references clients(id) on delete cascade,
  reviewer_name       text not null,
  reviewer_avatar_url text,
  rating              int not null check (rating between 1 and 5),
  content             text,
  replied             boolean not null default false,
  reply_text          text,
  replied_at          timestamptz,
  google_review_id    text unique,                      -- to prevent duplicates
  created_at          timestamptz not null default now()
);

create index if not exists reviews_client_id_idx on reviews(client_id);
create index if not exists reviews_rating_idx on reviews(rating);

-- ============================================================
-- CAMPAIGNS
-- Marketing campaigns run for each gym (SMS, email, WhatsApp)
-- ============================================================
create table if not exists campaigns (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text not null,
  type          text not null,         -- 'sms' | 'email' | 'whatsapp'
  status        text not null default 'draft',   -- 'draft' | 'active' | 'completed' | 'paused'
  message       text,
  subject       text,                  -- email subject line
  audience_size int not null default 0,
  sent_count    int not null default 0,
  open_count    int not null default 0,
  click_count   int not null default 0,
  scheduled_at  timestamptz,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists campaigns_client_id_idx on campaigns(client_id);
create index if not exists campaigns_status_idx on campaigns(status);

-- ============================================================
-- SUBSCRIPTIONS
-- Paystack billing records for each client
-- ============================================================
create table if not exists subscriptions (
  id                        uuid primary key default uuid_generate_v4(),
  client_id                 uuid not null references clients(id) on delete cascade,
  plan                      text not null,              -- 'starter' | 'growth' | 'pro'
  amount_kes                int not null,               -- e.g. 2000
  billing_cycle             text not null default 'monthly',
  next_billing_date         date,
  paystack_subscription_id  text unique,
  paystack_customer_id      text,
  is_active                 boolean not null default true,
  trial_ends_at             timestamptz,
  cancelled_at              timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists subscriptions_client_id_idx on subscriptions(client_id);

-- ============================================================
-- BOOKINGS (Client Gym Websites)
-- Class/session bookings submitted through a client's gym website
-- ============================================================
create table if not exists bookings (
  id            uuid primary key default uuid_generate_v4(),
  client_id     uuid not null references clients(id) on delete cascade,
  name          text not null,
  phone         text not null,
  email         text,
  service       text,                  -- e.g. 'Morning Yoga', 'Personal Training'
  preferred_date date,
  preferred_time text,
  message       text,
  status        text not null default 'pending',  -- 'pending' | 'confirmed' | 'cancelled'
  created_at    timestamptz not null default now()
);

create index if not exists bookings_client_id_idx on bookings(client_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Each gym owner can only see their own data
-- ============================================================

alter table clients enable row level security;
alter table leads enable row level security;
alter table reviews enable row level security;
alter table campaigns enable row level security;
alter table subscriptions enable row level security;
alter table bookings enable row level security;

-- Clients: owner sees only their row
create policy "clients_owner_access" on clients
  for all using (owner_user_id = auth.uid()::text);

-- Leads: owner sees only leads for their gym
create policy "leads_owner_access" on leads
  for all using (
    client_id in (select id from clients where owner_user_id = auth.uid()::text)
  );

-- Reviews: owner access
create policy "reviews_owner_access" on reviews
  for all using (
    client_id in (select id from clients where owner_user_id = auth.uid()::text)
  );

-- Campaigns: owner access
create policy "campaigns_owner_access" on campaigns
  for all using (
    client_id in (select id from clients where owner_user_id = auth.uid()::text)
  );

-- Subscriptions: owner access
create policy "subscriptions_owner_access" on subscriptions
  for all using (
    client_id in (select id from clients where owner_user_id = auth.uid()::text)
  );

-- Bookings: public INSERT (form submissions), owner SELECT/UPDATE
create policy "bookings_public_insert" on bookings
  for insert with check (true);

create policy "bookings_owner_read" on bookings
  for select using (
    client_id in (select id from clients where owner_user_id = auth.uid()::text)
  );

create policy "bookings_owner_update" on bookings
  for update using (
    client_id in (select id from clients where owner_user_id = auth.uid()::text)
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_updated_at before update on clients
  for each row execute function handle_updated_at();

create trigger leads_updated_at before update on leads
  for each row execute function handle_updated_at();

create trigger campaigns_updated_at before update on campaigns
  for each row execute function handle_updated_at();

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function handle_updated_at();
