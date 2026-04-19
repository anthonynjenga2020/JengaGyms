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

-- ============================================================
-- MIGRATION 001 — Fix leads table
-- ============================================================

alter table leads add column if not exists interests text[] not null default '{}';
update leads set interests = array[interest] where interest is not null and interest != '';
alter table leads drop column if exists interest;

alter table leads add column if not exists last_contacted_at timestamptz;

update leads set status = 'new_lead'   where status = 'new';
update leads set status = 'joined_gym' where status = 'converted';
update leads set status = 'lost_lead'  where status = 'lost';

alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check
  check (status in ('new_lead','contacted','trial_booked','trial_completed','joined_gym','lost_lead'));

update leads set source = 'website' where source = 'website_form';
update leads set source = 'other'   where source = 'whatsapp';

alter table leads drop constraint if exists leads_source_check;
alter table leads add constraint leads_source_check
  check (source in ('website','instagram','referral','walk_in','google_ads','other'));

-- ============================================================
-- MIGRATION 002 — Fix campaigns table + add platform to reviews
-- ============================================================

update campaigns set type = 'sms_broadcast' where type in ('sms','email','whatsapp');

alter table campaigns drop constraint if exists campaigns_type_check;
alter table campaigns add constraint campaigns_type_check
  check (type in ('sms_broadcast','follow_up','reactivation','promotion','event','review_request'));

alter table campaigns add column if not exists delivered_count  int not null default 0;
alter table campaigns add column if not exists response_count   int not null default 0;
alter table campaigns add column if not exists conversion_count int not null default 0;
alter table campaigns add column if not exists recipient_count  int not null default 0;
alter table campaigns add column if not exists channel text not null default 'sms'
  check (channel in ('sms','whatsapp'));

alter table reviews add column if not exists platform text not null default 'google'
  check (platform in ('google','facebook'));

alter table reviews add column if not exists resolved boolean not null default false;

-- ============================================================
-- MIGRATION 003 — New tables
-- ============================================================

