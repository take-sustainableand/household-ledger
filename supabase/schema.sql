-- Supabase schema for Sustainable Household Ledger

alter table if exists public.households disable row level security;
alter table if exists public.users_households disable row level security;
alter table if exists public.profiles disable row level security;
alter table if exists public.statements disable row level security;
alter table if exists public.transactions disable row level security;
alter table if exists public.comments disable row level security;

create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text check (role in ('papa', 'mama', 'other')),
  default_tag text check (default_tag in ('papa', 'mama', 'shared')),
  created_at timestamptz not null default now()
);

create table if not exists users_households (
  user_id uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (user_id, household_id)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  code text not null,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists categories_household_code_idx
  on categories (household_id, code);

create table if not exists statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  source text not null,
  original_filename text,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  unique (household_id, year, month, source)
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references statements(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  posting_date date not null,
  transaction_date date,
  amount numeric(12, 2) not null,
  category_id uuid references categories(id),
  description text,
  raw_merchant text,
  user_tag text not null default 'shared'
    check (user_tag in ('papa', 'mama', 'shared')),
  is_excluded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists transactions_household_posting_idx
  on transactions (household_id, posting_date);

create index if not exists transactions_household_category_idx
  on transactions (household_id, category_id);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  scope_type text not null check (scope_type in ('month', 'category', 'tag', 'overall')),
  scope_key text not null,
  content text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists comments_household_scope_idx
  on comments (household_id, scope_type, scope_key);

alter table public.households enable row level security;
alter table public.users_households enable row level security;
alter table public.profiles enable row level security;
alter table public.statements enable row level security;
alter table public.transactions enable row level security;
alter table public.comments enable row level security;

create policy "Users can see their households"
  on public.households
  for select
  using (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = households.id
        and uh.user_id = auth.uid()
    )
  );

create policy "Users can create households"
  on public.households
  for insert
  with check (true);

create policy "Users can manage their memberships"
  on public.users_households
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Users can see their memberships"
  on public.users_households
  for select
  using (user_id = auth.uid());

create policy "Users can see their profiles"
  on public.profiles
  for select
  using (id = auth.uid());

create policy "Users can create their profiles"
  on public.profiles
  for insert
  with check (id = auth.uid());

create policy "Users can update their profiles"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Access statements by household membership"
  on public.statements
  for all
  using (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = statements.household_id
        and uh.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = statements.household_id
        and uh.user_id = auth.uid()
    )
  );

create policy "Access transactions by household membership"
  on public.transactions
  for all
  using (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = transactions.household_id
        and uh.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = transactions.household_id
        and uh.user_id = auth.uid()
    )
  );

create policy "Access comments by household membership"
  on public.comments
  for all
  using (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = comments.household_id
        and uh.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.users_households uh
      where uh.household_id = comments.household_id
        and uh.user_id = auth.uid()
    )
  );



