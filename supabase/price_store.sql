-- Price store for cheapflights: cached Travelpayouts tickets for BTS, VIE, BUD, KSC and PRG.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to run again (nothing is dropped).
-- It does not touch the existing tables (destinations, hostels, weekly_deals, airports, price_snapshots).

-- 1. One row = one ticket: the cheapest the price service knows for that route, departure day and return day.
create table if not exists public.price_tickets (
  id bigint generated always as identity primary key,
  origin text not null,                        -- home airport the ticket leaves from (BTS, VIE, BUD, KSC, PRG)
  destination text not null,                   -- destination city code (MIL, LON, ...)
  destination_airport text,                    -- the airport it lands at (MXP, STN, ...), when the service says
  departure_at text not null,                  -- local departure time exactly as the service gives it, e.g. 2026-12-12T06:50:00+01:00
  departure_date date not null,                -- the departure day
  return_at text,                              -- local time of the flight back (round-trip tickets only)
  return_date date,                            -- the return day (round-trip tickets only)
  one_way boolean not null,                    -- true = a one-way ticket, false = ONE price for both flights
  price integer not null,                      -- euro
  airline text,
  flight_number text,
  transfers smallint,                          -- stops on the way out
  return_transfers smallint,                   -- stops on the way back
  duration smallint,                           -- minutes, whole trip
  gate text,                                   -- booking site that found the fare
  link text,                                   -- Aviasales deep link to this exact ticket (a path), when given
  month text not null,                         -- the month the ticket was asked for, YYYY-MM
  source text not null,                        -- 'month-cheapest' (cheapest per destination), 'route-month' (every day of a route), 'live' (fetched for a visitor)
  found_at timestamptz not null default now(), -- when this site got the ticket from the price service
  -- one ticket per route, departure day and return day; a one-way ticket has no return day (nulls count as equal here)
  constraint price_tickets_key unique nulls not distinct (origin, destination, departure_date, return_date, one_way)
);
create index if not exists price_tickets_overview on public.price_tickets (origin, month, one_way, price);
create index if not exists price_tickets_route on public.price_tickets (origin, destination, month);
create index if not exists price_tickets_found on public.price_tickets (found_at);

-- 2. Which route-months have day-by-day data and when they were fetched. destination '*' = the month summary of an airport.
create table if not exists public.price_coverage (
  origin text not null,
  destination text not null,
  month text not null,
  one_way boolean not null,
  fetched_at timestamptz not null default now(),
  tickets integer not null default 0,
  source text not null,                        -- 'nightly' or 'live'
  primary key (origin, destination, month, one_way)
);

-- 3. The log of the nightly job: one row per run, what it did and any problem.
create table if not exists public.price_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',      -- running, done, failed
  slices integer not null default 0,           -- how many separate function calls the run needed
  requests integer not null default 0,         -- requests made to the price service
  tickets integer not null default 0,          -- tickets written
  jobs_pending integer not null default 0,
  jobs_failed integer not null default 0,
  note text
);

-- 4. The work list of a run, so a run can carry on in a later function call and a failed item stays visible.
create table if not exists public.price_jobs (
  id bigint generated always as identity primary key,
  run_id bigint not null references public.price_runs (id) on delete cascade,
  kind text not null,                          -- 'summary' (all destinations of an airport for a month) or 'route' (one destination, every day)
  origin text not null,
  destination text,                            -- empty for 'summary'
  month text not null,
  one_way boolean not null,
  status text not null default 'pending',      -- pending, done, failed
  attempts smallint not null default 0,
  error text,
  done_at timestamptz
);
create index if not exists price_jobs_run on public.price_jobs (run_id, status, id);
-- Each piece of work exists once per run (also when the file is run again on an existing table).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'price_jobs_key') then
    alter table public.price_jobs add constraint price_jobs_key unique nulls not distinct (run_id, kind, origin, destination, month, one_way);
  end if;
end $$;

-- 5. The overview question in one query: for each airport and destination, the cheapest ticket of a month.
create or replace function public.price_overview(p_origins text[], p_month text, p_one_way boolean)
returns setof public.price_tickets
language sql stable as $$
  select distinct on (origin, destination) *
  from public.price_tickets
  where origin = any(p_origins) and month = p_month and one_way = p_one_way
  order by origin, destination, price asc, found_at desc
$$;

-- 6. How big the store is (rows and bytes per table), for the size check.
create or replace function public.price_store_stats()
returns table (table_name text, row_count bigint, bytes bigint)
language sql stable as $$
  select 'price_tickets', (select count(*) from public.price_tickets), pg_total_relation_size('public.price_tickets')
  union all select 'price_coverage', (select count(*) from public.price_coverage), pg_total_relation_size('public.price_coverage')
  union all select 'price_runs', (select count(*) from public.price_runs), pg_total_relation_size('public.price_runs')
  union all select 'price_jobs', (select count(*) from public.price_jobs), pg_total_relation_size('public.price_jobs')
$$;

-- Only the server (service key) may read or write these tables: no policies exist for the public (anon) key.
alter table public.price_tickets enable row level security;
alter table public.price_coverage enable row level security;
alter table public.price_runs enable row level security;
alter table public.price_jobs enable row level security;
