-- =====================================================================
--  Controle Financeiro — 02: funções, triggers e RPCs
--  Rode depois de 01_schema.sql.
-- =====================================================================

-- ------------------------------------------------------------------ papel

-- "Quem está logado é administrador?"
--
-- SECURITY DEFINER de propósito: a policy de SELECT da própria tabela
-- `profiles` chama esta função. Se ela fosse INVOKER, ler profiles exigiria
-- ler profiles — recursão infinita. Sendo DEFINER, a leitura roda com os
-- privilégios do dono e a recursão some.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- ---------------------------------------------------- conta nova mobiliada

-- Categorias e contas iniciais em pt-BR. Sem isso o app abre vazio e a pessoa
-- precisa cadastrar 20 categorias antes de lançar o primeiro gasto.
--
-- As cores NÃO foram escolhidas no olho: são tons de uma paleta categórica
-- validada para daltonismo (protanopia/deuteranopia), com os oito primeiros
-- reservados às categorias que mais aparecem nos gráficos. Ainda assim,
-- nenhuma paleta resolve seis cores arbitrárias lado a lado — por isso todo
-- gráfico do app rotula por emoji e nome, e a cor é reforço.
create or replace function public.seed_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, kind, icon, color, sort_order)
  select p_user, d.name, d.kind, d.icon, d.color, d.ord
  from (values
    ('Moradia',            'expense', '🏠', '#2a78d6',  1),
    ('Mercado',            'expense', '🛒', '#eb6834',  2),
    ('Alimentação',        'expense', '🍽️', '#1baf7a',  3),
    ('Transporte',         'expense', '🚗', '#eda100',  4),
    ('Contas de casa',     'expense', '💡', '#e87ba4',  5),
    ('Saúde',              'expense', '🏥', '#008300',  6),
    ('Lazer',              'expense', '🎉', '#4a3aa7',  7),
    ('Assinaturas',        'expense', '📱', '#e34948',  8),
    ('Educação',           'expense', '📚', '#256abf',  9),
    ('Vestuário',          'expense', '👕', '#d95926', 10),
    ('Cuidados pessoais',  'expense', '💇', '#9085e9', 11),
    ('Pets',               'expense', '🐶', '#c98500', 12),
    ('Presentes',          'expense', '🎁', '#d55181', 13),
    ('Viagens',            'expense', '✈️', '#199e70', 14),
    ('Taxas e juros',      'expense', '💳', '#6da7ec', 15),
    ('Manutenção',         'expense', '🛠️', '#5598e7', 16),
    ('Outros',             'expense', '📦', '#898781', 17),
    ('Salário',            'income',  '💰', '#2a78d6',  1),
    ('Freelance',          'income',  '💼', '#1baf7a',  2),
    ('Investimentos',      'income',  '📈', '#008300',  3),
    ('Reembolso',          'income',  '🔁', '#4a3aa7',  4),
    ('Outros ganhos',      'income',  '✨', '#eda100',  5)
  ) as d(name, kind, icon, color, ord)
  on conflict (user_id, kind, name) do nothing;

  insert into public.accounts (user_id, name, type, icon, color, sort_order)
  values
    (p_user, 'Conta corrente', 'corrente', '🏦', '#2a78d6', 1),
    (p_user, 'Dinheiro',       'dinheiro', '💵', '#1baf7a', 2);
end;
$$;

-- ------------------------------------------------------- cadastro de usuário

-- Dispara no signup: cria o perfil, define o papel e mobília a conta.
--
-- REGRA DO ADMIN: a primeira conta criada no sistema vira administradora. O
-- teste é `count(*) <= 1` em auth.users, e não `not exists (select 1 from
-- profiles)`, porque este é um gatilho AFTER INSERT — o próprio usuário novo
-- já está contado. Contar auth.users em vez de profiles evita a brecha de
-- alguém apagar o perfil (mas não a conta) para se promover.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome  text;
  v_papel text;
