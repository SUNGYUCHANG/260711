create table if not exists saju_draws (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  birth_date date not null,
  birth_time text,
  gender text,
  main_numbers integer[] not null,
  bonus_number integer not null,
  message text
);

-- RLS is off by default on new Supabase tables; inserts happen server-side
-- with the service role key (which bypasses RLS regardless), so this is
-- safe as-is. Enable RLS below if you also want to read this table from
-- the browser with the anon key.
-- alter table saju_draws enable row level security;
