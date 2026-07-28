-- =====================================================================
--  Controle Financeiro — 02: funções, triggers e RPCs
--  Rode depois de 01_schema.sql.
-- =====================================================================

-- ------------------------------------------------------- código de convite

-- Alfabeto sem 0/O/1/I/L: o código é ditado em voz alta para a outra pessoa,
-- então caracteres ambíguos só geram frustração.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  codigo   text;
begin
  loop
    codigo := '';
    for _ in 1 .. 6 loop
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.households where invite_code = codigo);
  end loop;
  return codigo;
end;
$$;

-- Consultada na tela de cadastro, ANTES do login existir — por isso é a única
-- função liberada para o papel `anon`. Devolve só o nome da casa (nunca dados
-- financeiros), então errar o código não vaza nada de útil.
create or replace function public.household_name_for_code(p_code text)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select name from public.households where invite_code = upper(trim(p_code))
$$;

-- ---------------------------------------------------- casa nova já mobiliada

-- Categorias e contas iniciais em pt-BR. Sem isso o app abre vazio e a pessoa
-- precisa cadastrar 20 categorias antes de lançar o primeiro gasto.
--
-- As cores NÃO foram escolhidas no olho: são os tons de uma paleta categórica
-- validada para daltonismo (protanopia/deuteranopia), com os oito primeiros
-- reservados para as categorias que mais aparecem nos gráficos. Ainda assim,
-- nenhuma paleta resolve seis cores arbitrárias lado a lado — por isso todo
-- gráfico do app rotula categoria por emoji e nome, e a cor é reforço.
create or replace function public.seed_household(p_household uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (household_id, name, kind, icon, color, sort_order)
  select p_household, d.name, d.kind, d.icon, d.color, d.ord
  from (values
    -- Os oito primeiros tons da paleta validada vão para as categorias que
    -- costumam liderar o gasto e, portanto, aparecem nos gráficos.
    ('Moradia',            'expense', '🏠', '#2a78d6',  1),
    ('Mercado',            'expense', '🛒', '#eb6834',  2),
    ('Alimentação',        'expense', '🍽️', '#1baf7a',  3),
    ('Transporte',         'expense', '🚗', '#eda100',  4),
    ('Contas de casa',     'expense', '💡', '#e87ba4',  5),
    ('Saúde',              'expense', '🏥', '#008300',  6),
    ('Lazer',              'expense', '🎉', '#4a3aa7',  7),
    ('Assinaturas',        'expense', '📱', '#e34948',  8),
    -- As demais usam outros degraus das mesmas rampas.
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
  on conflict (household_id, kind, name) do nothing;

  insert into public.accounts (household_id, name, type, icon, color, sort_order)
  values
    (p_household, 'Conta corrente', 'corrente', '🏦', '#3b82f6', 1),
    (p_household, 'Dinheiro',       'dinheiro', '💵', '#22c55e', 2);
end;
$$;

-- ------------------------------------------------------- cadastro de usuário

-- Dispara no signup. Cria o perfil e resolve a casa: com código de convite
-- válido entra na casa existente; sem código, ganha uma casa nova já com
-- categorias e contas.
--
-- Repare que um código inválido NÃO derruba o cadastro — ele apenas cai no
-- caminho "casa nova". Uma exceção aqui viraria um "Database error saving new
-- user" ilegível para o usuário; a validação amigável do código acontece na
-- tela de cadastro, via household_name_for_code().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome    text;
  v_codigo  text;
  v_destino uuid;
begin
  v_nome := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name)
  values (new.id, v_nome)
  on conflict (id) do nothing;

  v_codigo := upper(nullif(trim(new.raw_user_meta_data ->> 'invite_code'), ''));

  if v_codigo is not null then
    select id into v_destino from public.households where invite_code = v_codigo;
  end if;

  if v_destino is not null then
    insert into public.household_members (household_id, user_id, role)
    values (v_destino, new.id, 'member')
    on conflict do nothing;
  else
    insert into public.households (name, invite_code)
    values ('Casa de ' || v_nome, public.generate_invite_code())
    returning id into v_destino;

    insert into public.household_members (household_id, user_id, role)
    values (v_destino, new.id, 'owner');

    perform public.seed_household(v_destino);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Entrar numa casa depois do cadastro (tela Configurações > Família).
--
-- Se a pessoa já tem uma casa própria mas ainda não lançou nada, essa casa
-- vazia é descartada — é o caso normal de quem se cadastrou e só depois
-- recebeu o código. Se já existem lançamentos, recusamos: juntar duas casas
-- com histórico é uma operação destrutiva que o usuário precisa decidir.
create or replace function public.join_household(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_destino  uuid;
  v_atual    uuid;
  v_lancados int;
begin
  if auth.uid() is null then
    raise exception 'NAO_AUTENTICADO';
  end if;

  select id into v_destino from public.households where invite_code = upper(trim(p_code));
  if v_destino is null then
    raise exception 'CODIGO_INVALIDO';
  end if;

  select household_id into v_atual
  from public.household_members where user_id = auth.uid() limit 1;

  if v_atual = v_destino then
    return v_destino;
  end if;

  if v_atual is not null then
    select count(*) into v_lancados from public.transactions where household_id = v_atual;
    if v_lancados > 0 then
      raise exception 'CASA_COM_DADOS';
    end if;

    delete from public.household_members where user_id = auth.uid() and household_id = v_atual;
    delete from public.households h
    where h.id = v_atual
      and not exists (select 1 from public.household_members m where m.household_id = h.id);
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (v_destino, auth.uid(), 'member')
  on conflict do nothing;

  return v_destino;
end;
$$;

-- ------------------------------------------------------ fatura do cartão

-- Descobre a qual fatura a compra pertence. Regra: compra a partir do dia do
-- fechamento já entra na fatura do mês seguinte. Ex.: fechamento dia 25 —
-- compra em 24/jan cai na fatura de janeiro; em 26/jan, na de fevereiro.
--
-- Fica no banco, e não no client, porque relatório e fatura precisam
-- concordar mesmo se um lançamento for criado por outro caminho (importação,
-- SQL manual, recorrente).
create or replace function public.set_invoice_month()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo        text;
  v_fechamento  smallint;
  v_ref         date;
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

create trigger transactions_set_invoice_month
  before insert or update of date, account_id on public.transactions
  for each row execute function public.set_invoice_month();

-- ---------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
-- search_path fixo em toda função: sem isso, um schema colocado no caminho de
-- busca poderia sequestrar a resolução de nomes lá dentro.
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();

create trigger budgets_touch before update on public.budgets
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- materializar recorrentes

-- Chamada pelo app ao abrir e ao trocar de mês. Cria os lançamentos das regras
-- ativas que ainda não têm lançamento naquele mês, marcados como NÃO pagos —
-- eles aparecem como "a pagar" até você confirmar.
--
-- É idempotente: rodar dez vezes no mesmo mês não duplica nada.
create or replace function public.materialize_recurring(p_month date default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casa  uuid := public.my_household_id();
  v_mes   date := date_trunc('month', coalesce(p_month, current_date))::date;
  v_data  date;
  v_total int  := 0;
  r       record;
begin
  if v_casa is null then
    return 0;
  end if;

  for r in
    select * from public.recurring_rules
    where household_id = v_casa and active
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
      household_id, account_id, category_id, kind, amount_cents,
      description, date, paid, recurring_rule_id, created_by
    )
    values (
      v_casa, r.account_id, r.category_id, r.kind, r.amount_cents,
      r.description, v_data, false, r.id, auth.uid()
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- ------------------------------------------------------------- relatórios

-- Totais por mês para o gráfico de evolução. Existe para não baixar um ano
-- inteiro de lançamentos só para desenhar 12 barras.
-- SECURITY INVOKER de propósito: aqui o RLS DEVE valer.
create or replace function public.monthly_totals(p_from date, p_to date)
returns table (month date, income_cents bigint, expense_cents bigint)
language sql
stable
set search_path = public
as $$
  select
    date_trunc('month', t.date)::date                                              as month,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'income'),  0)::bigint      as income_cents,
    coalesce(sum(t.amount_cents) filter (where t.kind = 'expense'), 0)::bigint      as expense_cents
  from public.transactions t
  where t.date >= p_from
    and t.date <  p_to
    and t.kind <> 'transfer'
  group by 1
  order by 1
$$;

-- Saldo atual de cada conta (cartão de crédito fica de fora: ele não tem
-- saldo, tem fatura). Só lançamentos com paid = true entram — o previsto não
-- deve mexer no que você tem hoje.
--
-- As duas somas são subconsultas independentes de propósito: fazer isso com
-- dois LEFT JOIN produziria produto cartesiano entre as linhas e inflaria o
-- saldo silenciosamente.
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
      -- Movimentos da própria conta: entrada soma, saída e transferência
      -- enviada subtraem.
      + coalesce((
          select sum(case when t.kind = 'income' then t.amount_cents else -t.amount_cents end)
          from public.transactions t
          where t.account_id = a.id and t.paid
        ), 0)
      -- Transferências recebidas.
      + coalesce((
          select sum(t.amount_cents)
          from public.transactions t
          where t.transfer_account_id = a.id and t.kind = 'transfer' and t.paid
        ), 0)
    )::bigint
  from public.accounts a
  where a.type <> 'cartao'
