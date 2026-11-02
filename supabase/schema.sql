-- Esquema de la base de datos para Supabase.
-- Pegá todo este archivo en Supabase → SQL Editor → New query → Run.

create table if not exists settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  phone text,
  plan_id text,
  since date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'), -- "2026-11"
  amount numeric(12, 2) not null check (amount > 0),
  method text not null,
  paid_on date not null,
  created_at timestamptz not null default now(),
  unique (member_id, period)
);

create index if not exists payments_period_idx on payments (period);

insert into settings (id) values (1) on conflict (id) do nothing;

-- Seguridad: todo es privado. Sólo el usuario logueado (el dueño) puede ver y modificar.
alter table settings enable row level security;
alter table members enable row level security;
alter table payments enable row level security;

drop policy if exists "settings: sólo admin" on settings;
create policy "settings: sólo admin" on settings
  for all to authenticated using (true) with check (true);

drop policy if exists "members: sólo admin" on members;
create policy "members: sólo admin" on members
  for all to authenticated using (true) with check (true);

drop policy if exists "payments: sólo admin" on payments;
create policy "payments: sólo admin" on payments
  for all to authenticated using (true) with check (true);
