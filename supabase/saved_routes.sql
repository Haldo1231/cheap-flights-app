-- Saved routes for cheapflights: a signed-in visitor's favourite searches (route + dates), NOT tickets.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run again (nothing is dropped).
-- It does not touch any other table. Needs Supabase Auth (Google sign-in) for rows to exist at all.
--
-- WHO SEES WHAT: Row Level Security is ON. A signed-in person can read, add and delete ONLY rows whose user_id is their
-- own id; nobody can change a row (no update policy). The public (not signed-in) key can do nothing at all here.
-- The site never uses the service key for this table, so these rules are what protects the data.

-- 1. One row = one saved search of one person.
create table if not exists public.saved_routes (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origins text not null,                       -- home airport(s), sorted and comma-separated: 'BTS' or 'BTS,VIE'
  destination text not null,                   -- destination city code (ROM, MIL, ...)
  one_way boolean not null,                    -- true = one way, false = round trip
  date_mode text not null,                     -- 'exact' (dates), 'range' (date range), 'month' (whole month), 'any' (no date picked)
  date_from date,                              -- exact: departure day; range: first day; month: the 1st of the departure month; any: empty
  date_to date,                                -- exact: return day (round trip only); range: last day; month: the 1st of the return month (round trip only); any: empty
  min_nights smallint,                         -- range + round trip only
  max_nights smallint,                         -- range + round trip only
  saved_price integer,                         -- euro: the cheapest stored price for this search when it was saved (empty = none)
  saved_price_seen_at timestamptz,             -- when the site got that price from the price service
  created_at timestamptz not null default now(),
  constraint saved_routes_origins check (origins ~ '^[A-Z]{3}(,[A-Z]{3}){0,5}$'),
  constraint saved_routes_destination check (destination ~ '^[A-Z]{3}$'),
  constraint saved_routes_mode check (
    (date_mode = 'exact' and date_from is not null and (one_way = (date_to is null)) and min_nights is null and max_nights is null)
    or (date_mode = 'range' and date_from is not null and date_to is not null and date_to >= date_from
        and ((one_way and min_nights is null and max_nights is null) or (not one_way and min_nights between 1 and 30 and max_nights between min_nights and 30)))
    or (date_mode = 'month' and date_from is not null and extract(day from date_from) = 1 and min_nights is null and max_nights is null
        and ((one_way and date_to is null) or (not one_way and date_to is not null and extract(day from date_to) = 1 and date_to >= date_from)))
    or (date_mode = 'any' and date_from is null and date_to is null and min_nights is null and max_nights is null)
  ),
  constraint saved_routes_price check (saved_price is null or saved_price between 0 and 100000),
  -- the same search (route + kind + dates) can be saved only once per person; empty dates count as equal here
  constraint saved_routes_key unique nulls not distinct (user_id, origins, destination, one_way, date_mode, date_from, date_to, min_nights, max_nights)
);
create index if not exists saved_routes_user on public.saved_routes (user_id, created_at desc);

-- 2. A person can keep at most 100 saved searches (also when someone writes to the table directly with their own login).
create or replace function public.saved_routes_limit() returns trigger
language plpgsql set search_path = public as $$
begin
  if (select count(*) from public.saved_routes where user_id = new.user_id) >= 100 then
    raise exception 'saved_routes: at most 100 saved searches per person';
  end if;
  return new;
end $$;
drop trigger if exists saved_routes_limit on public.saved_routes;
create trigger saved_routes_limit before insert on public.saved_routes for each row execute function public.saved_routes_limit();

-- 3. Row Level Security: own rows only.
alter table public.saved_routes enable row level security;
alter table public.saved_routes force row level security;

drop policy if exists "saved_routes: read own" on public.saved_routes;
create policy "saved_routes: read own" on public.saved_routes
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "saved_routes: add own" on public.saved_routes;
create policy "saved_routes: add own" on public.saved_routes
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "saved_routes: delete own" on public.saved_routes;
create policy "saved_routes: delete own" on public.saved_routes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- No update policy on purpose: a saved search is added or deleted, never changed.

-- 4. Table rights: nothing for the public key, only read/add/delete for signed-in people (the policies above still apply).
revoke all on public.saved_routes from anon, authenticated;
grant select, insert, delete on public.saved_routes to authenticated;

-- 5. Check (optional): this must say rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where tablename = 'saved_routes';
