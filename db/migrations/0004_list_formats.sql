-- Richer imports: lists shaped differently from the original sheet, such as
-- an approved-contractor list with one row per company and work group.
--
--   activity_codes  offering label -> its code in the source list ("110010")
--   associates      companies the vendor is associated with, [{name, country}]
--   sources         the files a vendor has appeared in
--   name_cut        the name came from a list that cuts long names short; a
--                   later file with the full name replaces it
--   search_extra    codes and associate names, kept by the app, so searching
--                   "110010" or "Schneider" finds the vendor
alter table public.vendors add column if not exists activity_codes jsonb   not null default '{}'::jsonb;
alter table public.vendors add column if not exists associates     jsonb   not null default '[]'::jsonb;
alter table public.vendors add column if not exists sources        text[]  not null default '{}';
alter table public.vendors add column if not exists name_cut       boolean not null default false;
alter table public.vendors add column if not exists search_extra   text;

alter table public.vendors drop column if exists search;
alter table public.vendors add column search tsvector generated always as (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(activities_raw, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(address, '') || ' ' || coalesce(emirate, '') || ' ' || coalesce(search_extra, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(notes, '')), 'D')
) stored;

create index if not exists vendors_search_idx on public.vendors using gin (search);
create index if not exists vendors_name_cut_idx on public.vendors (name_cut) where name_cut;
