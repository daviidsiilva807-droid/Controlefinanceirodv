-- =====================================================================
--  Controle Financeiro — 04: dados de exemplo (OPCIONAL)
--
--  Rode apenas se quiser ver o app populado antes de lançar de verdade.
--  Cria um cartão de crédito, um orçamento, uma conta recorrente e alguns
--  lançamentos do mês atual para o PRIMEIRO usuário cadastrado.
--
--  Para limpar depois, veja o bloco comentado no final do arquivo.
-- =====================================================================

do $$
declare
  v_user     uuid;
  v_corrente uuid;
  v_cartao   uuid;
  v_mes      date := date_trunc('month', current_date)::date;
  c_aliment  uuid;
  c_mercado  uuid;
  c_transp   uuid;
  c_moradia  uuid;
  c_lazer    uuid;
  c_assin    uuid;
  c_salario  uuid;
  v_grupo    uuid := gen_random_uuid();
begin
  select id into v_user from public.profiles order by created_at limit 1;

  if v_user is null then
    raise notice 'Nenhum usuário encontrado — cadastre-se no app antes de rodar este arquivo.';
    return;
  end if;

  select id into v_corrente from public.accounts
   where user_id = v_user and type = 'corrente' limit 1;

  -- Cartão de crédito: fecha dia 25, vence dia 5.
  insert into public.accounts (user_id, name, type, icon, color, credit_limit_cents, closing_day, due_day, sort_order)
  values (v_user, 'Cartão Nubank', 'cartao', '💳', '#4a3aa7', 800000, 25, 5, 3)
  returning id into v_cartao;

  select id into c_aliment from public.categories where user_id = v_user and name = 'Alimentação';
  select id into c_mercado from public.categories where user_id = v_user and name = 'Mercado';
  select id into c_transp  from public.categories where user_id = v_user and name = 'Transporte';
  select id into c_moradia from public.categories where user_id = v_user and name = 'Moradia';
  select id into c_lazer   from public.categories where user_id = v_user and name = 'Lazer';
  select id into c_assin   from public.categories where user_id = v_user and name = 'Assinaturas';
  select id into c_salario from public.categories where user_id = v_user and name = 'Salário';

  -- Saldo inicial da conta corrente: R$ 2.500,00
  update public.accounts set initial_balance_cents = 250000 where id = v_corrente;

  insert into public.transactions
    (user_id, account_id, category_id, kind, amount_cents, description, date, paid)
  values
    (v_user, v_corrente, c_salario, 'income',  580000, 'Salário',       v_mes + 4,  true),
    (v_user, v_corrente, c_moradia, 'expense', 180000, 'Aluguel',       v_mes + 4,  true),
    (v_user, v_cartao,   c_mercado, 'expense',  32450, 'Compra do mês', v_mes + 6,  true),
    (v_user, v_cartao,   c_aliment, 'expense',   4790, 'Almoço',        v_mes + 8,  true),
    (v_user, v_cartao,   c_aliment, 'expense',   6230, 'Jantar',        v_mes + 11, true),
    (v_user, v_corrente, c_transp,  'expense',  15000, 'Gasolina',      v_mes + 9,  true),
    (v_user, v_cartao,   c_lazer,   'expense',  12000, 'Cinema',        v_mes + 12, true),
    (v_user, v_cartao,   c_assin,   'expense',   5590, 'Streaming',     v_mes + 14, true);

  -- Compra parcelada em 3x de R$ 899,90 — o resto dos centavos vai na 1ª.
  insert into public.transactions
    (user_id, account_id, category_id, kind, amount_cents, description, date, paid,
     installment_group_id, installment_no, installment_total)
  values
    (v_user, v_cartao, c_lazer, 'expense', 30000, 'Fone de ouvido', v_mes + 10,                             true,  v_grupo, 1, 3),
    (v_user, v_cartao, c_lazer, 'expense', 29995, 'Fone de ouvido', (v_mes + interval '1 month')::date + 9, false, v_grupo, 2, 3),
    (v_user, v_cartao, c_lazer, 'expense', 29995, 'Fone de ouvido', (v_mes + interval '2 month')::date + 9, false, v_grupo, 3, 3);

  insert into public.recurring_rules
    (user_id, account_id, category_id, kind, amount_cents, description, day_of_month)
  values
    (v_user, v_corrente, c_moradia, 'expense', 180000, 'Aluguel', 5);

  insert into public.budgets (user_id, category_id, month, limit_cents)
  values
    (v_user, c_aliment, v_mes,  50000),
    (v_user, c_mercado, v_mes,  90000),
    (v_user, c_lazer,   v_mes,  40000),
    (v_user, c_transp,  v_mes,  30000)
  on conflict (user_id, category_id, month) do nothing;

  raise notice 'Dados de exemplo criados para o usuário %', v_user;
end;
$$;


-- =====================================================================
--  Para APAGAR os dados de exemplo (cuidado: apaga TODOS os lançamentos,
--  orçamentos e recorrentes do primeiro usuário):
-- =====================================================================
--
--  do $$
--  declare v_user uuid;
--  begin
--    select id into v_user from public.profiles order by created_at limit 1;
--    delete from public.transactions    where user_id = v_user;
--    delete from public.recurring_rules where user_id = v_user;
--    delete from public.budgets         where user_id = v_user;
--    delete from public.accounts        where user_id = v_user and type = 'cartao';
--  end $$;
