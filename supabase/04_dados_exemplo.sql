-- =====================================================================
--  Controle Financeiro — 04: dados de exemplo (OPCIONAL)
--
--  Rode apenas se quiser ver o app populado antes de lançar de verdade.
--  Cria um cartão de crédito, um orçamento, uma conta recorrente e alguns
--  lançamentos do mês atual na casa do PRIMEIRO usuário cadastrado.
--
--  Para limpar depois, veja o bloco no final do arquivo.
-- =====================================================================

do $$
declare
  v_casa      uuid;
  v_dono      uuid;
  v_corrente  uuid;
  v_cartao    uuid;
  v_mes       date := date_trunc('month', current_date)::date;
  c_aliment   uuid;
  c_mercado   uuid;
  c_transp    uuid;
  c_moradia   uuid;
  c_lazer     uuid;
  c_assin     uuid;
  c_salario   uuid;
  v_grupo     uuid := gen_random_uuid();
begin
  select m.household_id, m.user_id into v_casa, v_dono
  from public.household_members m
  order by m.joined_at
  limit 1;

  if v_casa is null then
    raise notice 'Nenhuma casa encontrada — cadastre um usuário no app antes de rodar este arquivo.';
    return;
  end if;

  select id into v_corrente from public.accounts where household_id = v_casa and type = 'corrente' limit 1;

  -- Cartão de crédito: fecha dia 25, vence dia 5.
  insert into public.accounts (household_id, name, type, icon, color, credit_limit_cents, closing_day, due_day, sort_order)
  values (v_casa, 'Cartão Nubank', 'cartao', '💳', '#8b5cf6', 800000, 25, 5, 3)
  returning id into v_cartao;

  select id into c_aliment from public.categories where household_id = v_casa and name = 'Alimentação';
  select id into c_mercado from public.categories where household_id = v_casa and name = 'Mercado';
  select id into c_transp  from public.categories where household_id = v_casa and name = 'Transporte';
  select id into c_moradia from public.categories where household_id = v_casa and name = 'Moradia';
  select id into c_lazer   from public.categories where household_id = v_casa and name = 'Lazer';
  select id into c_assin   from public.categories where household_id = v_casa and name = 'Assinaturas';
  select id into c_salario from public.categories where household_id = v_casa and name = 'Salário';

  -- Saldo inicial da conta corrente: R$ 2.500,00
  update public.accounts set initial_balance_cents = 250000 where id = v_corrente;

  insert into public.transactions
    (household_id, account_id, category_id, kind, amount_cents, description, date, paid, created_by)
  values
    (v_casa, v_corrente, c_salario, 'income',  580000, 'Salário',            v_mes + 4,  true,  v_dono),
    (v_casa, v_corrente, c_moradia, 'expense', 180000, 'Aluguel',            v_mes + 4,  true,  v_dono),
    (v_casa, v_cartao,   c_mercado, 'expense',  32450, 'Compra do mês',      v_mes + 6,  true,  v_dono),
    (v_casa, v_cartao,   c_aliment, 'expense',   4790, 'Almoço',             v_mes + 8,  true,  v_dono),
    (v_casa, v_cartao,   c_aliment, 'expense',   6230, 'Jantar',             v_mes + 11, true,  v_dono),
    (v_casa, v_corrente, c_transp,  'expense',  15000, 'Gasolina',           v_mes + 9,  true,  v_dono),
    (v_casa, v_cartao,   c_lazer,   'expense',  12000, 'Cinema',             v_mes + 12, true,  v_dono),
    (v_casa, v_cartao,   c_assin,   'expense',   5590, 'Streaming',          v_mes + 14, true,  v_dono);

  -- Compra parcelada em 3x de R$ 899,90 — o resto dos centavos vai na 1ª parcela.
  insert into public.transactions
    (household_id, account_id, category_id, kind, amount_cents, description, date, paid,
     installment_group_id, installment_no, installment_total, created_by)
  values
    (v_casa, v_cartao, c_lazer, 'expense', 30000, 'Fone de ouvido', v_mes + 10,                       true,  v_grupo, 1, 3, v_dono),
    (v_casa, v_cartao, c_lazer, 'expense', 29995, 'Fone de ouvido', (v_mes + interval '1 month')::date + 9, false, v_grupo, 2, 3, v_dono),
    (v_casa, v_cartao, c_lazer, 'expense', 29995, 'Fone de ouvido', (v_mes + interval '2 month')::date + 9, false, v_grupo, 3, 3, v_dono);

  -- Conta recorrente mensal.
  insert into public.recurring_rules
    (household_id, account_id, category_id, kind, amount_cents, description, day_of_month, created_by)
  values
    (v_casa, v_corrente, c_moradia, 'expense', 180000, 'Aluguel', 5, v_dono);

  -- Orçamentos do mês.
  insert into public.budgets (household_id, category_id, month, limit_cents)
  values
    (v_casa, c_aliment, v_mes,  50000),
    (v_casa, c_mercado, v_mes,  90000),
    (v_casa, c_lazer,   v_mes,  40000),
    (v_casa, c_transp,  v_mes,  30000)
  on conflict (household_id, category_id, month) do nothing;

  raise notice 'Dados de exemplo criados na casa %', v_casa;
end;
$$;


-- =====================================================================
--  Para APAGAR os dados de exemplo e começar do zero (cuidado: apaga
--  TODOS os lançamentos, orçamentos e recorrentes da casa):
-- =====================================================================
--
--  do $$
--  declare v_casa uuid;
--  begin
--    select household_id into v_casa from public.household_members order by joined_at limit 1;
--    delete from public.transactions    where household_id = v_casa;
--    delete from public.recurring_rules where household_id = v_casa;
--    delete from public.budgets         where household_id = v_casa;
--    delete from public.accounts        where household_id = v_casa and type = 'cartao';
--  end $$;
