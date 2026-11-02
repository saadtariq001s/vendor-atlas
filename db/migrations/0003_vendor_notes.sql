-- Free-text notes the team keeps on each vendor ("Additional notes" in the
-- edit form). Notes are searchable, at the lowest weight, so a word written
-- in a note ("reliable", "late on delivery") also finds the vendor.
alter table public.vendors add column if not exists notes text;

alter table public.vendors drop column if exists search;
alter table public.vendors add column search tsvector generated always as (
  setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(activities_raw, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(address, '') || ' ' || coalesce(emirate, '')), 'C') ||
  setweight(to_tsvector('english', coalesce(notes, '')), 'D')
) stored;

create index if not exists vendors_search_idx on public.vendors using gin (search);
