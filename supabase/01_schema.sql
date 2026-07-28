-- =====================================================================
--  Controle Financeiro — 01: tabelas, índices e restrições
--  Rode este arquivo primeiro, no SQL Editor do Supabase.
--
--  Convenção de dinheiro: TODO valor é gravado em CENTAVOS INTEIROS
--  (bigint). Nunca usamos float/numeric para dinheiro — em JavaScript
--  0.1 + 0.2 = 0.30000000000000004, e num app financeiro isso vira erro
--  de centavos acumulado nos relatórios. A formatação em R$ acontece só
--  na hora de exibir.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- pessoas

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null default 'Você',
  emoji        text        not null default '🙂',
  created_at   timestamptz not null default now()
);

comment on table public.profiles is 'Dados públicos do usuário, visíveis para quem divide a mesma casa.';

-- "Casa" = o grupo que compartilha os lançamentos (você e mais uma pessoa).
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text        not null default 'Minha casa',
  invite_code text        not null unique,
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id uuid        not null references public.households (id) on delete cascade,
  user_id      uuid        not null references auth.users (id)        on delete cascade,
  role         text        not null default 'member' check (role in ('owner', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),

  -- Esta segunda chave estrangeira parece redundante — user_id já aponta para
  -- auth.users, e profiles.id também — mas NÃO é. O PostgREST só resolve o
  -- embed `select=...,profiles(...)` se existir uma FK direta entre as duas
  -- tabelas; apontarem para um terceiro em comum não basta. Sem ela, a
  -- consulta dos membros falha com PGRST200 e a tela Família fica vazia.
  --
  -- É segura porque o gatilho handle_new_user() insere em profiles antes de
  -- inserir aqui.
  constraint household_members_profile_fk
    foreign key (user_id) references public.profiles (id) on delete cascade
);

create index household_members_user_idx on public.household_members (user_id);

-- ------------------------------------------------------------ funções base
--
-- Estas três moram aqui (e não em 02_functions.sql) porque as tabelas abaixo
-- as usam como DEFAULT de coluna, e o Postgres exige que a função já exista
-- na hora de criar a tabela.
--
-- Todas são SECURITY DEFINER de propósito: elas leem household_members, que
-- tem RLS ligado. Se fossem SECURITY INVOKER, a policy de household_members
-- chamaria a função que lê household_members — recursão infinita. Sendo
-- DEFINER, a leitura roda com os privilégios do dono e a recursão some.

-- A casa do usuário logado. Serve de DEFAULT para household_id, o que deixa
-- os inserts do app enxutos e impede o client de forjar outra casa.
create or replace function public.my_household_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
  limit 1
$$;

-- Base de praticamente toda policy: "esta linha é da minha casa?"
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members
    where household_id = hid
      and user_id = auth.uid()
  )
$$;

-- Usada para eu poder ver o perfil (nome/emoji) de quem divide a casa comigo.
create or replace function public.shares_household_with(p_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid()
      and b.user_id = p_user
  )
$$;

-- ----------------------------------------------------------------- contas

create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null,
  type                  text not null check (type in ('corrente', 'poupanca', 'dinheiro', 'cartao', 'investimento')),
  initial_balance_cents bigint      not null default 0,
  color                 text        not null default '#10b981',
  icon                  text        not null default '🏦',
  -- Só para type = 'cartao'. Limitados a 28 para não quebrar em fevereiro.
  credit_limit_cents    bigint,
  closing_day           smallint check (closing_day between 1 and 28),
  due_day               smallint check (due_day between 1 and 28),
  archived              boolean     not null default false,
  sort_order            int         not null default 0,
  created_at            timestamptz not null default now(),

  constraint accounts_cartao_precisa_dias check (
    type <> 'cartao' or (closing_day is not null and due_day is not null)
  )
);

create index accounts_household_idx on public.accounts (household_id) where archived = false;

-- ------------------------------------------------------------- categorias

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null,
  kind         text not null check (kind in ('expense', 'income')),
  color        text        not null default '#64748b',
  icon         text        not null default '🏷️',
  parent_id    uuid references public.categories (id) on delete set null,
  sort_order   int         not null default 0,
  archived     boolean     not null default false,
  created_at   timestamptz not null default now(),

  unique (household_id, kind, name)
);

