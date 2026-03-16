-- Run this entire file in your Supabase SQL Editor
-- Go to: Supabase Dashboard > SQL Editor > New Query > paste this > Run

-- ================================================
-- TRANSACTIONS (Spending Tracker)
-- ================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  category text not null,
  date date not null,
  note text,
  created_at timestamptz default now()
);

alter table public.transactions enable row level security;

create policy "Users can manage own transactions"
  on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- BUDGET LIMITS (Spending Tracker)
-- ================================================
create table if not exists public.budget_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  limit_amount numeric(12, 2) not null,
  unique(user_id, month)
);

alter table public.budget_limits enable row level security;

create policy "Users can manage own budget limits"
  on public.budget_limits
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- ACCOUNTS (Net Worth)
-- ================================================
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null,
  current_value numeric(14, 2) not null default 0,
  updated_at timestamptz default now()
);

alter table public.accounts enable row level security;

create policy "Users can manage own accounts"
  on public.accounts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- NET WORTH SNAPSHOTS (Net Worth history chart)
-- ================================================
create table if not exists public.net_worth_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  total_value numeric(14, 2) not null,
  created_at timestamptz default now(),
  unique(user_id, month)
);

alter table public.net_worth_snapshots enable row level security;

create policy "Users can manage own snapshots"
  on public.net_worth_snapshots
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- TRADING CONFIG (Trading Journal — starting balance)
-- ================================================
create table if not exists public.trading_config (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  starting_balance numeric(12, 2) not null,
  created_at timestamptz default now()
);

alter table public.trading_config enable row level security;

create policy "Users can manage own trading config"
  on public.trading_config
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- TRADING ENTRIES (Trading Journal — daily entries)
-- ================================================
create table if not exists public.trading_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  closing_balance numeric(12, 2) not null,
  num_trades integer,
  notes text,
  strategy_tag text,
  pnl numeric(12, 2),
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.trading_entries enable row level security;

create policy "Users can manage own trading entries"
  on public.trading_entries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ================================================
-- INDEXES for performance
-- ================================================
create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc);
create index if not exists idx_trading_entries_user_date on public.trading_entries(user_id, date desc);
create index if not exists idx_accounts_user on public.accounts(user_id);