-- TRAINERS
create table if not exists trainers (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  name            text not null,
  role            text not null,
  specialization  text,
  avatar_initials text not null,
  color           text not null default '#4C9FFF',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists trainers_client_id_idx on trainers(client_id);

-- TEAM MEMBERS
create table if not exists team_members (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  name            text not null,
  role            text not null,
  avatar_initials text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists team_members_client_id_idx on team_members(client_id);

-- MEMBERS
create table if not exists members (
  id                      uuid primary key default uuid_generate_v4(),
  client_id               uuid not null references clients(id) on delete cascade,
  name                    text not null,
  phone                   text not null,
  email                   text,
  date_of_birth           date,
  gender                  text check (gender in ('male','female','other')),
  emergency_contact_name  text,
  emergency_contact_phone text,
  plan                    text not null
    check (plan in ('monthly_basic','monthly_premium','annual_basic','annual_premium','pay_per_class','custom')),
  plan_label              text not null,
  start_date              date not null,
  expiry_date             date not null,
  billing_amount          int not null default 0,
  billing_cycle           text not null default 'monthly'
    check (billing_cycle in ('monthly','annual','one_time')),
  next_billing_date       date,
  assigned_trainer        text,
  trainer_id              uuid references trainers(id) on delete set null,
  status                  text not null default 'active'
    check (status in ('active','inactive','expired','frozen')),
  notes                   text,
  streak                  int not null default 0,
  last_visit_at           timestamptz,
  total_visits            int not null default 0,
  height_cm               numeric(5,1),
  weight_kg               numeric(5,1),
  fitness_goal            text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index if not exists members_client_id_idx  on members(client_id);
create index if not exists members_status_idx     on members(status);
create index if not exists members_expiry_idx     on members(expiry_date);
create index if not exists members_trainer_id_idx on members(trainer_id);

-- PAYMENTS
create table if not exists payments (
  id         uuid primary key default uuid_generate_v4(),
  member_id  uuid not null references members(id) on delete cascade,
  client_id  uuid not null references clients(id) on delete cascade,
  amount     int not null,
  method     text not null check (method in ('mpesa','cash','card','bank_transfer')),
  status     text not null default 'paid' check (status in ('paid','pending','failed')),
  date       date not null default current_date,
  reference  text,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists payments_member_id_idx on payments(member_id);
create index if not exists payments_client_id_idx on payments(client_id);
create index if not exists payments_date_idx      on payments(date desc);

-- ATTENDANCE
create table if not exists attendance (
  id               uuid primary key default uuid_generate_v4(),
  member_id        uuid not null references members(id) on delete cascade,
  client_id        uuid not null references clients(id) on delete cascade,
  date             date not null,
  time_in          text not null,
  duration_minutes int not null default 60,
  created_at       timestamptz not null default now(),
  unique (member_id, date)
);
create index if not exists attendance_member_id_idx on attendance(member_id);
create index if not exists attendance_client_id_idx on attendance(client_id);
create index if not exists attendance_date_idx      on attendance(date desc);

-- CLASSES
create table if not exists classes (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid not null references clients(id) on delete cascade,
  name           text not null,
  category       text not null
    check (category in ('hiit','yoga','strength','cardio','pilates','boxing','spinning','general')),
  description    text,
  type           text not null default 'one_time' check (type in ('recurring','one_time')),
  date           date not null,
  start_time     text not null,
  end_time       text not null,
  location       text,
  max_capacity   int not null default 20,
  booked_count   int not null default 0,
  trainer_id     uuid references trainers(id) on delete set null,
  status         text not null default 'active' check (status in ('active','cancelled')),
  allow_waitlist boolean not null default false,
  max_waitlist   int not null default 0,
  repeat         text check (repeat in ('daily','weekly','monthly')),
  end_date       date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists classes_client_id_idx on classes(client_id);
create index if not exists classes_date_idx      on classes(date);
create index if not exists classes_trainer_idx   on classes(trainer_id);

-- CLASS ATTENDEES
create table if not exists class_attendees (
  id                uuid primary key default uuid_generate_v4(),
  class_id          uuid not null references classes(id) on delete cascade,
  client_id         uuid not null references clients(id) on delete cascade,
  member_id         uuid references members(id) on delete set null,
  member_name       text not null,
  member_plan       text,
  is_walkin         boolean not null default false,
  attendance_status text not null default 'pending'
    check (attendance_status in ('present','absent','pending')),
  created_at        timestamptz not null default now()
);
create index if not exists class_attendees_class_id_idx  on class_attendees(class_id);
create index if not exists class_attendees_member_id_idx on class_attendees(member_id);
create index if not exists class_attendees_client_id_idx on class_attendees(client_id);

-- CLASS WAITLIST
create table if not exists class_waitlist (
  id          uuid primary key default uuid_generate_v4(),
  class_id    uuid not null references classes(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  member_id   uuid not null references members(id) on delete cascade,
  member_name text not null,
  position    int not null,
  added_at    timestamptz not null default now(),
  unique (class_id, member_id)
);
create index if not exists class_waitlist_class_id_idx  on class_waitlist(class_id);
create index if not exists class_waitlist_client_id_idx on class_waitlist(client_id);

-- CONVERSATIONS
create table if not exists conversations (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  contact_name    text not null,
  contact_phone   text not null,
  contact_email   text,
  channel         text not null check (channel in ('whatsapp','sms','instagram','website_chat')),
  status          text not null default 'open' check (status in ('open','resolved')),
  assigned_to     uuid references team_members(id) on delete set null,
  last_message    text,
  last_message_at timestamptz not null default now(),
  unread_count    int not null default 0,
  tags            text[] not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists conversations_client_id_idx       on conversations(client_id);
create index if not exists conversations_status_idx          on conversations(status);
create index if not exists conversations_last_message_at_idx on conversations(last_message_at desc);

-- MESSAGES
create table if not exists messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  direction       text not null check (direction in ('inbound','outbound')),
  body            text not null,
  sender_name     text not null,
  sent_at         timestamptz not null default now(),
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists messages_conversation_id_idx on messages(conversation_id);
create index if not exists messages_client_id_idx       on messages(client_id);
create index if not exists messages_sent_at_idx         on messages(sent_at asc);

-- QUICK REPLY TEMPLATES
create table if not exists quick_reply_templates (
  id         uuid primary key default uuid_generate_v4(),
  client_id  uuid not null references clients(id) on delete cascade,
  category   text not null check (category in ('greeting','pricing','booking','follow_up','payment')),
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quick_reply_templates_client_id_idx on quick_reply_templates(client_id);

-- LEAD ACTIVITIES
create table if not exists lead_activities (
  id          uuid primary key default uuid_generate_v4(),
  lead_id     uuid not null references leads(id) on delete cascade,
  client_id   uuid not null references clients(id) on delete cascade,
  type        text not null
    check (type in ('lead_created','stage_changed','note_added','call_made','trial_booked')),
  description text not null,
  created_at  timestamptz not null default now()
);
create index if not exists lead_activities_lead_id_idx    on lead_activities(lead_id);
create index if not exists lead_activities_client_id_idx  on lead_activities(client_id);
create index if not exists lead_activities_created_at_idx on lead_activities(created_at desc);

-- AUTOMATIONS
create table if not exists automations (
  id             uuid primary key default uuid_generate_v4(),
  client_id      uuid not null references clients(id) on delete cascade,
  name           text not null,
  emoji          text not null default '⚡',
  icon_color     text not null default '#4C9FFF',
  trigger        text not null,
  trigger_days   int,
  action_summary text,
  stats_text     text,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists automations_client_id_idx on automations(client_id);
create index if not exists automations_active_idx    on automations(active);

-- AUTOMATION STEPS
create table if not exists automation_steps (
  id            uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references automations(id) on delete cascade,
  step_order    int not null,
  type          text not null
    check (type in ('send_sms','wait','update_stage','assign_team','add_tag')),
  message       text,
  wait_duration text,
  stage         text,
  team_member   text,
  tag           text,
  created_at    timestamptz not null default now()
);
create index if not exists automation_steps_automation_id_idx on automation_steps(automation_id);

-- BROADCASTS
create table if not exists broadcasts (
  id              uuid primary key default uuid_generate_v4(),
  client_id       uuid not null references clients(id) on delete cascade,
  recipient_label text not null,
  message         text not null,
  status          text not null default 'scheduled' check (status in ('sent','scheduled','failed')),
  sent_at         timestamptz,
  scheduled_at    timestamptz,
  recipient_count int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists broadcasts_client_id_idx on broadcasts(client_id);
create index if not exists broadcasts_status_idx    on broadcasts(status);

-- BROADCAST RECIPIENTS
create table if not exists broadcast_recipients (
  id              uuid primary key default uuid_generate_v4(),
  broadcast_id    uuid not null references broadcasts(id) on delete cascade,
  client_id       uuid not null references clients(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('member','lead')),
  delivery_status text not null default 'pending'
    check (delivery_status in ('delivered','failed','pending')),
  ref_id          uuid,
  created_at      timestamptz not null default now()
);
create index if not exists broadcast_recipients_broadcast_id_idx on broadcast_recipients(broadcast_id);
create index if not exists broadcast_recipients_client_id_idx    on broadcast_recipients(client_id);

-- SMS TEMPLATES
create table if not exists sms_templates (
  id         uuid primary key default uuid_generate_v4(),
  client_id  uuid not null references clients(id) on delete cascade,
  title      text not null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sms_templates_client_id_idx on sms_templates(client_id);

-- REVIEW REQUESTS
create table if not exists review_requests (
  id           uuid primary key default uuid_generate_v4(),
  client_id    uuid not null references clients(id) on delete cascade,
  member_id    uuid references members(id) on delete set null,
  member_name  text not null,
  member_phone text not null,
  platform     text not null check (platform in ('google','facebook')),
  sent_at      timestamptz not null default now(),
  status       text not null default 'pending'
    check (status in ('pending','reviewed','no_response')),
  created_at   timestamptz not null default now()
);
create index if not exists review_requests_client_id_idx on review_requests(client_id);
create index if not exists review_requests_status_idx    on review_requests(status);

-- ============================================================
-- MIGRATION 004 — Enable RLS on new tables
-- ============================================================

alter table trainers              enable row level security;
alter table team_members          enable row level security;
alter table members               enable row level security;
alter table payments              enable row level security;
alter table attendance            enable row level security;
alter table classes               enable row level security;
alter table class_attendees       enable row level security;
alter table class_waitlist        enable row level security;
alter table conversations         enable row level security;
alter table messages              enable row level security;
alter table quick_reply_templates enable row level security;
alter table lead_activities       enable row level security;
alter table automations           enable row level security;
alter table automation_steps      enable row level security;
alter table broadcasts            enable row level security;
alter table broadcast_recipients  enable row level security;
alter table sms_templates         enable row level security;
alter table review_requests       enable row level security;

create policy "trainers_owner_access"              on trainers              for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "team_members_owner_access"          on team_members          for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "members_owner_access"               on members               for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "payments_owner_access"              on payments              for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "attendance_owner_access"            on attendance            for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "classes_owner_access"               on classes               for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "class_attendees_owner_access"       on class_attendees       for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "class_waitlist_owner_access"        on class_waitlist        for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "conversations_owner_access"         on conversations         for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "messages_owner_access"              on messages              for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "quick_reply_templates_owner_access" on quick_reply_templates for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "lead_activities_owner_access"       on lead_activities       for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "automations_owner_access"           on automations           for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "automation_steps_owner_access"      on automation_steps      for all using (automation_id in (select id from automations where client_id in (select id from clients where owner_user_id = auth.uid()::text)));
create policy "broadcasts_owner_access"            on broadcasts            for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "broadcast_recipients_owner_access"  on broadcast_recipients  for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "sms_templates_owner_access"         on sms_templates         for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));
create policy "review_requests_owner_access"       on review_requests       for all using (client_id in (select id from clients where owner_user_id = auth.uid()::text));

-- ============================================================
-- MIGRATION 005 — Triggers for new tables + helper functions
-- ============================================================

create trigger trainers_updated_at              before update on trainers              for each row execute function handle_updated_at();
create trigger team_members_updated_at          before update on team_members          for each row execute function handle_updated_at();
create trigger members_updated_at               before update on members               for each row execute function handle_updated_at();
create trigger classes_updated_at               before update on classes               for each row execute function handle_updated_at();
create trigger conversations_updated_at         before update on conversations         for each row execute function handle_updated_at();
create trigger quick_reply_templates_updated_at before update on quick_reply_templates for each row execute function handle_updated_at();
create trigger automations_updated_at           before update on automations           for each row execute function handle_updated_at();
create trigger broadcasts_updated_at            before update on broadcasts            for each row execute function handle_updated_at();
create trigger sms_templates_updated_at         before update on sms_templates         for each row execute function handle_updated_at();

-- Auto-sync booked_count when class_attendees rows are inserted/deleted
create or replace function sync_booked_count()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    update classes set booked_count = booked_count + 1 where id = new.class_id;
  elsif TG_OP = 'DELETE' then
    update classes set booked_count = greatest(booked_count - 1, 0) where id = old.class_id;
  end if;
  return null;
end;
$$ language plpgsql;

create trigger class_attendees_booked_count
  after insert or delete on class_attendees
  for each row execute function sync_booked_count();

-- Auto-create stub clients row when a new auth user signs up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.clients (owner_user_id, gym_name, plan, status)
  values (new.id::text, '', 'starter', 'active')
  on conflict (owner_user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