create index categories_household_idx on public.categories (household_id) where archived = false;

-- ------------------------------------------------------------ lançamentos

create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid   not null default public.my_household_id() references public.households (id) on delete cascade,
  account_id           uuid   not null references public.accounts (id)   on delete restrict,
  category_id          uuid            references public.categories (id) on delete restrict,
  kind                 text   not null check (kind in ('expense', 'income', 'transfer')),
  amount_cents         bigint not null check (amount_cents > 0),
  description          text   not null default '',
  date                 date   not null,
  -- false = previsto/a pagar (conta futura, recorrente ainda não quitada)
  paid                 boolean not null default true,
  transfer_account_id  uuid references public.accounts (id) on delete restrict,
  -- Fatura do cartão a que a compra pertence (preenchido por trigger).
  invoice_month        date,
  -- Parcelamento: N linhas compartilham o mesmo installment_group_id.
  installment_group_id uuid,
  installment_no       smallint,
  installment_total    smallint,
  recurring_rule_id    uuid,
  -- ON DELETE SET NULL, e não NOT NULL: created_by serve só para mostrar "quem
  -- lançou". O lançamento pertence à CASA, não à pessoa — se alguém apagar a
  -- conta, o histórico financeiro compartilhado tem que sobreviver, não travar
  -- a exclusão nem sumir junto.
  created_by           uuid default auth.uid() references auth.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint transactions_transferencia_valida check (
    (kind = 'transfer' and transfer_account_id is not null and transfer_account_id <> account_id)
    or (kind <> 'transfer' and transfer_account_id is null)
  ),
  constraint transactions_categoria_obrigatoria check (
    kind = 'transfer' or category_id is not null
  ),
  constraint transactions_parcelamento_valido check (
    (installment_group_id is null and installment_no is null and installment_total is null)
    or (installment_group_id is not null and installment_total >= 1 and installment_no between 1 and installment_total)
  )
);

create index transactions_mes_idx     on public.transactions (household_id, date desc);
create index transactions_cat_idx     on public.transactions (household_id, category_id, date);
create index transactions_fatura_idx  on public.transactions (account_id, invoice_month) where invoice_month is not null;
create index transactions_parcela_idx on public.transactions (installment_group_id) where installment_group_id is not null;

-- --------------------------------------------------------------- recorrentes

create table public.recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid   not null default public.my_household_id() references public.households (id) on delete cascade,
  account_id   uuid   not null references public.accounts (id)   on delete cascade,
  category_id  uuid   not null references public.categories (id) on delete restrict,
  kind         text   not null check (kind in ('expense', 'income')),
  amount_cents bigint not null check (amount_cents > 0),
  description  text   not null default '',
  day_of_month smallint not null check (day_of_month between 1 and 28),
  start_date   date        not null default current_date,
  end_date     date,
  active       boolean     not null default true,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.transactions
  add constraint transactions_recurring_fk
  foreign key (recurring_rule_id) references public.recurring_rules (id) on delete set null;

create index recurring_household_idx on public.recurring_rules (household_id) where active;

-- ---------------------------------------------------------------- orçamentos

create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid   not null default public.my_household_id() references public.households (id) on delete cascade,
  category_id  uuid   not null references public.categories (id) on delete cascade,
  -- Sempre o dia 1 do mês de referência.
  month        date   not null,
  limit_cents  bigint not null check (limit_cents > 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (household_id, category_id, month),
  constraint budgets_month_primeiro_dia check (extract(day from month) = 1)
);

create index budgets_mes_idx on public.budgets (household_id, month);

-- ------------------------------------------------------- realtime (2 usuários)

-- Faz o app da outra pessoa atualizar sozinho quando você lança algo.
-- Em bloco protegido: se você rodar este arquivo duas vezes, "já está na
-- publicação" não deve derrubar a migração inteira.
do $$
begin
  alter publication supabase_realtime add table public.transactions;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.budgets;
exception when duplicate_object then null;
end $$;