begin
  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  select case when count(*) <= 1 then 'admin' else 'user' end
    into v_papel
  from auth.users;

  insert into public.profiles (id, display_name, email, role)
  values (new.id, v_nome, new.email, v_papel)
  on conflict (id) do nothing;

  perform public.seed_user(new.id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------ fatura do cartão

-- A qual fatura a compra pertence. Regra: compra a partir do dia do
-- fechamento já entra na fatura do mês seguinte. Ex.: fechamento dia 25 —
-- compra em 24/jan cai na fatura de janeiro; em 26/jan, na de fevereiro.
--
-- Fica no banco, e não no client, porque relatório e fatura precisam
-- concordar mesmo se um lançamento for criado por outro caminho.
create or replace function public.set_invoice_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo       text;
  v_fechamento smallint;
  v_ref        date;
begin
  select type, closing_day into v_tipo, v_fechamento
  from public.accounts where id = new.account_id;

  if v_tipo = 'cartao' then
    v_ref := date_trunc('month', new.date)::date;
    if extract(day from new.date) >= v_fechamento then
      v_ref := (v_ref + interval '1 month')::date;
    end if;
    new.invoice_month := v_ref;
  else
    new.invoice_month := null;
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_set_invoice_month on public.transactions;
create trigger transactions_set_invoice_month
  before insert or update of date, account_id on public.transactions
  for each row execute function public.set_invoice_month();

-- ---------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transactions_touch on public.transactions;
create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

drop trigger if exists budgets_touch on public.budgets;
create trigger budgets_touch before update on public.budgets
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- materializar recorrentes

-- Chamada pelo app ao abrir e ao trocar de mês. Cria os lançamentos das regras
-- ativas que ainda não têm lançamento naquele mês, marcados como NÃO pagos.
-- É idempotente: rodar dez vezes no mesmo mês não duplica nada.
create or replace function public.materialize_recurring(p_month date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_mes   date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_data  date;
  v_total int  := 0;
  r       record;
begin
  if v_user is null then
    return 0;
  end if;

  for r in
    select * from public.recurring_rules
    where user_id = v_user and active
  loop
    v_data := (v_mes + (r.day_of_month - 1) * interval '1 day')::date;

    continue when v_data < r.start_date;
    continue when r.end_date is not null and v_data > r.end_date;
    continue when exists (
      select 1 from public.transactions t
      where t.recurring_rule_id = r.id
        and date_trunc('month', t.date) = v_mes
    );

    insert into public.transactions (
      user_id, account_id, category_id, kind, amount_cents,
      description, date, paid, recurring_rule_id
    )
    values (
      v_user, r.account_id, r.category_id, r.kind, r.amount_cents,
      r.description, v_data, false, r.id
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- ------------------------------------------------------------- relatórios

-- SECURITY INVOKER (o padrão): aqui o RLS DEVE valer, senão a função viraria
-- um buraco por onde um usuário leria os totais de outro.
create or replace function public.monthly_totals(p_from date, p_to date)
returns table (month date, income_cents bigint, expense_cents bigint)
language sql
stable
set search_path = public
as $$
  select
    date_trunc('month', t.date)::date                                         as month,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'income'),  0)::bigint as income_cents,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)::bigint as expense_cents
  from public.transactions t
  where t.date >= p_from
    and t.date <  p_to
    and t.kind <> 'transfer'
  group by 1
  order by 1
$$;

-- Saldo de cada conta (cartão fica de fora: ele tem fatura, não saldo). Só
-- lançamentos com paid = true entram.
--
-- As duas somas são subconsultas independentes de propósito: com dois LEFT
-- JOIN o produto cartesiano entre as linhas inflaria o saldo em silêncio.
create or replace function public.account_balances()
returns table (account_id uuid, balance_cents bigint)
language sql
stable
set search_path = public
as $$
  select
    a.id,
    (
      a.initial_balance_cents
      + coalesce((
          select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
          from public.transactions t
          where t.account_id = a.id and t.paid
        ), 0)
      + coalesce((
          select sum(t.amount_cents)
          from public.transactions t
          where t.transfer_account_id = a.id and t.kind = 'transfer' and t.paid
        ), 0)
    )::bigint
  from public.accounts a
  where a.type <> 'cartao'
$$;

-- -------------------------------------------------------------- mensagens

-- Envio pelo admin. Existe como função (em vez de INSERT direto) para o
-- remetente ser sempre auth.uid(), sem depender do client mandar o campo
-- certo, e para validar o papel num lugar só.
create or replace function public.send_message(
  p_to    uuid,
  p_title text,
  p_body  text default '',
  p_kind  text default 'info'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'USUARIO_INEXISTENTE';
  end if;

  insert into public.messages (from_user_id, to_user_id, title, body, kind)
  values (auth.uid(), p_to, trim(p_title), coalesce(p_body, ''), coalesce(p_kind, 'info'))
  returning id into v_id;

  return v_id;
end;
$$;

-- Envio para todo mundo de uma vez (menos o próprio admin). Devolve quantas
-- mensagens foram criadas.
create or replace function public.broadcast_message(
  p_title text,
  p_body  text default '',
  p_kind  text default 'info'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
begin
  if not public.is_admin() then
    raise exception 'SEM_PERMISSAO';
  end if;

  insert into public.messages (from_user_id, to_user_id, title, body, kind)
  select auth.uid(), p.id, trim(p_title), coalesce(p_body, ''), coalesce(p_kind, 'info')
  from public.profiles p
  where p.id <> auth.uid();

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

-- ------------------------------------------------------------------ grants
--
-- ATENÇÃO A ESTA ORDEM: revogar de PUBLIC primeiro, conceder depois.
--
-- O Postgres concede EXECUTE a PUBLIC por padrão em toda função nova, e os
-- papéis `anon` e `authenticated` herdam de PUBLIC. Logo, revogar só de
-- anon/authenticated NÃO protege nada — a função continua exposta como
-- endpoint REST em /rest/v1/rpc/<nome>.
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.materialize_recurring(date)                to authenticated;
grant execute on function public.monthly_totals(date, date)                 to authenticated;
grant execute on function public.account_balances()                         to authenticated;
grant execute on function public.is_admin()                                 to authenticated;
grant execute on function public.send_message(uuid, text, text, text)       to authenticated;
grant execute on function public.broadcast_message(text, text, text)        to authenticated;

-- Nada é liberado para `anon`: sem login, não há o que fazer neste app.
--
-- As demais ficam sem grant e isso basta:
--   * gatilhos (handle_new_user, set_invoice_month, touch_updated_at) — o
--     Postgres não exige EXECUTE do usuário para disparar um trigger;
--   * seed_user — é chamada de dentro de uma SECURITY DEFINER cujo dono já
--     tem permissão.
--
-- send_message e broadcast_message são liberadas a todo usuário logado, mas
-- checam is_admin() na primeira linha: quem não for admin leva SEM_PERMISSAO.

-- Fecha o mesmo furo para qualquer função criada daqui para frente.
alter default privileges in schema public revoke execute on functions from public;
