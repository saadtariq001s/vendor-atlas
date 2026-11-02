-- A vendor's emirate can now also be read from a branch suffix in its name
-- ("... - Abu Dhabi", "... Dubai Branch").
alter table public.vendors drop constraint if exists vendors_emirate_source_check;
alter table public.vendors add constraint vendors_emirate_source_check
  check (emirate_source in ('address', 'name', 'phone', 'manual'));
