-- =====================================================================
--  Controle Financeiro — 01: tabelas, índices e restrições
--  Rode este arquivo primeiro, no SQL Editor do Supabase.
--
--  MODELO: cada conta é uma ilha. Todo dado financeiro pertence a UM
--  usuário (`user_id`) e ninguém mais enxerga — nem outro usuário, nem o
--  administrador. Não existe compartilhamento entre contas.
--
--  Convenção de dinheiro: TODO valor é gravado em CENTAVOS INTEIROS
--  (bigint). Nunca float/numeric — em JavaScript 0.1 + 0.2 dá
--  0.30000000000000004, e num app financeiro isso vira erro de centavos
--  acumulado no relatório. A formatação em R$ acontece só ao exibir.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- pessoas

-- `role` decide o que a pessoa vê no app:
--   'user'  → só os próprios dados;
--   'admin' → a lista de usuários e o envio de mensagens. O admin NÃO
--             enxerga lançamento, saldo nem orçamento de ninguém; isso é
--             garantido pelas policies em 03_rls.sql, não pela interface.
--
-- `email` é copiado de auth.users pelo gatilho de cadastro porque o client
-- não tem acesso ao schema `auth` — sem esta cópia, a lista do admin não
-- teria como identificar as pessoas.
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null default 'Você',
  email        text,
  emoji        text        not null default '🙂',
  role         text        not null default 'user' check (role in ('user', 'admin')),
  created_at   timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where role = 'admin';

-- ----------------------------------------------------------------- contas

-- O `default auth.uid()` em user_id deixa os inserts do app enxutos e, junto
-- com o WITH CHECK do RLS, impede o client de gravar linha no nome de outra
-- pessoa mesmo que tente.
create table public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
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

create index accounts_user_idx on public.accounts (user_id) where archived = false;

-- ------------------------------------------------------------- categorias

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null check (kind in ('expense', 'income')),
  color      text        not null default '#64748b',
  icon       text        not null default '🏷️',
  parent_id  uuid references public.categories (id) on delete set null,
  sort_order int         not null default 0,
  archived   boolean     not null default false,
  created_at timestamptz not null default now(),

  unique (user_id, kind, name)
);

create index categories_user_idx on public.categories (user_id) where archived = false;

-- ------------------------------------------------------------ lançamentos

create table public.transactions (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  account_id           uuid   not null references public.accounts (id)   on delete restrict,
  category_id          uuid            references public.categories (id) on delete restrict,
  kind                 text   not null check (kind in ('expense', 'income', 'transfer')),
  amount_cents         bigint not null check (amount_cents > 0),
  description          text   not null default '',
  -- Anotações longas (nota fiscal, o que foi combinado, por que o valor está
  -- diferente do normal). Separado de `description` de propósito: a descrição
  -- é curta e aparece na lista; a observação pode ter várias linhas e só é
  -- lida ao abrir o lançamento. Um campo só quebraria a lista.
  notes                text   not null default '',
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

create index transactions_mes_idx     on public.transactions (user_id, date desc);
create index transactions_cat_idx     on public.transactions (user_id, category_id, date);
create index transactions_fatura_idx  on public.transactions (account_id, invoice_month) where invoice_month is not null;
create index transactions_parcela_idx on public.transactions (installment_group_id) where installment_group_id is not null;

-- Busca por trecho dentro da observação. GIN + pg_trgm porque a pessoa digita
-- pedaços de palavra ("nota fis"), e índice B-tree não serve para LIKE '%…%'.
create extension if not exists pg_trgm;
create index transactions_notes_busca_idx
  on public.transactions using gin (notes gin_trgm_ops)
  where notes <> '';

-- ------------------------------------------------------------- recorrentes

create table public.recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  account_id   uuid   not null references public.accounts (id)   on delete cascade,
  category_id  uuid   not null references public.categories (id) on delete restrict,
  kind         text   not null check (kind in ('expense', 'income')),
  amount_cents bigint not null check (amount_cents > 0),
  description  text   not null default '',
  day_of_month smallint not null check (day_of_month between 1 and 28),
  start_date   date        not null default current_date,
  end_date     date,
  active       boolean     not null default true,
  created_at   timestamptz not null default now()
);

alter table public.transactions
  add constraint transactions_recurring_fk
  foreign key (recurring_rule_id) references public.recurring_rules (id) on delete set null;

create index recurring_user_idx on public.recurring_rules (user_id) where active;

-- ------------------------------------------------------------ assinaturas
--
-- Diferente de recurring_rules (que lança sozinha no extrato todo mês), esta
-- tabela é só um catálogo do que está ativo: nome, tipo e valor mensal — sem
-- exigir conta nem categoria — para o dashboard somar o gasto recorrente.

create table public.subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  name         text   not null check (length(trim(name)) > 0),
  type         text   not null check (type in (
                 'streaming', 'musica', 'ia', 'saude', 'academia',
                 'nuvem', 'software', 'jogos', 'educacao', 'noticias', 'outro'
               )),
  amount_cents bigint not null check (amount_cents > 0),
  -- Opcional: dia em que a cobrança costuma cair. Limitado a 28 pelo mesmo
  -- motivo do recurring_rules — vale em todos os meses, inclusive fevereiro.
  billing_day  smallint check (billing_day between 1 and 28),
  notes        text   not null default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id) where active;

-- ----------------------------------------------------------- empréstimos

create table public.loans (
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

create index loans_user_idx on public.loans (user_id) where active;

-- ---------------------------------------------------------------- orçamentos

create table public.budgets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid   not null references public.categories (id) on delete cascade,
  -- Sempre o dia 1 do mês de referência.
  month       date   not null,
  limit_cents bigint not null check (limit_cents > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, category_id, month),
  constraint budgets_month_primeiro_dia check (extract(day from month) = 1)
);

create index budgets_mes_idx on public.budgets (user_id, month);

-- ------------------------------------------------------------- mensagens

-- Caixa de entrada: o admin escreve, o usuário lê. Mão única de propósito —
-- não existe resposta, porque isso viraria um chat e não foi o pedido.
--
-- `from_user_id` é ON DELETE SET NULL: se a conta do admin for apagada, as
-- mensagens que ele enviou continuam legíveis para quem recebeu.
create table public.messages (
  id           uuid primary key default gen_random_uuid(),
  from_user_id uuid references auth.users (id) on delete set null,
  to_user_id   uuid not null references public.profiles (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  body         text not null default '',
  kind         text not null default 'info' check (kind in ('info', 'aviso', 'alerta')),
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

-- Índice parcial: a consulta mais frequente do app é "quantas não lidas eu
-- tenho?", e ela só olha as linhas com read_at nulo.
create index messages_nao_lidas_idx on public.messages (to_user_id) where read_at is null;
create index messages_caixa_idx     on public.messages (to_user_id, created_at desc);

-- --------------------------------------------------------- notificações push

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table public.notification_settings (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  enabled        boolean not null default false,
  days_before   smallint not null default 3 check (days_before between 0 and 30),
  notify_closing boolean not null default true,
  notify_due     boolean not null default true,
  updated_at     timestamptz not null default now()
);

create table public.notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  account_id      uuid not null references public.accounts (id) on delete cascade,
  event           text not null check (event in ('closing', 'due')),
  reference_date  date not null,
  days_before     smallint not null,
  sent_at         timestamptz not null default now(),
  unique (user_id, account_id, event, reference_date, days_before)
);

create index notification_deliveries_date_idx on public.notification_deliveries (reference_date);

-- ---------------------------------------------------------------- realtime

-- Faz o sino de mensagens acender na hora, sem precisar recarregar o app.
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
