-- Controle Financeiro - migration segura para bancos já existentes
-- Execute este arquivo sozinho no Supabase SQL Editor.
-- Ele não apaga nem altera lançamentos, contas, cartões ou usuários.

create table if not exists public.loans (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name                     text not null check (length(trim(name)) > 0),
  amount_cents             bigint not null check (amount_cents > 0),
  installments             smallint not null check (installments between 1 and 360),
  installment_amount_cents bigint not null check (installment_amount_cents > 0),
  active                   boolean not null default true,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists loans_user_idx on public.loans (user_id) where active;

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.notification_settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled        boolean not null default false,
  days_before    smallint not null default 3 check (days_before between 0 and 30),
  notify_closing boolean not null default true,
  notify_due     boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  account_id     uuid not null references public.accounts (id) on delete cascade,
  event          text not null check (event in ('closing', 'due')),
  reference_date date not null,
  days_before    smallint not null,
  sent_at        timestamptz not null default now(),
  unique (user_id, account_id, event, reference_date, days_before)
);

create index if not exists notification_deliveries_date_idx
  on public.notification_deliveries (reference_date);

alter table public.loans enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_settings enable row level security;
alter table public.notification_deliveries enable row level security;

-- Policies: DROP é seguro aqui porque substituímos somente as policies desta
-- migration; não remove dados nem policies das tabelas financeiras.
drop policy if exists loans_all on public.loans;
create policy loans_all on public.loans
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_all on public.push_subscriptions;
create policy push_subscriptions_all on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notification_settings_all on public.notification_settings;
create policy notification_settings_all on public.notification_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.loans to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.notification_settings to authenticated;

-- notification_deliveries é usada somente pela Edge Function com service_role.
-- Não conceda acesso ao papel authenticated.
