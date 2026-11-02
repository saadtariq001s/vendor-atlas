-- ─────────────────────────────────────────────────────────────
-- Vendor Atlas — initial schema
-- ─────────────────────────────────────────────────────────────

create extension if not exists pg_trgm;

-- One row per company. Contact fields are kept exactly as entered (a cell may
-- hold several emails or numbers); the app parses them for display.
create table if not exists public.vendors (
  id              bigint generated always as identity primary key,
  name            text not null,
  name_key        text not null,          -- normalised name, the import match key
  email           text,
  phone           text,
  address         text,
  activities_raw  text,                   -- the original "Area of Business" text
  activities      text[] not null default '{}',
  sectors         text[] not null default '{}',
  emirate         text,
  emirate_source  text check (emirate_source in ('address', 'phone', 'manual')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Name weighs most, then what they do, then where they are.
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(activities_raw, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(address, '') || ' ' || coalesce(emirate, '')), 'C')
  ) stored
);

create unique index if not exists vendors_name_key_idx on public.vendors (name_key);
create index if not exists vendors_search_idx     on public.vendors using gin (search);
create index if not exists vendors_sectors_idx    on public.vendors using gin (sectors);
create index if not exists vendors_activities_idx on public.vendors using gin (activities);
create index if not exists vendors_emirate_idx    on public.vendors (emirate);
create index if not exists vendors_name_trgm_idx  on public.vendors using gin (name gin_trgm_ops);
create index if not exists vendors_created_idx    on public.vendors (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vendors_set_updated_at on public.vendors;
create trigger vendors_set_updated_at
  before update on public.vendors
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Accounts. 'admin' can change data; 'viewer' can only browse.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.app_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text not null,
  role          text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at    timestamptz not null default now()
);

-- Only the SHA-256 of each session token is stored.
create table if not exists public.sessions (
  token_hash  text primary key,
  user_id     uuid not null references public.app_users (id) on delete cascade,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index if not exists sessions_user_idx on public.sessions (user_id);

-- What changed, by whom. Shown on the Manage page.
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  user_email  text,
  action      text not null,      -- import | create | update | delete
  summary     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- This app connects as the database owner over DATABASE_URL and enforces
-- access itself. If the database is a Supabase project, lock the tables away
-- from the public REST API: RLS on, no policies, so anon/authenticated roles
-- see nothing.
alter table public.vendors   enable row level security;
alter table public.app_users enable row level security;
alter table public.sessions  enable row level security;
alter table public.audit_log enable row level security;
