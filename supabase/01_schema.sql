-- =====================================================================
-- BARAKAT database schema (Supabase / Postgres 15 or newer)
-- Run this first, in the Supabase SQL Editor. Safe to run more than once.
-- =====================================================================

-- ---------- helper functions used by the seed files ------------------
-- _i('batch','12')  -> a stable uuid derived from a label (so seed rows can reference each other briefly)
-- _t(-90)           -> "90 minutes ago"; _t(15) -> "in 15 minutes" (so sample data always looks fresh)
create or replace function public._i(kind text, key text) returns uuid
language sql immutable as $$ select md5(kind || ':' || key)::uuid $$;

create or replace function public._t(minutes integer) returns timestamptz
language sql stable as $$ select now() + make_interval(mins => minutes) $$;

-- Straight-line distance in km, used by the matcher in later steps.
create or replace function public.haversine_km(lat1 double precision, lng1 double precision,
                                               lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

-- ---------- enums ----------------------------------------------------
do $$ begin create type public.user_role as enum ('restaurant', 'volunteer', 'coordinator', 'fridge_host');
exception when duplicate_object then null; end $$;
do $$ begin create type public.venue_type as enum ('restaurant', 'hotel', 'cloud_kitchen', 'bakery', 'cafe', 'catering', 'supermarket');
exception when duplicate_object then null; end $$;
do $$ begin create type public.food_tier as enum ('green', 'amber', 'red');
exception when duplicate_object then null; end $$;
do $$ begin create type public.batch_status as enum ('draft', 'screened', 'listed', 'matched', 'dispatched', 'picked_up', 'delivered', 'closed', 'rejected', 'escalated', 'expired');
exception when duplicate_object then null; end $$;
do $$ begin create type public.job_status as enum ('offered', 'accepted', 'declined', 'timed_out', 'picked_up', 'delivered', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin create type public.fridge_status as enum ('active', 'paused', 'offline');
exception when duplicate_object then null; end $$;
do $$ begin create type public.transport_type as enum ('car', 'van', 'scooter', 'bike', 'on_foot');
exception when duplicate_object then null; end $$;
do $$ begin create type public.volunteer_status as enum ('available', 'busy', 'offline');
exception when duplicate_object then null; end $$;
do $$ begin create type public.storage_type as enum ('ambient', 'chilled');
exception when duplicate_object then null; end $$;

-- ---------- configuration (safety rules and impact factors live here) --
create table if not exists public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- core tables ------------------------------------------------
create table if not exists public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  venue_type    public.venue_type not null,
  cuisine       text,
  area          text not null,
  lat           double precision not null,
  lng           double precision not null,
  contact_name  text,
  esg_points    integer not null default 0,
  owner_user_id uuid references auth.users (id) on delete set null,
  is_sample     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.fridges (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  area              text not null,
  lat               double precision not null,
  lng               double precision not null,
  host_type         text,
  placement         text check (placement in ('indoor', 'outdoor_shaded')),
  capacity_portions integer not null check (capacity_portions > 0),
  current_stock     integer not null default 0 check (current_stock >= 0),
  status            public.fridge_status not null default 'active',
  open_24h          boolean not null default true,
  open_from         time,
  open_to           time,
  is_sample         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint fridge_stock_within_capacity check (current_stock <= capacity_portions)
);

create table if not exists public.volunteers (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  full_name        text not null,
  area             text not null,
  lat              double precision not null,
  lng              double precision not null,
  transport        public.transport_type not null,
  max_radius_km    numeric(4, 1) not null,
  max_portions     integer not null,
  languages        text[] not null default '{}',
  status           public.volunteer_status not null default 'available',
  total_deliveries integer not null default 0,
  joined_at        timestamptz not null default now(),
  is_sample        boolean not null default false,
  created_at       timestamptz not null default now()
);

create table if not exists public.batches (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  status        public.batch_status not null default 'draft',
  tier          public.food_tier,
  submitted_at  timestamptz not null default now(),
  prepared_at   timestamptz,
  stored_temp_c numeric(4, 1),
  storage       public.storage_type,
  allergens     text[] not null default '{}',
  est_portions  integer,
  est_kg        numeric(7, 1),
  confidence    numeric(3, 2),
  photo_path    text,
  notes         text,
  pickup_from   timestamptz,
  pickup_until  timestamptz,
  safe_until    timestamptz,
  fridge_id     uuid references public.fridges (id) on delete set null,
  reject_reason text,
  is_sample     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.batch_items (
  id        uuid primary key default gen_random_uuid(),
  batch_id  uuid not null references public.batches (id) on delete cascade,
  name      text not null,
  category  text not null,
  portions  integer not null check (portions > 0),
  kg        numeric(6, 1),
  storage   public.storage_type,
  allergens text[] not null default '{}',
  is_sample boolean not null default false
);

create table if not exists public.safety_checks (
  id               uuid primary key default gen_random_uuid(),
  batch_id         uuid not null references public.batches (id) on delete cascade,
  rule_set_version text not null,
  tier             public.food_tier not null,
  passed           boolean not null,
  confidence       numeric(3, 2),
  reasons          jsonb not null default '[]',
  decided_by       text not null check (decided_by in ('agent', 'coordinator')),
  created_at       timestamptz not null default now(),
  is_sample        boolean not null default false
);

create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.batches (id) on delete cascade,
  volunteer_id    uuid references public.volunteers (id) on delete set null,
  fridge_id       uuid references public.fridges (id) on delete set null,
  status          public.job_status not null default 'offered',
  attempt         integer not null default 1,
  offered_at      timestamptz not null default now(),
  responded_at    timestamptz,
  picked_up_at    timestamptz,
  delivered_at    timestamptz,
  distance_km     numeric(5, 1),
  pickup_eta_min  integer,
  is_sample       boolean not null default false
);

create table if not exists public.agent_events (
  id         uuid primary key default gen_random_uuid(),
  batch_id   uuid not null references public.batches (id) on delete cascade,
  job_id     uuid references public.jobs (id) on delete set null,
  event_type text not null,
  actor      text not null check (actor in ('restaurant', 'agent', 'volunteer', 'coordinator', 'system')),
  tone       text not null default 'neutral' check (tone in ('neutral', 'green', 'amber', 'red')),
  title      text not null,
  detail     text,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now(),
  is_sample  boolean not null default false
);

create table if not exists public.fridge_stock_log (
  id             uuid primary key default gen_random_uuid(),
  fridge_id      uuid not null references public.fridges (id) on delete cascade,
  batch_id       uuid references public.batches (id) on delete set null,
  delta_portions integer not null,
  reason         text not null check (reason in ('delivered', 'taken', 'expired')),
  created_at     timestamptz not null default now(),
  is_sample      boolean not null default false
);

create table if not exists public.impact_logs (
  id             uuid primary key default gen_random_uuid(),
  batch_id       uuid not null unique references public.batches (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  meals          integer not null,
  kg             numeric(7, 1) not null,
  co2e_kg        numeric(8, 1) not null,
  esg_points     integer not null,
  factor_version text not null,
  created_at     timestamptz not null default now(),
  is_sample      boolean not null default false
);

-- Links a sign-in (auth.users) to a role and, where relevant, a restaurant, fridge or volunteer record.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  role          public.user_role not null default 'volunteer',
  full_name     text,
  locale        text not null default 'en' check (locale in ('en', 'ar')),
  restaurant_id uuid references public.restaurants (id) on delete set null,
  fridge_id     uuid references public.fridges (id) on delete set null,
  volunteer_id  uuid references public.volunteers (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- indexes ----------------------------------------------------
create index if not exists idx_batches_restaurant on public.batches (restaurant_id, submitted_at desc);
create index if not exists idx_batches_status on public.batches (status);
create index if not exists idx_batches_submitted on public.batches (submitted_at desc);
create index if not exists idx_items_batch on public.batch_items (batch_id);
create index if not exists idx_checks_batch on public.safety_checks (batch_id);
create index if not exists idx_jobs_batch on public.jobs (batch_id);
create index if not exists idx_jobs_volunteer on public.jobs (volunteer_id, status);
create index if not exists idx_events_batch on public.agent_events (batch_id, created_at);
create index if not exists idx_events_recent on public.agent_events (created_at desc);
create index if not exists idx_stock_fridge on public.fridge_stock_log (fridge_id, created_at desc);
create index if not exists idx_impact_restaurant on public.impact_logs (restaurant_id, created_at desc);
create index if not exists idx_fridges_status on public.fridges (status);

-- ---------- triggers ---------------------------------------------------
drop trigger if exists trg_batches_updated on public.batches;
create trigger trg_batches_updated before update on public.batches
  for each row execute function public.set_updated_at();
drop trigger if exists trg_fridges_updated on public.fridges;
create trigger trg_fridges_updated before update on public.fridges
  for each row execute function public.set_updated_at();
drop trigger if exists trg_config_updated on public.app_config;
create trigger trg_config_updated before update on public.app_config
  for each row execute function public.set_updated_at();

-- New sign-ups get a profile. Self-service roles only: nobody can sign up as a coordinator.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'volunteer');
begin
  insert into public.profiles (id, role, full_name, locale)
  values (
    new.id,
    case when requested in ('restaurant', 'volunteer', 'fridge_host')
         then requested::public.user_role else 'volunteer'::public.user_role end,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when new.raw_user_meta_data ->> 'locale' = 'ar' then 'ar' else 'en' end
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- views (they respect the caller's row-level security) ------
create or replace view public.v_platform_totals with (security_invoker = true) as
select
  coalesce(sum(meals), 0)::int             as meals,
  coalesce(sum(kg), 0)::numeric(10, 1)     as kg,
  coalesce(sum(co2e_kg), 0)::numeric(10, 1) as co2e_kg,
  count(*)::int                            as rescued_batches
from public.impact_logs;

create or replace view public.v_restaurant_impact_monthly with (security_invoker = true) as
select
  restaurant_id,
  date_trunc('month', created_at) as month,
  sum(meals)::int                 as meals,
  sum(kg)::numeric(10, 1)         as kg,
  sum(co2e_kg)::numeric(10, 1)    as co2e_kg,
  sum(esg_points)::int            as esg_points
from public.impact_logs
group by restaurant_id, date_trunc('month', created_at);

create or replace view public.v_fridge_overview with (security_invoker = true) as
select
  id, code, name, area, lat, lng, status, capacity_portions, current_stock,
  round(100.0 * current_stock / nullif(capacity_portions, 0))::int as fill_pct,
  open_24h, open_from, open_to, is_sample
from public.fridges;

-- ---------- realtime (live timeline and map in later steps) -----------
do $$ begin
  begin alter publication supabase_realtime add table public.agent_events;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.jobs;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.batches;
  exception when duplicate_object then null; when undefined_object then null; end;
  begin alter publication supabase_realtime add table public.fridges;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;

-- ---------- private bucket for surplus-food photos --------------------
insert into storage.buckets (id, name, public)
values ('surplus-photos', 'surplus-photos', false)
on conflict (id) do nothing;