$$;

-- ------------------------------------------------------------------ grants

-- ATENÇÃO A ESTA ORDEM: revogar de PUBLIC primeiro, conceder depois.
--
-- O Postgres concede EXECUTE a PUBLIC por padrão em toda função nova, e os
-- papéis `anon` e `authenticated` herdam de PUBLIC. Logo, um
-- `revoke execute ... from anon, authenticated` sozinho NÃO protege nada — o
-- grant de PUBLIC continua valendo e a função segue exposta como endpoint
-- REST em /rest/v1/rpc/<nome>.
--
-- Sem esta revogação, funções internas ficam publicamente chamáveis, entre
-- elas seed_household(), que é SECURITY DEFINER e escreveria numa casa
-- arbitrária.
revoke execute on all functions in schema public from public, anon, authenticated;

-- A partir daqui, só o que o app realmente chama.

-- A única aberta ao `anon`, de propósito: roda na tela de cadastro, antes de
-- existir login, e devolve apenas o nome da casa — errar o código não vaza
-- nada de útil.
grant execute on function public.household_name_for_code(text) to anon, authenticated;

grant execute on function public.join_household(text)        to authenticated;
grant execute on function public.materialize_recurring(date) to authenticated;
grant execute on function public.monthly_totals(date, date)  to authenticated;
grant execute on function public.account_balances()          to authenticated;

-- Chamadas de dentro das policies de RLS, que são avaliadas com o papel de
-- quem está consultando.
grant execute on function public.my_household_id()           to authenticated;
grant execute on function public.is_household_member(uuid)   to authenticated;
grant execute on function public.shares_household_with(uuid) to authenticated;

-- As demais ficam sem grant nenhum e isso é suficiente:
--   * gatilhos (handle_new_user, set_invoice_month, touch_updated_at) — o
--     Postgres não exige EXECUTE do usuário para disparar um trigger;
--   * internas (seed_household, generate_invite_code) — são chamadas de
--     dentro de uma SECURITY DEFINER, cujo dono já tem permissão.

-- Fecha o mesmo furo para qualquer função criada daqui para frente.
alter default privileges in schema public revoke execute on functions from public;
